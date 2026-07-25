import Constants from 'expo-constants';

/**
 * Thin API client. Every non-2xx response is turned into an ApiError carrying
 * the server's per-field messages, so screens can render validation inline
 * instead of showing a raw error string.
 */

const BASE_URL: string =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  code: string;
  fieldErrors: Record<string, string>;

  constructor(status: number, message: string, code = 'error', fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...extra,
  };
}

async function handle<T>(res: Response): Promise<T> {
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body.message ?? `Request failed (${res.status})`,
      body.code ?? 'error',
      body.fieldErrors ?? {},
    );
  }
  return body as T;
}

function query(params?: Record<string, string | undefined>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&')}`;
}

export const api = {
  async get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}${query(params)}`, { headers: headers() });
    return handle<T>(res);
  },

  async send<T>(method: 'POST' | 'PATCH' | 'PUT', path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: headers({ 'Content-Type': 'application/json' }),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return handle<T>(res);
  },

  post<T>(path: string, body?: unknown) {
    return this.send<T>('POST', path, body);
  },
  patch<T>(path: string, body?: unknown) {
    return this.send<T>('PATCH', path, body);
  },

  /** Multipart upload for invoice files and bank statements. */
  async upload<T>(
    path: string,
    file: { uri: string; name: string; mimeType: string },
    fields: Record<string, string> = {},
  ): Promise<T> {
    const form = new FormData();
    // React Native's FormData takes this shape for file parts.
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
    for (const [key, value] of Object.entries(fields)) form.append(key, value);

    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: headers(),
      body: form,
    });
    return handle<T>(res);
  },
};

export { BASE_URL };
