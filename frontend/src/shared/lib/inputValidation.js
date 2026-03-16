import {
  ALLOWED_IMAGE_TYPES,
  BASIC_EMAIL_PATTERN,
  MAX_CANVAS_IMAGE_SIZE as SHARED_MAX_CANVAS_IMAGE_SIZE,
  MAX_PROFILE_IMAGE_SIZE as SHARED_MAX_PROFILE_IMAGE_SIZE,
  ROOM_ID_PATTERN,
  normalizePlainText as normalizeSharedPlainText,
} from '../../../shared/validation.js';

// Security patterns
const HTML_TAG_PATTERN = /<[^>]+>/i;
const SCRIPT_PATTERN = /<\/?script\b|javascript:|on\w+\s*=|data:text\/html/i;
const CODE_BLOCK_PATTERN = /```|`[^`]+`|<code\b|<\/code>|<pre\b|<\/pre>/i;

// Size limits
export const MAX_PROFILE_IMAGE_SIZE = SHARED_MAX_PROFILE_IMAGE_SIZE;
export const MAX_CANVAS_IMAGE_SIZE = SHARED_MAX_CANVAS_IMAGE_SIZE;
export { ALLOWED_IMAGE_TYPES, ROOM_ID_PATTERN };

// Email limits (RFC 5321)
export const MAX_EMAIL_LENGTH = 320;
export const MAX_EMAIL_LOCAL_LENGTH = 64;

/**
 * Normalize plain text by collapsing whitespace and trimming
 */
export function normalizePlainText(value) {
  return normalizeSharedPlainText(value);
}

/**
 * Check if text contains potentially unsafe content
 */
export function containsUnsafeText(value) {
  const text = String(value || '');
  return (
    HTML_TAG_PATTERN.test(text) ||
    SCRIPT_PATTERN.test(text) ||
    CODE_BLOCK_PATTERN.test(text)
  );
}

/**
 * Validate plain text input with options
 */
export function validatePlainText(value, options = {}) {
  const {
    label = 'Value',
    required = true,
    minLength = 1,
    maxLength = 200,
    pattern = null,
  } = options;

  const normalized = normalizePlainText(value);

  if (!normalized) {
    if (required) {
      return `${label} is required.`;
    }
    return null;
  }

  if (normalized.length < minLength) {
    return `${label} must be at least ${minLength} character${minLength === 1 ? '' : 's'}.`;
  }

  if (normalized.length > maxLength) {
    return `${label} must be under ${maxLength} character${maxLength === 1 ? '' : 's'}.`;
  }

  if (containsUnsafeText(normalized)) {
    return `${label} must be plain text only (no HTML, scripts, or code blocks).`;
  }

  if (pattern && !pattern.test(normalized)) {
    return `${label} contains unsupported characters.`;
  }

  return null;
}

export function validateRoomId(value, options = {}) {
  const normalized = normalizePlainText(value);

  if (!normalized) {
    return options.required === false ? null : 'Room ID is required.';
  }

  if (!ROOM_ID_PATTERN.test(normalized)) {
    return 'Enter a valid room ID.';
  }

  return null;
}

/**
 * Validate email address format and length
 */
export function validateEmail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  
  if (!normalized) {
    return 'Email is required.';
  }

  if (containsUnsafeText(normalized)) {
    return 'Email must be plain text only.';
  }

  if (normalized.length > MAX_EMAIL_LENGTH) {
    return `Email must be under ${MAX_EMAIL_LENGTH} characters.`;
  }

  // Basic email format validation
  if (!BASIC_EMAIL_PATTERN.test(normalized)) {
    return 'Please enter a valid email address.';
  }

  // Additional checks for common invalid patterns
  if (normalized.includes('..')) {
    return 'Email cannot contain consecutive dots.';
  }

  const [localPart] = normalized.split('@');
  if (localPart.length > MAX_EMAIL_LOCAL_LENGTH) {
    return `The part before @ must be under ${MAX_EMAIL_LOCAL_LENGTH} characters.`;
  }

  return null;
}

/**
 * Validate message text (wrapper around validatePlainText)
 */
export function validateMessageText(value, options = {}) {
  return validatePlainText(value, {
    label: options.label || 'Message',
    minLength: options.minLength ?? 2,
    maxLength: options.maxLength ?? 5000,
    pattern: options.pattern,
  });
}

/**
 * Validate image file type and size
 */
export function validateImageFile(file, options = {}) {
  const {
    maxSize = MAX_PROFILE_IMAGE_SIZE,
    label = 'Image',
  } = options;

  if (!file) {
    return `${label} is required.`;
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Only JPG, PNG, and WEBP images are supported.';
  }

  if (file.size > maxSize) {
    const sizeMB = Math.round(maxSize / (1024 * 1024));
    return `${label} must be smaller than ${sizeMB} MB.`;
  }

  return null;
}

/**
 * Read file as data URL and verify it's a valid image
 */
export async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    // Validate file first
    const fileError = validateImageFile(file);
    if (fileError) {
      reject(new Error(fileError));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to read the selected file.'));
        return;
      }

      // Verify the image actually loads
      const image = new Image();
      
      image.onload = () => {
        // Optional: Add dimension validation here if needed
        // if (image.width > MAX_IMAGE_WIDTH) reject('Image too wide');
        resolve(reader.result);
      };
      
      image.onerror = () => {
        reject(new Error('The selected image appears to be corrupted or unsupported.'));
      };
      
      image.src = reader.result;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read the selected file.'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Validate that a value is a valid URL
 */
export function validateUrl(value, options = {}) {
  const {
    required = false,
    protocols = ['http:', 'https:'],
  } = options;

  const normalized = String(value || '').trim();

  if (!normalized) {
    if (required) {
      return 'URL is required.';
    }
    return null;
  }

  try {
    const url = new URL(normalized);
    
    if (!protocols.includes(url.protocol)) {
      return `URL must use ${protocols.join(' or ')} protocol.`;
    }

    return null;
  } catch {
    return 'Please enter a valid URL.';
  }
}

/**
 * Validate password strength
 */
export function validatePassword(value, options = {}) {
  const {
    minLength = 8,
    requireNumber = true,
    requireSpecial = false,
    requireUppercase = true,
  } = options;

  const normalized = String(value || '');

  if (!normalized) {
    return 'Password is required.';
  }

  if (normalized.length < minLength) {
    return `Password must be at least ${minLength} characters.`;
  }

  if (containsUnsafeText(normalized)) {
    return 'Password must be plain text only.';
  }

  if (requireNumber && !/[0-9]/.test(normalized)) {
    return 'Password must contain at least one number.';
  }

  if (requireUppercase && !/[A-Z]/.test(normalized)) {
    return 'Password must contain at least one uppercase letter.';
  }

  if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(normalized)) {
    return 'Password must contain at least one special character.';
  }

  return null;
}

/**
 * Check if two passwords match
 */
export function validatePasswordMatch(password, confirmPassword) {
  if (password !== confirmPassword) {
    return 'Passwords do not match.';
  }
  return null;
}
