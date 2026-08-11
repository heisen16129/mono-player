use lofty::file::TaggedFile;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::Path;

pub(crate) fn read_tagged_file(path: &Path, context: &str) -> Result<TaggedFile, String> {
    let path = path.to_path_buf();
    match catch_unwind(AssertUnwindSafe(|| lofty::read_from_path(&path))) {
        Ok(Ok(tagged_file)) => Ok(tagged_file),
        Ok(Err(error)) => {
            eprintln!(
                "[metadata] read failed context={} path={} error={}",
                context,
                path.to_string_lossy(),
                error
            );
            Err(error.to_string())
        }
        Err(_) => {
            let message = format!(
                "metadata parser panicked while reading {}",
                path.to_string_lossy()
            );
            eprintln!("[metadata] read panic context={} error={}", context, message);
            Err(message)
        }
    }
}
