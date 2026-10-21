use crate::{models::plugin_api::{Error, Result}, player};
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Empty {}

fn parse<T: serde::de::DeserializeOwned>(params: &Value) -> Result<T> {
    serde_json::from_value(params.clone()).map_err(|_| Error::new("INVALID_ARGUMENT", "Invalid player parameters"))
}

fn internal(_: String) -> Error { Error::new("INTERNAL", "Player operation failed") }

pub(super) fn dispatch(app: &AppHandle, method: &str, params: &Value) -> Result<Value> {
    match method {
        "player.getState" => {
            parse::<Empty>(params)?;
            let state = player::mcp_player_state(app).map_err(internal)?;
            // Do not expose audio frames, file paths, or decoder errors through player.read.
            Ok(json!({"position":state.position,"duration":state.duration,"isPlaying":state.is_playing,
                "mode":public_mode(crate::player::mcp_queue_snapshot(app).map_err(internal)?.playback_mode.as_str()),"volume":state.volume,"isMuted":state.is_muted,"rate":state.speed,"isBuffering":state.is_buffering}))
        }
        "player.playTrack" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase", deny_unknown_fields)]
            struct Play { track_id: String }
            let params: Play = parse(params)?;
            let track = super::library::resolve_in_app(app, &params.track_id)?;
            player::mcp_play_track(app, track).map_err(internal)?;
            Ok(Value::Null)
        }
        "player.seek" => {
            #[derive(Deserialize)]
            #[serde(deny_unknown_fields)]
            struct Seek { position: f64 }
            let params: Seek = parse(params)?;
            validate_number(params.position, 0.0, f64::MAX)?;
            player::mcp_seek(app, params.position).map_err(internal)?;
            Ok(Value::Null)
        }
        "player.setVolume" => {
            #[derive(Deserialize)]
            #[serde(deny_unknown_fields)]
            struct Volume { volume: f64 }
            let params: Volume = parse(params)?;
            validate_number(params.volume, 0.0, 1.0)?;
            player::mcp_set_volume(app, params.volume as f32).map_err(internal)?;
            Ok(Value::Null)
        }
        "player.setRate" => {
            #[derive(Deserialize)]
            #[serde(deny_unknown_fields)]
            struct Rate { rate: f64 }
            let input: Rate = parse(params)?;
            validate_number(input.rate, 0.5, 2.0)?;
            app.state::<crate::workers::audio::AudioWorkerState>().set_speed(input.rate as f32).map_err(internal)?;
            Ok(Value::Null)
        }
        "player.setMuted" => {
            #[derive(Deserialize)]
            #[serde(deny_unknown_fields)]
            struct Muted { muted: bool }
            let input: Muted = parse(params)?;
            app.state::<crate::workers::audio::AudioWorkerState>().set_muted(input.muted).map_err(internal)?;
            Ok(Value::Null)
        }
        "player.setMode" => {
            #[derive(Deserialize)]
            #[serde(deny_unknown_fields)]
            struct Mode { mode: String }
            let input: Mode = parse(params)?;
            let mode = match input.mode.as_str() { "loop"=>"repeat", "single"=>"fixed", "shuffle"=>"shuffle", "order"=>"order", "once"=>"once", _=>return Err(Error::new("INVALID_ARGUMENT","Unknown playback mode")) };
            let response = player::player_set_playback_mode(app.clone(), app.state::<player::PlayerState>(), mode.into());
            if response.code != 1 { return Err(internal(response.message)); }
            Ok(Value::Null)
        }
        "player.play" | "player.pause" | "player.stop" | "player.next" | "player.previous" => {
            parse::<Empty>(params)?;
            match method {
                "player.play" => player::mcp_resume(app),
                "player.pause" => player::mcp_pause(app),
                "player.stop" => player::mcp_stop(app),
                "player.next" => player::mcp_next(app).map(|_| ()),
                _ => player::mcp_previous(app).map(|_| ()),
            }.map_err(internal)?;
            Ok(Value::Null)
        }
        _ => Err(Error::new("UNSUPPORTED", "Unknown player method")),
    }
}

fn public_mode(mode:&str) -> &str {
    match mode { "repeat"=>"loop", "fixed"=>"single", "shuffle"=>"shuffle", "order"=>"order", "once"=>"once", _=>"loop" }
}

fn validate_number(value: f64, min: f64, max: f64) -> Result<()> {
    if !value.is_finite() || value < min || value > max {
        return Err(Error::new("INVALID_ARGUMENT", "Player value out of range"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unknown_parameters_and_invalid_ranges() {
        assert!(parse::<Empty>(&json!({"pluginId":"another"})).is_err());
        for value in [-1.0, 1.1, f64::NAN, f64::INFINITY] { assert!(validate_number(value,0.0,1.0).is_err()); }
        assert!(validate_number(0.72,0.0,1.0).is_ok());
    }
}
