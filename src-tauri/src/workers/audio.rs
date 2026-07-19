use crate::workers::{
    lifecycle::{RestartPolicy, WorkerRuntimeStatus},
    manager::WorkerProcess,
    protocol::{decode_request, encode_line, methods, WorkerMessage, WorkerRequest},
    AUDIO_WORKER_FLAG,
};
use rodio::{
    cpal::traits::{DeviceTrait, HostTrait},
    source::SeekError,
    Decoder, OutputStream, OutputStreamBuilder, Sink, Source,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    collections::hash_map::DefaultHasher,
    fs::{self, File, OpenOptions},
    hash::{Hash, Hasher},
    io::{self, BufRead, Read, Seek, SeekFrom, Write},
    path::PathBuf,
    sync::atomic::{AtomicBool, AtomicU32, Ordering},
    sync::{Arc, Condvar, Mutex},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const CACHE_FILE_PREFIX: &str = "mono-stream-";
const CACHE_FILE_EXTENSION: &str = "audio";
const PLAY_FADE_DURATION: Duration = Duration::from_millis(700);
const PAUSE_FADE_DURATION: Duration = Duration::from_millis(450);
const STOP_FADE_DURATION: Duration = Duration::from_millis(700);
const MIN_CROSSFADE_DURATION_MS: u64 = 300;
const MAX_CROSSFADE_DURATION_MS: u64 = 30_000;
const SPECTRUM_BANDS: usize = 5;
const SPECTRUM_WINDOW_SAMPLES: usize = 1024;
const SPECTRUM_FREQUENCIES: [f32; SPECTRUM_BANDS] = [80.0, 250.0, 700.0, 1800.0, 5000.0];
const HTTP_STREAM_CONNECT_TIMEOUT: Duration = Duration::from_secs(8);
const HTTP_STREAM_READ_TIMEOUT: Duration = Duration::from_secs(8);

pub(crate) struct AudioWorkerState {
    cache_dir: Mutex<PathBuf>,
    worker: Mutex<WorkerProcess>,
}

impl AudioWorkerState {
    pub(crate) fn start(cache_dir: PathBuf) -> Result<Self, String> {
        Ok(Self {
            cache_dir: Mutex::new(cache_dir.clone()),
            worker: Mutex::new(start_audio_worker(&cache_dir)?),
        })
    }

    pub(crate) fn restart_policy(&self) -> RestartPolicy {
        RestartPolicy::RestartOnceAndRetry
    }

    pub(crate) fn request(&self, request: &WorkerRequest) -> Result<WorkerMessage, String> {
        let mut worker = self.worker.lock().map_err(|err| err.to_string())?;
        match worker.request(request) {
            Ok(message) => Ok(message),
            Err(first_error) => {
                let cache_dir = self
                    .cache_dir
                    .lock()
                    .map(|path| path.clone())
                    .map_err(|err| err.to_string())?;
                let mut restarted_worker = start_audio_worker(&cache_dir)?;
                let message = restarted_worker.request(request).map_err(|retry_error| {
                    format!(
                        "audio worker restarted after error ({first_error}); retry failed: {retry_error}"
                    )
                })?;
                *worker = restarted_worker;
                Ok(message)
            }
        }
    }

    pub(crate) fn set_cache_dir(&self, cache_dir: PathBuf) -> Result<(), String> {
        self.expect_ok(WorkerRequest {
            id: "audio-set-cache-dir".to_string(),
            method: methods::PLAYER_SET_CACHE_DIR.to_string(),
            payload: json!({ "cacheDir": cache_dir }),
        })?;
        let mut current = self.cache_dir.lock().map_err(|err| err.to_string())?;
        *current = cache_dir;
        Ok(())
    }

    pub(crate) fn list_output_devices(
        &self,
    ) -> Result<Vec<crate::player::AudioOutputDevice>, String> {
        let request = WorkerRequest {
            id: "audio-output-devices".to_string(),
            method: methods::PLAYER_OUTPUT_DEVICES.to_string(),
            payload: json!({}),
        };

        self.deserialize_response(request)
    }

    pub(crate) fn play_path(
        &self,
        path: String,
        restart: bool,
        fade: bool,
        fade_duration_ms: Option<u64>,
    ) -> Result<(), String> {
        self.expect_ok(WorkerRequest {
            id: "audio-play-path".to_string(),
            method: methods::PLAYER_PLAY_PATH.to_string(),
            payload: json!({
                "path": path,
                "restart": restart,
                "fade": fade,
                "fadeDurationMs": fade_duration_ms,
            }),
        })
    }

    pub(crate) fn play_url(
        &self,
        url: String,
        restart: bool,
        fade: bool,
        fade_duration_ms: Option<u64>,
    ) -> Result<(), String> {
        self.expect_ok(WorkerRequest {
            id: "audio-play-url".to_string(),
            method: methods::PLAYER_PLAY_URL.to_string(),
            payload: json!({
                "url": url,
                "restart": restart,
                "fade": fade,
                "fadeDurationMs": fade_duration_ms,
            }),
        })
    }

    pub(crate) fn pause(&self, fade: bool) -> Result<(), String> {
        self.expect_ok(WorkerRequest {
            id: "audio-pause".to_string(),
            method: methods::PLAYER_PAUSE.to_string(),
            payload: json!({ "fade": fade }),
        })
    }

    pub(crate) fn resume(&self) -> Result<(), String> {
        self.expect_ok(WorkerRequest {
            id: "audio-resume".to_string(),
            method: methods::PLAYER_RESUME.to_string(),
            payload: json!({}),
        })
    }

    pub(crate) fn stop(&self, fade: bool) -> Result<(), String> {
        self.expect_ok(WorkerRequest {
            id: "audio-stop".to_string(),
            method: methods::PLAYER_STOP.to_string(),
            payload: json!({ "fade": fade }),
        })
    }

    pub(crate) fn seek(&self, seconds: f64) -> Result<(), String> {
        self.expect_ok(WorkerRequest {
            id: "audio-seek".to_string(),
            method: methods::PLAYER_SEEK.to_string(),
            payload: json!({ "seconds": seconds }),
        })
    }

    pub(crate) fn set_volume(&self, volume: f32) -> Result<(), String> {
        self.expect_ok(WorkerRequest {
            id: "audio-set-volume".to_string(),
            method: methods::PLAYER_SET_VOLUME.to_string(),
            payload: json!({ "volume": volume }),
        })
    }

    pub(crate) fn set_speed(&self, speed: f32) -> Result<(), String> {
        self.expect_ok(WorkerRequest {
            id: "audio-set-speed".to_string(),
            method: methods::PLAYER_SET_SPEED.to_string(),
            payload: json!({ "speed": speed }),
        })
    }

    pub(crate) fn set_output_device(&self, device_id: Option<String>) -> Result<(), String> {
        self.expect_ok(WorkerRequest {
            id: "audio-set-output-device".to_string(),
            method: methods::PLAYER_SET_OUTPUT_DEVICE.to_string(),
            payload: json!({ "deviceId": device_id }),
        })
    }

    pub(crate) fn state(&self) -> Result<crate::player::PlayerSnapshot, String> {
        self.deserialize_response(WorkerRequest {
            id: "audio-state".to_string(),
            method: methods::PLAYER_STATE.to_string(),
            payload: json!({}),
        })
    }

    pub(crate) fn status(&self) -> WorkerRuntimeStatus {
        match self.worker.lock() {
            Ok(mut worker) => worker.status(),
            Err(error) => WorkerRuntimeStatus::stopped("audio", Some(error.to_string())),
        }
    }

    #[allow(dead_code)]
    pub(crate) fn restart_process(&self) -> Result<(), String> {
        let cache_dir = self
            .cache_dir
            .lock()
            .map(|path| path.clone())
            .map_err(|err| err.to_string())?;
        let mut worker = self.worker.lock().map_err(|err| err.to_string())?;
        worker.stop();
        *worker = start_audio_worker(&cache_dir)?;
        Ok(())
    }

    #[allow(dead_code)]
    pub(crate) fn stop_process(&self) -> Result<(), String> {
        self.worker.lock().map_err(|err| err.to_string())?.stop();
        Ok(())
    }

    fn deserialize_response<T: for<'de> Deserialize<'de>>(
        &self,
        request: WorkerRequest,
    ) -> Result<T, String> {
        match self.request(&request)? {
            WorkerMessage::Response {
                ok: true,
                payload: Some(payload),
                ..
            } => serde_json::from_value(payload).map_err(|err| err.to_string()),
            WorkerMessage::Response {
                error: Some(error), ..
            } => Err(error),
            message => Err(format!("unexpected audio worker response: {message:?}")),
        }
    }

    fn expect_ok(&self, request: WorkerRequest) -> Result<(), String> {
        match self.request(&request)? {
            WorkerMessage::Response { ok: true, .. } => Ok(()),
            WorkerMessage::Response {
                error: Some(error), ..
            } => Err(error),
            message => Err(format!("unexpected audio worker response: {message:?}")),
        }
    }
}

fn start_audio_worker(cache_dir: &PathBuf) -> Result<WorkerProcess, String> {
    let args = vec![cache_dir.to_string_lossy().to_string()];
    let mut worker = WorkerProcess::spawn_current_exe("audio", AUDIO_WORKER_FLAG, &args)?;
    let request = WorkerRequest {
        id: "audio-worker-startup".to_string(),
        method: methods::WORKER_PING.to_string(),
        payload: json!({ "source": "tauri-setup" }),
    };
    match worker.request(&request)? {
        WorkerMessage::Response { ok: true, .. } => Ok(worker),
        WorkerMessage::Response {
            error: Some(error), ..
        } => Err(error),
        message => Err(format!(
            "unexpected audio worker startup response: {message:?}"
        )),
    }
}

struct AudioWorkerRuntime {
    backend: AudioBackend,
    cache_dir: String,
    started_at_ms: u128,
}

pub(crate) fn run(cache_dir: String) -> Result<(), String> {
    let mut runtime = AudioWorkerRuntime {
        backend: AudioBackend::default(),
        cache_dir,
        started_at_ms: crate::workers::worker_started_at_ms(),
    };
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line in stdin.lock().lines() {
        let line = line.map_err(|err| err.to_string())?;
        if line.trim().is_empty() {
            continue;
        }

        let response = match decode_request(&line) {
            Ok(request) => handle_request(&mut runtime, request),
            Err(error) => WorkerMessage::Response {
                id: "invalid-request".to_string(),
                ok: false,
                payload: None,
                error: Some(error),
            },
        };
        let should_shutdown = matches!(
            &response,
            WorkerMessage::Response {
                ok: true,
                payload: Some(payload),
                ..
            } if payload.get("shutdown").and_then(Value::as_bool) == Some(true)
        );

        let encoded = encode_line(&response)?;
        stdout
            .write_all(encoded.as_bytes())
            .map_err(|err| err.to_string())?;
        stdout.flush().map_err(|err| err.to_string())?;

        if should_shutdown {
            break;
        }
    }

    Ok(())
}

fn handle_request(runtime: &mut AudioWorkerRuntime, request: WorkerRequest) -> WorkerMessage {
    match request.method.as_str() {
        methods::WORKER_PING => WorkerMessage::Response {
            id: request.id,
            ok: true,
            payload: Some(json!({
                "pong": true,
                "worker": "audio",
                "cacheDir": runtime.cache_dir,
            })),
            error: None,
        },
        methods::WORKER_SHUTDOWN => WorkerMessage::Response {
            id: request.id,
            ok: true,
            payload: Some(json!({ "shutdown": true })),
            error: None,
        },
        methods::WORKER_HEALTH => WorkerMessage::Response {
            id: request.id,
            ok: true,
            payload: Some(crate::workers::worker_health_payload(
                "audio",
                runtime.started_at_ms,
            )),
            error: None,
        },
        methods::PLAYER_OUTPUT_DEVICES => match crate::player::list_output_devices_backend() {
            Ok(devices) => WorkerMessage::Response {
                id: request.id,
                ok: true,
                payload: Some(json!(devices)),
                error: None,
            },
            Err(error) => WorkerMessage::Response {
                id: request.id,
                ok: false,
                payload: None,
                error: Some(error),
            },
        },
        methods::PLAYER_SET_CACHE_DIR => response_from_result(request.id, || {
            let payload = serde_json::from_value::<CacheDirPayload>(request.payload)
                .map_err(|err| err.to_string())?;
            fs::create_dir_all(&payload.cache_dir).map_err(|err| err.to_string())?;
            runtime.cache_dir = payload.cache_dir.to_string_lossy().to_string();
            Ok(())
        }),
        methods::PLAYER_PLAY_PATH => response_from_result(request.id, || {
            let payload = serde_json::from_value::<PlayPathPayload>(request.payload)
                .map_err(|err| err.to_string())?;
            runtime.backend.play_path(
                payload.path,
                payload.restart,
                payload.fade,
                payload.fade_duration_ms,
            )
        }),
        methods::PLAYER_PLAY_URL => response_from_result(request.id, || {
            let payload = serde_json::from_value::<PlayUrlPayload>(request.payload)
                .map_err(|err| err.to_string())?;
            runtime.backend.play_url(
                payload.url,
                payload.restart,
                payload.fade,
                payload.fade_duration_ms,
                PathBuf::from(&runtime.cache_dir),
            )
        }),
        methods::PLAYER_PAUSE => response_from_result(request.id, || {
            let payload = serde_json::from_value::<FadePayload>(request.payload)
                .map_err(|err| err.to_string())?;
            runtime.backend.pause(payload.fade);
            Ok(())
        }),
        methods::PLAYER_RESUME => response_from_result(request.id, || runtime.backend.resume()),
        methods::PLAYER_STOP => response_from_result(request.id, || {
            let payload = serde_json::from_value::<FadePayload>(request.payload)
                .map_err(|err| err.to_string())?;
            runtime.backend.stop(payload.fade);
            Ok(())
        }),
        methods::PLAYER_SEEK => response_from_result(request.id, || {
            let payload = serde_json::from_value::<SeekPayload>(request.payload)
                .map_err(|err| err.to_string())?;
            runtime.backend.seek(payload.seconds)
        }),
        methods::PLAYER_SET_VOLUME => response_from_result(request.id, || {
            let payload = serde_json::from_value::<VolumePayload>(request.payload)
                .map_err(|err| err.to_string())?;
            runtime.backend.set_volume(payload.volume);
            Ok(())
        }),
        methods::PLAYER_SET_SPEED => response_from_result(request.id, || {
            let payload = serde_json::from_value::<SpeedPayload>(request.payload)
                .map_err(|err| err.to_string())?;
            runtime.backend.set_speed(payload.speed);
            Ok(())
        }),
        methods::PLAYER_SET_OUTPUT_DEVICE => response_from_result(request.id, || {
            let payload = serde_json::from_value::<OutputDevicePayload>(request.payload)
                .map_err(|err| err.to_string())?;
            runtime.backend.set_output_device(payload.device_id)
        }),
        methods::PLAYER_STATE => WorkerMessage::Response {
            id: request.id,
            ok: true,
            payload: Some(json!(runtime.backend.snapshot())),
            error: None,
        },
        method => WorkerMessage::Response {
            id: request.id,
            ok: false,
            payload: None,
            error: Some(format!("unsupported audio worker method: {method}")),
        },
    }
}

#[derive(Deserialize)]
struct PlayPathPayload {
    path: String,
    restart: bool,
    fade: bool,
    #[serde(default, rename = "fadeDurationMs")]
    fade_duration_ms: Option<u64>,
}

#[derive(Deserialize)]
struct PlayUrlPayload {
    url: String,
    restart: bool,
    fade: bool,
    #[serde(default, rename = "fadeDurationMs")]
    fade_duration_ms: Option<u64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CacheDirPayload {
    cache_dir: PathBuf,
}

#[derive(Deserialize)]
struct FadePayload {
    fade: bool,
}

#[derive(Deserialize)]
struct SeekPayload {
    seconds: f64,
}

#[derive(Deserialize)]
struct VolumePayload {
    volume: f32,
}

#[derive(Deserialize)]
struct SpeedPayload {
    speed: f32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutputDevicePayload {
    device_id: Option<String>,
}

struct AudioBackend {
    stream: Option<OutputStream>,
    sink: Option<Arc<Sink>>,
    output_device_id: Option<String>,
    stream_device_id: Option<String>,
    current_source: Option<String>,
    current_duration: Option<Duration>,
    current_cache_path: Option<PathBuf>,
    current_stream_state: Option<Arc<(Mutex<StreamingHttpState>, Condvar)>>,
    is_crossfading: Arc<AtomicBool>,
    spectrum_levels: Arc<[AtomicU32; SPECTRUM_BANDS]>,
    last_error: Option<String>,
    volume: f32,
    speed: f32,
}

impl Default for AudioBackend {
    fn default() -> Self {
        Self {
            stream: None,
            sink: None,
            output_device_id: None,
            stream_device_id: None,
            current_source: None,
            current_duration: None,
            current_cache_path: None,
            current_stream_state: None,
            is_crossfading: Arc::new(AtomicBool::new(false)),
            spectrum_levels: Arc::new(std::array::from_fn(|_| AtomicU32::new(0.0f32.to_bits()))),
            last_error: None,
            volume: 0.72,
            speed: 1.0,
        }
    }
}

impl AudioBackend {
    fn play_path(
        &mut self,
        path: String,
        restart: bool,
        fade: bool,
        fade_duration_ms: Option<u64>,
    ) -> Result<(), String> {
        let path = PathBuf::from(path.trim());
        if !path.is_file() {
            return self.fail("Audio file does not exist.");
        }

        let source_id = path.to_string_lossy().to_string();
        if !restart && self.current_source.as_deref() == Some(source_id.as_str()) {
            if let Some(sink) = &self.sink {
                sink.play();
                return Ok(());
            }
        }

        let file = File::open(&path).map_err(|err| err.to_string())?;
        let decoder = Decoder::try_from(file).map_err(|err| err.to_string())?;
        let duration = decoder.total_duration();
        let source = SpectrumSource::new(decoder, Arc::clone(&self.spectrum_levels));
        let stream = self.ensure_output_stream()?;
        let sink = Arc::new(Sink::connect_new(stream.mixer()));
        if fade {
            sink.set_volume(0.0);
        } else {
            sink.set_volume(self.volume);
        }
        sink.set_speed(self.speed);
        sink.append(source);
        sink.play();

        self.transition_to_sink(&sink, fade, fade_duration_ms);

        self.current_source = Some(source_id);
        self.current_duration = duration;
        self.current_cache_path = None;
        self.current_stream_state = None;
        self.last_error = None;
        self.sink = Some(sink);
        Ok(())
    }

    fn play_url(
        &mut self,
        url: String,
        restart: bool,
        fade: bool,
        fade_duration_ms: Option<u64>,
        cache_dir: PathBuf,
    ) -> Result<(), String> {
        let url = url.trim().to_string();
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return self.fail("Only HTTP and HTTPS audio URLs are supported.");
        }

        if !restart && self.current_source.as_deref() == Some(url.as_str()) {
            if let Some(sink) = &self.sink {
                sink.play();
                return Ok(());
            }
        }

        let reader = StreamingHttpReader::open(url.clone(), cache_dir)?;
        let content_length = reader.content_length();
        let stream_state = reader.shared_state();
        let cache_path = reader.cache_path();
        let mut decoder_builder = Decoder::builder().with_data(reader);
        if let Some(content_length) = content_length {
            decoder_builder = decoder_builder.with_byte_len(content_length);
        }
        let decoder = decoder_builder.build().map_err(|err| err.to_string())?;
        let duration = decoder.total_duration();
        let source = SpectrumSource::new(decoder, Arc::clone(&self.spectrum_levels));
        let stream = self.ensure_output_stream()?;
        let sink = Arc::new(Sink::connect_new(stream.mixer()));
        if fade {
            sink.set_volume(0.0);
        } else {
            sink.set_volume(self.volume);
        }
        sink.set_speed(self.speed);
        sink.append(source);
        sink.play();

        self.transition_to_sink(&sink, fade, fade_duration_ms);

        self.current_source = Some(url);
        self.current_duration = duration;
        self.current_cache_path = Some(cache_path);
        self.current_stream_state = Some(stream_state);
        self.last_error = None;
        self.sink = Some(sink);
        Ok(())
    }

    fn pause(&self, fade: bool) {
        if let Some(sink) = &self.sink {
            if fade {
                ramp_sink_volume_then_pause(Arc::clone(sink), self.volume, PAUSE_FADE_DURATION);
            } else {
                sink.pause();
            }
        }
    }

    fn resume(&self) -> Result<(), String> {
        let Some(sink) = &self.sink else {
            return Err("No active audio to resume.".to_string());
        };
        sink.play();
        Ok(())
    }

    fn stop(&mut self, fade: bool) {
        self.current_source = None;
        self.current_duration = None;
        self.current_cache_path = None;
        self.current_stream_state = None;
        clear_spectrum_levels(&self.spectrum_levels);
        self.is_crossfading.store(false, Ordering::SeqCst);
        if let Some(sink) = self.sink.take() {
            if fade {
                ramp_sink_volume_then_stop(sink, self.volume, STOP_FADE_DURATION);
            } else {
                sink.stop();
            }
        }
    }

    fn seek(&self, seconds: f64) -> Result<(), String> {
        let Some(sink) = &self.sink else {
            return Err("No active audio sink.".to_string());
        };
        sink.try_seek(Duration::from_secs_f64(seconds.max(0.0)))
            .map_err(|err| err.to_string())
    }

    fn set_volume(&mut self, volume: f32) {
        self.volume = volume.clamp(0.0, 1.0);
        if let Some(sink) = &self.sink {
            sink.set_volume(self.volume);
        }
    }

    fn set_speed(&mut self, speed: f32) {
        self.speed = speed.clamp(0.5, 2.0);
        if let Some(sink) = &self.sink {
            sink.set_speed(self.speed);
        }
    }

    fn set_output_device(&mut self, device_id: Option<String>) -> Result<(), String> {
        let device_id = device_id
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        if let Some(device_id) = &device_id {
            let _ = find_output_device(device_id)
                .ok_or_else(|| format!("Output device not found: {device_id}"))?;
        }

        self.output_device_id = device_id;
        self.stream = None;
        self.stream_device_id = None;
        Ok(())
    }

    fn transition_to_sink(&mut self, sink: &Arc<Sink>, fade: bool, fade_duration_ms: Option<u64>) {
        let previous_sink = self.sink.take();
        if !fade {
            if let Some(previous_sink) = previous_sink {
                previous_sink.stop();
            }
            return;
        }

        let duration = fade_duration(fade_duration_ms, PLAY_FADE_DURATION);
        match previous_sink {
            Some(previous_sink) => {
                crossfade_sinks(
                    previous_sink,
                    Arc::clone(sink),
                    self.volume,
                    duration,
                    Arc::clone(&self.is_crossfading),
                );
            }
            None => {
                ramp_sink_volume(Arc::clone(sink), 0.0, self.volume, duration);
            }
        }
    }

    fn fail<T>(&mut self, message: &str) -> Result<T, String> {
        self.last_error = Some(message.to_string());
        Err(message.to_string())
    }

    fn snapshot(&self) -> crate::player::PlayerSnapshot {
        let position = self
            .sink
            .as_ref()
            .map(|sink| sink.get_pos().as_secs_f64())
            .unwrap_or(0.0);
        let is_playing = self
            .sink
            .as_ref()
            .map(|sink| !sink.is_paused() && !sink.empty())
            .unwrap_or(false);

        let current_path = if is_playing || self.sink.as_ref().is_some_and(|sink| !sink.empty()) {
            self.current_source.clone()
        } else {
            None
        };
        let stream_status = self.current_stream_status();
        let source_type = self.current_source.as_deref().map(|source| {
            if source.starts_with("http://") || source.starts_with("https://") {
                "url".to_string()
            } else {
                "local".to_string()
            }
        });

        crate::player::PlayerSnapshot {
            current_path,
            position,
            is_playing,
            duration: self.current_duration.map(|duration| duration.as_secs_f64()),
            volume: self.volume,
            speed: self.speed,
            spectrum_levels: if is_playing {
                spectrum_levels_snapshot(&self.spectrum_levels)
            } else {
                vec![0.0; SPECTRUM_BANDS]
            },
            source_type,
            active_cache_path: self
                .current_cache_path
                .as_ref()
                .map(|path| path.to_string_lossy().to_string()),
            is_buffering: stream_status
                .as_ref()
                .map(|status| status.is_buffering)
                .unwrap_or(false),
            is_crossfading: self.is_crossfading.load(Ordering::SeqCst),
            last_error: stream_status
                .and_then(|status| status.error)
                .or_else(|| self.last_error.clone()),
        }
    }

    fn current_stream_status(&self) -> Option<StreamingStatus> {
        self.current_stream_state
            .as_ref()
            .and_then(|shared| shared.0.lock().ok().map(|state| state.status()))
    }

    fn ensure_output_stream(&mut self) -> Result<&OutputStream, String> {
        if self.stream.is_none() || self.stream_device_id != self.output_device_id {
            self.stream = Some(open_output_stream(self.output_device_id.as_deref())?);
            self.stream_device_id = self.output_device_id.clone();
        }
        self.stream
            .as_ref()
            .ok_or_else(|| "Audio output stream is not available.".to_string())
    }
}

fn open_output_stream(device_id: Option<&str>) -> Result<OutputStream, String> {
    match device_id.map(str::trim).filter(|id| !id.is_empty()) {
        Some(device_id) => {
            let device = find_output_device(device_id)
                .ok_or_else(|| format!("Output device not found: {device_id}"))?;
            OutputStreamBuilder::from_device(device)
                .map_err(|err| err.to_string())?
                .open_stream()
                .map_err(|err| err.to_string())
        }
        None => OutputStreamBuilder::open_default_stream().map_err(|err| err.to_string()),
    }
}

fn find_output_device(device_id: &str) -> Option<rodio::Device> {
    let host = rodio::cpal::default_host();
    host.output_devices()
        .ok()?
        .find(|device| device.name().map(|name| name == device_id).unwrap_or(false))
}

struct SpectrumSource<S> {
    inner: S,
    levels: Arc<[AtomicU32; SPECTRUM_BANDS]>,
    samples: Vec<f32>,
    sample_rate: f32,
}

impl<S> SpectrumSource<S>
where
    S: Source,
{
    fn new(inner: S, levels: Arc<[AtomicU32; SPECTRUM_BANDS]>) -> Self {
        clear_spectrum_levels(&levels);
        let sample_rate = inner.sample_rate() as f32;
        Self {
            inner,
            levels,
            samples: Vec::with_capacity(SPECTRUM_WINDOW_SAMPLES),
            sample_rate,
        }
    }
}

impl<S> Iterator for SpectrumSource<S>
where
    S: Source,
{
    type Item = f32;

    fn next(&mut self) -> Option<Self::Item> {
        let sample = self.inner.next()?;
        self.samples.push(sample);
        if self.samples.len() >= SPECTRUM_WINDOW_SAMPLES {
            update_spectrum_levels(&self.levels, &self.samples, self.sample_rate);
            self.samples.clear();
        }
        Some(sample)
    }
}

impl<S> Source for SpectrumSource<S>
where
    S: Source,
{
    fn current_span_len(&self) -> Option<usize> {
        self.inner.current_span_len()
    }

    fn channels(&self) -> rodio::ChannelCount {
        self.inner.channels()
    }

    fn sample_rate(&self) -> rodio::SampleRate {
        self.inner.sample_rate()
    }

    fn total_duration(&self) -> Option<Duration> {
        self.inner.total_duration()
    }

    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        let result = self.inner.try_seek(pos);
        if result.is_ok() {
            self.samples.clear();
            clear_spectrum_levels(&self.levels);
        }
        result
    }
}

fn clear_spectrum_levels(levels: &[AtomicU32; SPECTRUM_BANDS]) {
    for level in levels {
        level.store(0.0f32.to_bits(), Ordering::Relaxed);
    }
}

fn spectrum_levels_snapshot(levels: &[AtomicU32; SPECTRUM_BANDS]) -> Vec<f32> {
    levels
        .iter()
        .map(|level| f32::from_bits(level.load(Ordering::Relaxed)).clamp(0.0, 1.0))
        .collect()
}

fn update_spectrum_levels(levels: &[AtomicU32; SPECTRUM_BANDS], samples: &[f32], sample_rate: f32) {
    if samples.is_empty() || sample_rate <= 0.0 {
        return;
    }

    for (index, frequency) in SPECTRUM_FREQUENCIES.iter().enumerate() {
        let energy = goertzel_energy(samples, sample_rate, *frequency);
        let level = (energy * 8.5).sqrt().clamp(0.0, 1.0);
        levels[index].store(level.to_bits(), Ordering::Relaxed);
    }
}

fn goertzel_energy(samples: &[f32], sample_rate: f32, frequency: f32) -> f32 {
    let normalized = frequency / sample_rate;
    let coefficient = 2.0 * (2.0 * std::f32::consts::PI * normalized).cos();
    let mut previous = 0.0;
    let mut previous2 = 0.0;

    for (index, sample) in samples.iter().enumerate() {
        let window = 0.5
            - 0.5
                * ((2.0 * std::f32::consts::PI * index as f32)
                    / (samples.len().saturating_sub(1).max(1) as f32))
                    .cos();
        let value = sample * window + coefficient * previous - previous2;
        previous2 = previous;
        previous = value;
    }

    let power = previous2 * previous2 + previous * previous - coefficient * previous * previous2;
    (power / samples.len() as f32).max(0.0)
}

struct StreamingHttpReader {
    shared: Arc<(Mutex<StreamingHttpState>, Condvar)>,
    file: File,
    position: u64,
}

struct StreamingHttpState {
    cache_path: PathBuf,
    content_length: Option<u64>,
    cached_ranges: Vec<(u64, u64)>,
    requested_range_start: Option<u64>,
    supports_range: bool,
    completed: bool,
    is_buffering: bool,
    error: Option<String>,
}

struct StreamingStatus {
    is_buffering: bool,
    error: Option<String>,
}

impl StreamingHttpState {
    fn status(&self) -> StreamingStatus {
        StreamingStatus {
            is_buffering: self.is_buffering && !self.is_fully_cached() && self.error.is_none(),
            error: self.error.clone(),
        }
    }

    fn cached_end_for(&self, position: u64) -> Option<u64> {
        self.cached_ranges
            .iter()
            .find_map(|(start, end)| (*start <= position && position < *end).then_some(*end))
    }

    fn is_fully_cached(&self) -> bool {
        let Some(content_length) = self.content_length else {
            return self.completed;
        };
        self.cached_end_for(0)
            .map(|end| end >= content_length)
            .unwrap_or(false)
    }

    fn add_cached_range(&mut self, start: u64, end: u64) {
        if end <= start {
            return;
        }
        self.cached_ranges.push((start, end));
        self.cached_ranges.sort_by_key(|range| range.0);

        let mut merged: Vec<(u64, u64)> = Vec::new();
        for (start, end) in self.cached_ranges.drain(..) {
            if let Some((_, merged_end)) = merged.last_mut() {
                if start <= *merged_end {
                    *merged_end = (*merged_end).max(end);
                    continue;
                }
            }
            merged.push((start, end));
        }
        self.cached_ranges = merged;
    }
}

impl StreamingHttpReader {
    fn open(url: String, cache_dir: PathBuf) -> Result<Self, String> {
        let client = audio_http_client()?;
        let response = client.get(&url).send().map_err(|err| err.to_string())?;
        if !response.status().is_success() {
            return Err(format!(
                "Audio URL request failed with status {}.",
                response.status()
            ));
        }
        let content_length = response.content_length();
        let supports_range = response
            .headers()
            .get(reqwest::header::ACCEPT_RANGES)
            .and_then(|value| value.to_str().ok())
            .map(|value| value.eq_ignore_ascii_case("bytes"))
            .unwrap_or(false);

        fs::create_dir_all(&cache_dir).map_err(|err| err.to_string())?;
        let cache_path = create_cache_file_path(&cache_dir, &url);
        let writer = OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .open(&cache_path)
            .map_err(|err| err.to_string())?;
        let file = OpenOptions::new()
            .read(true)
            .open(&cache_path)
            .map_err(|err| err.to_string())?;
        let shared = Arc::new((
            Mutex::new(StreamingHttpState {
                cache_path: cache_path.clone(),
                content_length,
                cached_ranges: Vec::new(),
                requested_range_start: None,
                supports_range,
                completed: false,
                is_buffering: false,
                error: None,
            }),
            Condvar::new(),
        ));
        let writer_shared = Arc::clone(&shared);

        thread::spawn(move || {
            download_http_stream(url, response, writer, writer_shared);
        });

        Ok(Self {
            shared,
            file,
            position: 0,
        })
    }

    fn content_length(&self) -> Option<u64> {
        self.shared
            .0
            .lock()
            .ok()
            .and_then(|state| state.content_length)
    }

    fn cache_path(&self) -> PathBuf {
        self.shared
            .0
            .lock()
            .map(|state| state.cache_path.clone())
            .unwrap_or_default()
    }

    fn shared_state(&self) -> Arc<(Mutex<StreamingHttpState>, Condvar)> {
        Arc::clone(&self.shared)
    }
}

impl Read for StreamingHttpReader {
    fn read(&mut self, out: &mut [u8]) -> io::Result<usize> {
        if out.is_empty() {
            return Ok(0);
        }

        let (lock, cvar) = &*self.shared;
        let mut state = lock
            .lock()
            .map_err(|_| io::Error::other("stream lock poisoned"))?;

        loop {
            if let Some(error) = &state.error {
                return Err(io::Error::other(error.clone()));
            }

            if let Some(content_length) = state.content_length {
                if self.position >= content_length {
                    state.is_buffering = false;
                    return Ok(0);
                }
            }

            if let Some(cached_end) = state.cached_end_for(self.position) {
                let max_count = out.len().min((cached_end - self.position) as usize);
                let start = self.position;
                state.is_buffering = false;
                drop(state);

                self.file.seek(SeekFrom::Start(start))?;
                let count = self.file.read(&mut out[..max_count])?;
                self.position += count as u64;
                return Ok(count);
            }

            if state.is_fully_cached() {
                state.is_buffering = false;
                return Ok(0);
            }

            state.is_buffering = true;
            if state.supports_range {
                state.requested_range_start = Some(self.position);
                cvar.notify_all();
            }
            state = cvar
                .wait(state)
                .map_err(|_| io::Error::other("stream lock poisoned"))?;
        }
    }
}

impl Seek for StreamingHttpReader {
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        let state = self
            .shared
            .0
            .lock()
            .map_err(|_| io::Error::other("stream lock poisoned"))?;
        let end = state
            .content_length
            .or_else(|| state.cached_ranges.iter().map(|(_, end)| *end).max());

        let next_position = match pos {
            SeekFrom::Start(position) => position as i128,
            SeekFrom::Current(offset) => self.position as i128 + offset as i128,
            SeekFrom::End(offset) => {
                let Some(end) = end else {
                    return Err(io::Error::new(
                        io::ErrorKind::Unsupported,
                        "cannot seek from end before content length is known",
                    ));
                };
                end as i128 + offset as i128
            }
        };

        if next_position < 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "cannot seek before start of stream",
            ));
        }

        self.position = next_position as u64;
        Ok(self.position)
    }
}

fn download_http_stream(
    url: String,
    mut response: reqwest::blocking::Response,
    mut writer: File,
    shared: Arc<(Mutex<StreamingHttpState>, Condvar)>,
) {
    let client = match audio_http_client() {
        Ok(client) => client,
        Err(error) => {
            mark_http_stream_failed(&shared, error);
            return;
        }
    };
    let mut range_start = 0_u64;

    loop {
        match download_http_response(&mut response, &mut writer, &shared, range_start) {
            DownloadRangeResult::Completed => {
                let next_start = take_requested_range_start(&shared);
                let Some(next_start) = next_start else {
                    mark_http_stream_completed(&shared);
                    return;
                };
                match request_http_range(&client, &url, next_start) {
                    Ok((next_response, start)) => {
                        response = next_response;
                        range_start = start;
                    }
                    Err(error) => {
                        mark_http_stream_failed(&shared, error);
                        return;
                    }
                }
            }
            DownloadRangeResult::SwitchRange(next_start) => {
                match request_http_range(&client, &url, next_start) {
                    Ok((next_response, start)) => {
                        response = next_response;
                        range_start = start;
                    }
                    Err(error) => {
                        mark_http_stream_failed(&shared, error);
                        return;
                    }
                }
            }
            DownloadRangeResult::Failed(error) => {
                mark_http_stream_failed(&shared, error);
                return;
            }
        }
    }
}

enum DownloadRangeResult {
    Completed,
    SwitchRange(u64),
    Failed(String),
}

fn download_http_response(
    response: &mut reqwest::blocking::Response,
    writer: &mut File,
    shared: &Arc<(Mutex<StreamingHttpState>, Condvar)>,
    start: u64,
) -> DownloadRangeResult {
    let mut chunk = [0_u8; 64 * 1024];
    let mut position = start;

    loop {
        if let Some(next_start) = take_requested_range_start(shared) {
            if next_start != position {
                return DownloadRangeResult::SwitchRange(next_start);
            }
        }

        match response.read(&mut chunk) {
            Ok(0) => return DownloadRangeResult::Completed,
            Ok(count) => {
                if let Err(error) = writer
                    .seek(SeekFrom::Start(position))
                    .and_then(|_| writer.write_all(&chunk[..count]))
                    .and_then(|_| writer.flush())
                {
                    return DownloadRangeResult::Failed(error.to_string());
                }
                let chunk_start = position;
                let end = position + count as u64;
                position = end;

                let (lock, cvar) = &**shared;
                if let Ok(mut state) = lock.lock() {
                    state.add_cached_range(chunk_start, end);
                    state.is_buffering = false;
                    cvar.notify_all();
                } else {
                    return DownloadRangeResult::Failed("stream lock poisoned".to_string());
                }
            }
            Err(error) => return DownloadRangeResult::Failed(error.to_string()),
        }
    }
}

fn take_requested_range_start(shared: &Arc<(Mutex<StreamingHttpState>, Condvar)>) -> Option<u64> {
    let (lock, _) = &**shared;
    let Ok(mut state) = lock.lock() else {
        return None;
    };
    let requested = state.requested_range_start.take()?;
    if state.cached_end_for(requested).is_some() {
        return None;
    }
    Some(requested)
}

fn audio_http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .connect_timeout(HTTP_STREAM_CONNECT_TIMEOUT)
        .timeout(HTTP_STREAM_READ_TIMEOUT)
        .build()
        .map_err(|err| err.to_string())
}

fn request_http_range(
    client: &reqwest::blocking::Client,
    url: &str,
    start: u64,
) -> Result<(reqwest::blocking::Response, u64), String> {
    let response = client
        .get(url)
        .header(reqwest::header::RANGE, format!("bytes={start}-"))
        .send()
        .map_err(|err| err.to_string())?;

    if response.status() == reqwest::StatusCode::PARTIAL_CONTENT {
        return Ok((response, start));
    }

    if response.status().is_success() {
        return Ok((response, 0));
    }

    Err(format!(
        "Audio range request failed with status {}.",
        response.status()
    ))
}

fn mark_http_stream_completed(shared: &Arc<(Mutex<StreamingHttpState>, Condvar)>) {
    let (lock, cvar) = &**shared;
    if let Ok(mut state) = lock.lock() {
        state.completed = true;
        state.is_buffering = false;
        cvar.notify_all();
    }
}

fn mark_http_stream_failed(shared: &Arc<(Mutex<StreamingHttpState>, Condvar)>, error: String) {
    let (lock, cvar) = &**shared;
    if let Ok(mut state) = lock.lock() {
        state.error = Some(error);
        state.completed = true;
        state.is_buffering = false;
        cvar.notify_all();
    }
}

fn create_cache_file_path(cache_dir: &PathBuf, url: &str) -> PathBuf {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let mut hasher = DefaultHasher::new();
    url.hash(&mut hasher);
    timestamp.hash(&mut hasher);
    let name = format!(
        "{}{:x}-{}.{}",
        CACHE_FILE_PREFIX,
        hasher.finish(),
        timestamp,
        CACHE_FILE_EXTENSION
    );
    cache_dir.join(name)
}

fn ramp_sink_volume(sink: Arc<Sink>, from: f32, to: f32, duration: Duration) {
    thread::spawn(move || {
        ramp_sink_volume_blocking(&sink, from, to, duration);
    });
}

fn crossfade_sinks(
    old_sink: Arc<Sink>,
    new_sink: Arc<Sink>,
    volume: f32,
    duration: Duration,
    is_crossfading: Arc<AtomicBool>,
) {
    thread::spawn(move || {
        is_crossfading.store(true, Ordering::SeqCst);
        let steps = ramp_steps(duration);
        let step_duration = duration / steps;
        for step in 0..=steps {
            let t = step as f32 / steps as f32;
            let eased = smoothstep(t);
            old_sink.set_volume(volume * equal_power_out(eased));
            new_sink.set_volume(volume * equal_power_in(eased));
            thread::sleep(step_duration);
        }
        old_sink.stop();
        new_sink.set_volume(volume);
        is_crossfading.store(false, Ordering::SeqCst);
    });
}

fn ramp_sink_volume_then_pause(sink: Arc<Sink>, from: f32, duration: Duration) {
    thread::spawn(move || {
        ramp_sink_volume_blocking(&sink, from, 0.0, duration);
        sink.pause();
        sink.set_volume(from);
    });
}

fn ramp_sink_volume_then_stop(sink: Arc<Sink>, from: f32, duration: Duration) {
    thread::spawn(move || {
        ramp_sink_volume_blocking(&sink, from, 0.0, duration);
        sink.stop();
    });
}

fn ramp_sink_volume_blocking(sink: &Sink, from: f32, to: f32, duration: Duration) {
    let steps = ramp_steps(duration);
    let step_duration = duration / steps;
    for step in 0..=steps {
        let t = step as f32 / steps as f32;
        let eased = smoothstep(t);
        sink.set_volume(from + (to - from) * eased);
        thread::sleep(step_duration);
    }
}

fn ramp_steps(duration: Duration) -> u32 {
    ((duration.as_millis() / 16).max(1)) as u32
}

fn smoothstep(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn equal_power_in(t: f32) -> f32 {
    (t.clamp(0.0, 1.0) * std::f32::consts::FRAC_PI_2).sin()
}

fn equal_power_out(t: f32) -> f32 {
    (t.clamp(0.0, 1.0) * std::f32::consts::FRAC_PI_2).cos()
}

fn fade_duration(requested_ms: Option<u64>, fallback: Duration) -> Duration {
    requested_ms
        .map(|ms| ms.clamp(MIN_CROSSFADE_DURATION_MS, MAX_CROSSFADE_DURATION_MS))
        .map(Duration::from_millis)
        .unwrap_or(fallback)
}

fn response_from_result<F>(id: String, action: F) -> WorkerMessage
where
    F: FnOnce() -> Result<(), String>,
{
    match action() {
        Ok(()) => WorkerMessage::Response {
            id,
            ok: true,
            payload: None,
            error: None,
        },
        Err(error) => WorkerMessage::Response {
            id,
            ok: false,
            payload: None,
            error: Some(error),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handles_ping_request() {
        let mut runtime = AudioWorkerRuntime {
            backend: AudioBackend::default(),
            cache_dir: "D:\\cache".to_string(),
            started_at_ms: 1,
        };
        let response = handle_request(
            &mut runtime,
            WorkerRequest {
                id: "ping-1".to_string(),
                method: methods::WORKER_PING.to_string(),
                payload: json!({}),
            },
        );

        assert_eq!(
            response,
            WorkerMessage::Response {
                id: "ping-1".to_string(),
                ok: true,
                payload: Some(json!({
                    "pong": true,
                    "worker": "audio",
                    "cacheDir": "D:\\cache",
                })),
                error: None,
            }
        );
    }

    #[test]
    fn smoothstep_clamps_and_eases() {
        assert_eq!(smoothstep(-1.0), 0.0);
        assert_eq!(smoothstep(0.0), 0.0);
        assert!((smoothstep(0.5) - 0.5).abs() < f32::EPSILON);
        assert_eq!(smoothstep(1.0), 1.0);
        assert_eq!(smoothstep(2.0), 1.0);
    }

    #[test]
    fn equal_power_crossfade_preserves_midpoint_energy() {
        let midpoint = 0.5;
        let input = equal_power_in(midpoint);
        let output = equal_power_out(midpoint);

        assert!((input - output).abs() < 0.0001);
        assert!(((input * input + output * output) - 1.0).abs() < 0.0001);
    }

    #[test]
    fn fade_duration_clamps_requested_crossfade() {
        assert_eq!(
            fade_duration(Some(1), PLAY_FADE_DURATION),
            Duration::from_millis(MIN_CROSSFADE_DURATION_MS)
        );
        assert_eq!(
            fade_duration(Some(60_000), PLAY_FADE_DURATION),
            Duration::from_millis(MAX_CROSSFADE_DURATION_MS)
        );
        assert_eq!(fade_duration(None, PLAY_FADE_DURATION), PLAY_FADE_DURATION);
    }

    #[test]
    fn streaming_reader_can_seek_from_end_when_content_length_is_known() {
        let cache_path = std::env::temp_dir().join(format!(
            "mono-stream-seek-test-{}.audio",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_nanos())
                .unwrap_or_default()
        ));
        fs::write(&cache_path, [0_u8; 8]).expect("fixture cache should be written");
        let file = OpenOptions::new()
            .read(true)
            .open(&cache_path)
            .expect("fixture cache should open");
        let shared = Arc::new((
            Mutex::new(StreamingHttpState {
                cache_path: cache_path.clone(),
                content_length: Some(8),
                cached_ranges: vec![(0, 8)],
                requested_range_start: None,
                supports_range: true,
                completed: false,
                is_buffering: false,
                error: None,
            }),
            Condvar::new(),
        ));
        let mut reader = StreamingHttpReader {
            shared,
            file,
            position: 0,
        };

        let position = reader
            .seek(SeekFrom::End(-4))
            .expect("known content length should allow end-relative seeks");

        assert_eq!(position, 4);
        let _ = fs::remove_file(cache_path);
    }

    #[test]
    fn streaming_state_merges_cached_ranges() {
        let mut state = StreamingHttpState {
            cache_path: PathBuf::from("cache.audio"),
            content_length: Some(10),
            cached_ranges: Vec::new(),
            requested_range_start: None,
            supports_range: true,
            completed: false,
            is_buffering: false,
            error: None,
        };

        state.add_cached_range(4, 6);
        state.add_cached_range(0, 4);
        state.add_cached_range(6, 10);

        assert_eq!(state.cached_end_for(0), Some(10));
        assert_eq!(state.cached_ranges, vec![(0, 10)]);
        assert!(state.is_fully_cached());
    }
}
