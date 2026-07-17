use crate::app_error::AppResult;
use serde::Serialize;

const SUCCESS_CODE: u8 = 1;
const ERROR_CODE: u8 = 0;
const DEFAULT_SUCCESS_MESSAGE: &str = "操作成功";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiResponse<T> {
    pub(crate) code: u8,
    pub(crate) message: String,
    pub(crate) data: Option<T>,
}

impl<T> ApiResponse<T> {
    pub(crate) fn success(data: T) -> Self {
        Self::success_message(DEFAULT_SUCCESS_MESSAGE, data)
    }

    pub(crate) fn success_message(message: impl Into<String>, data: T) -> Self {
        Self {
            code: SUCCESS_CODE,
            message: message.into(),
            data: Some(data),
        }
    }

    pub(crate) fn error(message: impl Into<String>) -> Self {
        Self {
            code: ERROR_CODE,
            message: message.into(),
            data: None,
        }
    }

    pub(crate) fn from_result(result: Result<T, String>) -> Self {
        match result {
            Ok(data) => Self::success(data),
            Err(error) => Self::error(error),
        }
    }

    pub(crate) fn from_app_result(result: AppResult<T>) -> Self {
        match result {
            Ok(data) => Self::success(data),
            Err(error) => Self::error(error.message()),
        }
    }
}

impl ApiResponse<()> {
    pub(crate) fn ok() -> Self {
        Self {
            code: SUCCESS_CODE,
            message: DEFAULT_SUCCESS_MESSAGE.to_string(),
            data: None,
        }
    }

    pub(crate) fn from_empty_result(result: Result<(), String>) -> Self {
        match result {
            Ok(()) => Self::ok(),
            Err(error) => Self::error(error),
        }
    }
}
