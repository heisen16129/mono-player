use super::authorization::Principal;
use crate::models::plugin_api::{Error, Request, Result};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, sync::Mutex, time::{Duration, Instant}};
use tauri::{AppHandle, Manager};

#[derive(Default)]
pub(crate) struct State(Mutex<HashMap<String, Subscription>>);
struct Subscription { owner: (String,String,String), topics: Vec<String>, revisions: HashMap<String,String>, touched: Instant, polled:Option<Instant>, sequence:u64 }
impl State {
    pub(super) fn release(&self, principal:&Principal) {
        if let Ok(mut records)=self.0.lock() { records.retain(|_,s|s.owner!=owner(principal)); }
    }

    pub(super) fn revoke(&self, invalid:impl Fn(&Principal)->bool) {
        if let Ok(mut records)=self.0.lock() {
            records.retain(|_,s|!invalid(&Principal{plugin_id:s.owner.0.clone(),package_revision:s.owner.1.clone(),surface:s.owner.2.clone()}));
        }
    }
}
fn owner(p: &Principal) -> (String,String,String) { (p.plugin_id.clone(),p.package_revision.clone(),p.surface.clone()) }
fn invalid() -> Error { Error::new("INVALID_ARGUMENT","Invalid subscription") }
fn read(app: &AppHandle, principal: &Principal, topic: &str) -> Result<Value> {
    let method = match topic {
        "player" => "player.getState", "queue" => "queue.get", "library" => "library.listTracks",
        "config" => "config.get", "environment" => "host.getInfo",
        "favorites" => "favorites.list", "playlists" => "playlists.list",
        "audio" => {
            let values=crate::store::read_values(app).map_err(|_|Error::new("INTERNAL","Cannot read permissions"))?;
            super::authorization::authorize(principal,
                values.get("plugins.installed").and_then(Value::as_array).and_then(|items|items.iter().find(|p|p["id"]==principal.plugin_id)),
                values.get("plugins.api.grants").and_then(|g|g.get(&principal.plugin_id)),Some("audio.read"))?;
            let frame=crate::player::mcp_player_state(app).map_err(|_|Error::new("INTERNAL","Cannot read audio"))?.audio_frame;
            return Ok(json!(frame));
        }
        _ => return Err(invalid()),
    };
    let result=super::dispatch(app,principal,&Request{api_version:1,request_id:"subscription-read".into(),method:method.into(),params:json!({})});
    if result["ok"]!=true {
        return Err(Error::new("PERMISSION_DENIED","Subscription permission is unavailable"));
    }
    Ok(result["data"].clone())
}

pub(super) fn dispatch(app: &AppHandle, principal: &Principal, method: &str, params: &Value) -> Result<Value> {
    let state=app.state::<State>();
    if matches!(method,"events.subscribe"|"audio.subscribeFrames") {
        #[derive(Deserialize)] #[serde(deny_unknown_fields)]
        struct Input { topics: Vec<String> }
        let topics=if method=="audio.subscribeFrames" {
            if !params.as_object().is_some_and(|p|p.is_empty()) { return Err(invalid()); }
            vec!["audio".into()]
        } else { serde_json::from_value::<Input>(params.clone()).map_err(|_|invalid())?.topics };
        if topics.is_empty() || topics.len()>8 || topics.iter().collect::<std::collections::HashSet<_>>().len()!=topics.len() { return Err(invalid()); }
        for topic in &topics { read(app,principal,topic)?; }
        let mut records=state.0.lock().map_err(|_|Error::new("INTERNAL","Subscriptions unavailable"))?;
        records.retain(|_,s|s.touched.elapsed()<Duration::from_secs(120));
        if records.values().filter(|s|s.owner.0==principal.plugin_id).count()>=32 { return Err(invalid()); }
        let id=uuid::Uuid::new_v4().to_string();
        records.insert(id.clone(),Subscription{owner:owner(principal),topics,revisions:HashMap::new(),touched:Instant::now(),polled:None,sequence:0});
        return Ok(json!({"subscriptionId":id}));
    }
    #[derive(Deserialize)] #[serde(rename_all="camelCase",deny_unknown_fields)]
    struct Input { subscription_id:String }
    let input:Input=serde_json::from_value(params.clone()).map_err(|_|invalid())?;
    let mut records=state.0.lock().map_err(|_|Error::new("INTERNAL","Subscriptions unavailable"))?;
    let record=records.get_mut(&input.subscription_id).filter(|s|s.owner==owner(principal) && s.touched.elapsed()<Duration::from_secs(120))
        .ok_or_else(||Error::new("NOT_FOUND","Subscription unavailable"))?;
    if matches!(method,"events.unsubscribe"|"audio.unsubscribeFrames") { records.remove(&input.subscription_id); return Ok(Value::Null); }
    if method!="events.poll" { return Err(invalid()); }
    record.touched=Instant::now();
    let interval=if record.topics.iter().any(|t|t=="audio") {50} else {250};
    if record.polled.is_some_and(|time|time.elapsed()<Duration::from_millis(interval)) { return Ok(json!([])); }
    record.polled=Some(Instant::now());
    let mut events=Vec::new();
    for topic in &record.topics {
        let data=read(app,principal,topic)?;
        let revision=format!("{:x}",Sha256::digest(data.to_string().as_bytes()));
        if record.revisions.get(topic)!=Some(&revision) {
            record.revisions.insert(topic.clone(),revision.clone());
            record.sequence += 1;
            events.push(json!({"subscriptionId":input.subscription_id,"sequence":record.sequence,"topic":topic,"revision":revision,"data":data}));
        }
    }
    Ok(json!(events))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn closing_or_revoking_a_surface_only_releases_its_subscriptions() {
        let state=State::default();
        let first=Principal{plugin_id:"one".into(),package_revision:"a".into(),surface:"page".into()};
        let other=Principal{plugin_id:"two".into(),package_revision:"b".into(),surface:"page".into()};
        for (id,principal) in [("first",&first),("other",&other)] {
            state.0.lock().unwrap().insert(id.into(),Subscription{owner:owner(principal),topics:vec!["player".into()],revisions:HashMap::new(),touched:Instant::now(),polled:None,sequence:0});
        }
        state.release(&first);
        assert_eq!(state.0.lock().unwrap().len(),1);
        state.revoke(|p|p.package_revision=="old");
        assert_eq!(state.0.lock().unwrap().len(),1);
        state.revoke(|p|p.plugin_id=="two");
        assert!(state.0.lock().unwrap().is_empty());
    }
}
