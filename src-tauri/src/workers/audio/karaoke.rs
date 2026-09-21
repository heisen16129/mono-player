use super::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SwitchPayload {
    pub source: String,
    pub accompaniment: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stale_karaoke_request_cannot_start_playback() {
        let mut backend = AudioBackend::default();
        assert!(backend
            .switch_karaoke(SwitchPayload {
                source: "old.wav".into(),
                accompaniment: Some("stem.wav".into())
            })
            .is_err());
        assert!(backend.sink.is_none());
    }

    #[test]
    #[ignore = "Requires an audio output device; plays silent generated WAVs"]
    fn karaoke_switch_preserves_identity_position_and_pause() {
        let root = std::env::temp_dir().join(format!("mono-karaoke-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let original = root.join("原声.wav");
        let accompaniment = root.join("伴奏.wav");
        let bytes = 44100u32 * 2 * 10;
        let mut wav = Vec::new();
        wav.extend(b"RIFF");
        wav.extend((36 + bytes).to_le_bytes());
        wav.extend(b"WAVEfmt ");
        wav.extend(16u32.to_le_bytes());
        wav.extend(1u16.to_le_bytes());
        wav.extend(1u16.to_le_bytes());
        wav.extend(44100u32.to_le_bytes());
        wav.extend(88200u32.to_le_bytes());
        wav.extend(2u16.to_le_bytes());
        wav.extend(16u16.to_le_bytes());
        wav.extend(b"data");
        wav.extend(bytes.to_le_bytes());
        wav.resize(44 + bytes as usize, 0);
        fs::write(&original, &wav).unwrap();
        fs::write(&accompaniment, &wav).unwrap();
        fs::write(root.join("vocals.wav"), &wav).unwrap();
        let mut backend = AudioBackend::default();
        backend.volume = 0.0;
        let source = original.to_string_lossy().into_owned();
        backend
            .play_path(source.clone(), true, false, None)
            .unwrap();
        backend.pause(false);
        backend.seek(3.0).unwrap();
        let before = backend.snapshot();
        backend
            .switch_karaoke(SwitchPayload {
                source: source.clone(),
                accompaniment: Some(accompaniment.to_string_lossy().into_owned()),
            })
            .unwrap();
        let after = backend.snapshot();
        assert!(after.is_karaoke);
        assert_eq!(after.current_path, before.current_path);
        assert!(!after.is_playing);
        assert!((after.position - before.position).abs() < 0.1);
        assert_eq!(backend.current_cache_path, Some(accompaniment));
        assert!(backend
            .switch_karaoke(SwitchPayload {
                source: "changed.wav".into(),
                accompaniment: None
            })
            .is_err());
        backend
            .switch_karaoke(SwitchPayload {
                source: source.clone(),
                accompaniment: None,
            })
            .unwrap();
        assert!(!backend.snapshot().is_karaoke);
        assert_eq!(backend.current_cache_path, Some(original.clone()));
        assert!((backend.snapshot().position - before.position).abs() < 0.1);
        backend.resume().unwrap();
        backend
            .switch_karaoke(SwitchPayload {
                source,
                accompaniment: Some(root.join("伴奏.wav").to_string_lossy().into_owned()),
            })
            .unwrap();
        assert!(backend.snapshot().is_playing);
        backend.stop(false);
        drop(backend);
        fs::remove_file(original).unwrap();
        fs::remove_file(root.join("伴奏.wav")).unwrap();
        fs::remove_file(root.join("vocals.wav")).unwrap();
        fs::remove_dir(root).unwrap();
    }
}

impl AudioWorkerState {
    pub(crate) fn set_karaoke_vocals(&self, source: String, gain: f32) -> Result<(), String> {
        self.expect_ok(WorkerRequest { id: "karaoke-vocals".into(), method: methods::PLAYER_KARAOKE_VOCALS.into(), payload: json!({"source": source, "gain": gain}) })
    }
    pub(crate) fn karaoke_source(&self, source: &str) -> Result<PathBuf, String> {
        self.deserialize_response(WorkerRequest {
            id: "karaoke-source".into(),
            method: methods::PLAYER_KARAOKE_SOURCE.into(),
            payload: json!({"source": source}),
        })
    }

    pub(crate) fn switch_karaoke(
        &self,
        source: &str,
        accompaniment: Option<String>,
    ) -> Result<(), String> {
        self.expect_ok(WorkerRequest {
            id: "karaoke-switch".into(),
            method: methods::PLAYER_KARAOKE_SWITCH.into(),
            payload: json!({"source": source, "accompaniment": accompaniment}),
        })
    }
}

impl AudioBackend {
    pub(super) fn karaoke_source(&self, source: &str) -> Result<PathBuf, String> {
        let snapshot = self.snapshot();
        if snapshot.current_path.is_none() {
            return Err("音频尚未加载，请开始播放后使用 K歌。".into());
        }
        if snapshot.current_path.as_deref() != Some(source) {
            return Err("歌曲已切换，请重新选择 K歌。".into());
        }
        if let Some(original) = &self.karaoke_original {
            return Ok(original.clone());
        }
        if let Some(shared) = &self.current_stream_state {
            let state = shared.0.lock().map_err(|e| e.to_string())?;
            if !state.completed || state.error.is_some() {
                return Err("歌曲尚未缓存完整，请稍候再选择 K歌，或先下载歌曲。".into());
            }
            return self
                .current_cache_path
                .clone()
                .ok_or("未找到完整音频缓存。".into());
        }
        let path = PathBuf::from(source);
        if source.starts_with("https://") || source.starts_with("http://") {
            if let Some(cache) = self.current_cache_path.as_ref().filter(|p| p.is_file()) {
                return Ok(cache.clone());
            }
        }
        if !path.is_file() {
            return Err("请先播放本地或已缓存完整的歌曲。".into());
        }
        Ok(path)
    }

    pub(super) fn switch_karaoke(&mut self, payload: SwitchPayload) -> Result<(), String> {
        let original = self.karaoke_source(&payload.source)?;
        let target = payload
            .accompaniment
            .as_ref()
            .map(PathBuf::from)
            .unwrap_or_else(|| original.clone());
        let previous = self.snapshot();
        // Prepare and seek a paused sink before replacing the audible one.
        // The logical source stays unchanged so queue, cover and lyrics keep their identity.
        let decoder = decode_local_file(&target)?;
        let duration = decoder.total_duration();
        let vocals = if payload.accompaniment.is_some() {
            let path = target.with_file_name("vocals.wav");
            if path.is_file() { Some(decode_local_file(&path)?) } else { None }
        } else { None };
        if vocals.as_ref().is_some_and(|v| v.channels() != decoder.channels() || v.sample_rate() != decoder.sample_rate()) {
            return Err("人声和伴奏格式不匹配，请重新分离。".into());
        }
        self.karaoke_vocal_gain = Arc::new(AtomicU32::new(0.0f32.to_bits()));
        let decoder = super::karaoke_mix::KaraokeMix { accompaniment: decoder, vocals, gain: self.karaoke_vocal_gain.clone() };
        let stream = self.ensure_output_stream()?;
        let sink = Arc::new(Sink::connect_new(stream.mixer()));
        sink.pause();
        sink.set_volume(self.volume);
        sink.set_speed(self.speed);
        sink.append(SpectrumSource::new(
            decoder,
            Arc::clone(&self.spectrum_levels),
            Arc::clone(&self.audio_frame),
        ));
        sink.try_seek(Duration::from_secs_f64(previous.position.max(0.0)))
            .map_err(|e| e.to_string())?;
        self.transition_to_sink(&sink, false, None);
        self.current_duration = duration;
        self.current_cache_path = Some(target);
        self.current_stream_state = None;
        self.karaoke_original = payload.accompaniment.map(|_| original);
        self.sink = Some(sink.clone());
        if previous.is_playing {
            sink.play();
        }
        Ok(())
    }
}
