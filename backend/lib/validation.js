import {
  BASIC_EMAIL_PATTERN,
  IMAGE_DATA_URL_PATTERN,
  MAX_CANVAS_IMAGE_BYTES,
  MAX_PROFILE_IMAGE_BYTES,
  ROOM_ID_PATTERN,
  normalizePlainText as normalizeSharedPlainText,
} from '../shared/validation.js';

const HTML_TAG_PATTERN = /<[a-z][\s\S]*?>/i;
const SCRIPT_PATTERN = /<(script|iframe|object|embed)\b[\s\S]*?>[\s\S]*?<\/\1>/gi;
const JS_PROTOCOL_PATTERN = /javascript:|data:text\/html|vbscript:/i;
const EVENT_HANDLER_PATTERN = /\son\w+\s*=/i;
export { MAX_PROFILE_IMAGE_BYTES, MAX_CANVAS_IMAGE_BYTES, ROOM_ID_PATTERN };

export const normalizePlainText = (value, maxLength = 5000) => (
  normalizeSharedPlainText(value, maxLength)
);

export const containsUnsafeText = (value) => {
  const text = String(value || '');
  return (
    HTML_TAG_PATTERN.test(text) ||
    SCRIPT_PATTERN.test(text) ||
    JS_PROTOCOL_PATTERN.test(text) ||
    EVENT_HANDLER_PATTERN.test(text)
  );
};

export const validatePlainText = (value, options = {}) => {
  const {
    label = 'Value',
    required = true,
    minLength = 1,
    maxLength = 200,
    pattern = null,
  } = options;

  const normalized = normalizePlainText(value, maxLength);

  if (!normalized) {
    return required ? `${label} is required.` : null;
  }

  if (normalized.length < minLength) {
    return `${label} must be at least ${minLength} characters.`;
  }

  if (containsUnsafeText(normalized)) {
    return `${label} must be plain text only.`;
  }

  if (pattern && !pattern.test(normalized)) {
    return `${label} contains unsupported characters.`;
  }

  return null;
};

export const validateEmail = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Email is required.';
  if (containsUnsafeText(normalized)) return 'Email must be plain text only.';
  if (!BASIC_EMAIL_PATTERN.test(normalized)) {
    return 'Invalid email address.';
  }
  return null;
};

export const getDataUrlByteLength = (dataUrl) => {
  const base64 = String(dataUrl || '').split(',')[1] || '';
  return Buffer.byteLength(base64, 'base64');
};

export const validateImageDataUrl = (dataUrl, options = {}) => {
  const {
    maxBytes = MAX_PROFILE_IMAGE_BYTES,
    label = 'Image',
  } = options;

  if (!dataUrl) {
    return `${label} is required.`;
  }

  if (!IMAGE_DATA_URL_PATTERN.test(dataUrl)) {
    return 'Only JPG, PNG, and WEBP images are supported.';
  }

  if (dataUrl.length > maxBytes * 2) {
    return `${label} is too large.`;
  }

  const byteLength = getDataUrlByteLength(dataUrl);
  if (byteLength > maxBytes) {
    return `${label} must be smaller than ${Math.round(maxBytes / (1024 * 1024))} MB.`;
  }

  return null;
};
