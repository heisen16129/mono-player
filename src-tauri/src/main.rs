fn main() {
    match mono_player_lib::run_worker_from_args() {
        Ok(true) => return,
        Ok(false) => {}
        Err(err) => {
            eprintln!("{err}");
            std::process::exit(1);
        }
    }

    mono_player_lib::run();
}
