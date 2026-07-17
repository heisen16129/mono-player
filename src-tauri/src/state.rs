use rusqlite::Connection;
use std::sync::Mutex;

pub(crate) struct AppState {
    pub(crate) db: Mutex<Connection>,
}
