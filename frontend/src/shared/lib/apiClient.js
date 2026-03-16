// src/shared/lib/apiClient.js
import { API_URL } from '@shared/lib/config';

const buildUrl = (path) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith('/')) {
    return `${API_URL}${path}`;
  }

  return `${API_URL}/${path}`;
};

export async function apiRequest(path, options = {}) {
  const {
    token,
    headers,
    body,
    method = 'GET',
    ...rest
  } = options;

  const finalHeaders = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers || {}),
  };

  const response = await fetch(buildUrl(path), {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = payload?.error || payload?.message || 'Request failed.';
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}
