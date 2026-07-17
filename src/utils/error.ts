export function getErrorMessage(error: unknown, fallback = '操作失败') {
  if (error instanceof Error) {
    return error.message.trim() || fallback;
  }
  if (typeof error === 'string') {
    return error.trim() || fallback;
  }
  if (error == null) {
    return fallback;
  }
  return String(error).trim() || fallback;
}
