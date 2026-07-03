/* ------------------------------------------------------------------
   Inline form validators for client-side field-level feedback.
   Each returns '' when valid, or user-facing error copy when not.
   Rules mirror the server's Zod schemas (packages/shared/src/schemas.ts):
   email format, password 8–128 chars.
   ------------------------------------------------------------------ */

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function validateEmail(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Email is required.';
  if (!EMAIL_PATTERN.test(trimmed)) {
    return 'Enter a valid email address, like you@example.com.';
  }
  return '';
}

/** Full password policy — for registration and password reset. */
export function validateNewPassword(value: string): string {
  if (!value) return 'Password is required.';
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  }
  return '';
}

/** Presence-only check — for login, where policy hints don't belong. */
export function validateRequired(label: string, value: string): string {
  if (!value.trim()) return `${label} is required.`;
  return '';
}

export function validatePasswordConfirm(password: string, confirm: string): string {
  if (!confirm) return 'Confirm your new password.';
  if (password !== confirm) return "Passwords don't match.";
  return '';
}
