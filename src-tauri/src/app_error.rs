use std::{error::Error, fmt};

pub(crate) type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AppError {
    message: String,
}

impl AppError {
    pub(crate) fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }

    pub(crate) fn message(&self) -> &str {
        &self.message
    }

    pub(crate) fn log(&self) {
        eprintln!("[app-error] message={}", self.message);

        let mut source = self.source();
        let mut index = 0;
        while let Some(error) = source {
            eprintln!("[app-error] source[{index}]={error}");
            source = error.source();
            index += 1;
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl Error for AppError {}

impl From<String> for AppError {
    fn from(message: String) -> Self {
        Self::new(message)
    }
}

impl From<&str> for AppError {
    fn from(message: &str) -> Self {
        Self::new(message)
    }
}
