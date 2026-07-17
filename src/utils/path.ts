export function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLocaleLowerCase();
}

export function folderTitle(path: string) {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop() || path;
}
