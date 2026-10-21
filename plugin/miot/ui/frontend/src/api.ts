import { serviceOrigin, serviceToken } from './mono';
import type { ApiEnvelope } from './types';

// 反代 BASE_PATH 子路径部署下，硬编码的绝对路径（以 "/" 开头）会绕过 BASE_PATH 直接
// 打到域名根——这类绝对路径不受 <base href> 影响（WebF 下 <base href> 本身也完全不
// 生效，见 docs/webf/upstream-issues.md #2，不能依赖它，document.baseURI 同样不存在）。
// 从当前页面路径里找出插件路由段之前的部分即为 BASE_PATH 前缀（songloft-org/songloft#407）。
// vite dev 环境路径不含该段，天然回退为空前缀，与原先硬编码绝对路径的行为一致。
export function hostPathPrefix(): string { return serviceOrigin(); }

function pluginBase(): string {
  return `${hostPathPrefix()}/api/v1/jsplugin/miot`;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status = 0) {
    super(message);
    this.name = 'ApiError';
  }
}


async function browserRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${pluginBase()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${serviceToken()}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return decodePayload<T>(await response.json(), response.status, response.ok);
}

async function browserEnvelope<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${pluginBase()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${serviceToken()}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json() as { success?: boolean; error?: string } & T;
  if (response.status < 200 || response.status >= 300 || payload.success !== true) {
    throw new ApiError(payload.error || `请求失败 (${response.status})`, response.status);
  }
  return payload;
}

export function unwrap<T>(value: unknown): T {
  return decodePayload<T>(value, 0, true);
}

function decodePayload<T>(value: unknown, status: number, ok: boolean): T {
  const payload = value as Partial<ApiEnvelope<T>> | null;
  if (payload && typeof payload === 'object' && 'success' in payload) {
    if (payload.success === true) {
      return payload.data as T;
    }
    throw new ApiError(payload.error || '请求失败，请稍后重试', status);
  }
  if (!ok) {
    const detail = (payload as { error?: string; message?: string } | null)?.error
      || (payload as { error?: string; message?: string } | null)?.message
      || `请求失败 (${status})`;
    throw new ApiError(detail, status);
  }
  return value as T;
}

export async function get<T>(path: string): Promise<T> {
  return browserRequest<T>('GET', path);
}

export async function post<T>(path: string, body: unknown = {}): Promise<T> {
  return browserRequest<T>('POST', path, body);
}

export async function postEnvelope<T>(path: string, body: unknown = {}): Promise<T> {
  return browserEnvelope<T>('POST', path, body);
}

export async function del<T>(path: string): Promise<T> {
  return browserRequest<T>('DELETE', path);
}

export function query(params: Record<string, string | number | boolean | undefined>): string {
  const values: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      values.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return values.length ? `?${values.join('&')}` : '';
}

export function pluginWebSocketUrl(path: string): string {
  const protocol = new URL(serviceOrigin()).protocol === 'https:' ? 'wss:' : 'ws:';
  const token = serviceToken() || '';
  return `${pluginBase().replace(/^https?:/, protocol)}${path}${
    path.includes('?') ? '&' : '?'
  }${token ? `access_token=${encodeURIComponent(token)}` : ''}`;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '未知错误');
}
