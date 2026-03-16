const WHITESPACE_PATTERN = /\s+/g;

export const ROOM_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const IMAGE_DATA_URL_PATTERN = /^data:image\/(png|jpeg|webp);base64,/i;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_CANVAS_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PROFILE_IMAGE_SIZE = MAX_PROFILE_IMAGE_BYTES;
export const MAX_CANVAS_IMAGE_SIZE = MAX_CANVAS_IMAGE_BYTES;

export const normalizePlainText = (value, maxLength) => {
  const normalized = String(value || '').replace(WHITESPACE_PATTERN, ' ').trim();

  if (typeof maxLength === 'number') {
    return normalized.slice(0, maxLength);
  }

  return normalized;
};
