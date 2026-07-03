/* ------------------------------------------------------------------
   Unit tests for lib/validation.ts — inline form validators.
   ------------------------------------------------------------------ */

import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validateNewPassword,
  validateRequired,
  validatePasswordConfirm,
  PASSWORD_MAX_LENGTH,
} from './validation.js';

describe('validateEmail', () => {
  it('returns empty string for a valid email', () => {
    expect(validateEmail('you@example.com')).toBe('');
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validateEmail('  you@example.com  ')).toBe('');
  });

  it('requires a value', () => {
    expect(validateEmail('')).toBe('Email is required.');
    expect(validateEmail('   ')).toBe('Email is required.');
  });

  it('rejects malformed addresses with actionable copy', () => {
    for (const bad of ['plainword', 'missing@tld', 'no-at.example.com', 'spaces in@example.com']) {
      expect(validateEmail(bad)).toBe('Enter a valid email address, like you@example.com.');
    }
  });
});

describe('validateNewPassword', () => {
  it('returns empty string for a valid password', () => {
    expect(validateNewPassword('12345678')).toBe('');
  });

  it('requires a value', () => {
    expect(validateNewPassword('')).toBe('Password is required.');
  });

  it('enforces the 8-character minimum matching the server schema', () => {
    expect(validateNewPassword('1234567')).toBe('Password must be at least 8 characters.');
  });

  it('enforces the 128-character maximum matching the server schema', () => {
    expect(validateNewPassword('x'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(
      'Password must be 128 characters or fewer.',
    );
    expect(validateNewPassword('x'.repeat(PASSWORD_MAX_LENGTH))).toBe('');
  });
});

describe('validateRequired', () => {
  it('returns empty string when present', () => {
    expect(validateRequired('Name', 'Ada')).toBe('');
  });

  it('uses the field label in the copy', () => {
    expect(validateRequired('Name', '')).toBe('Name is required.');
    expect(validateRequired('Password', '  ')).toBe('Password is required.');
  });
});

describe('validatePasswordConfirm', () => {
  it('returns empty string when passwords match', () => {
    expect(validatePasswordConfirm('secret-123', 'secret-123')).toBe('');
  });

  it('asks for confirmation when empty', () => {
    expect(validatePasswordConfirm('secret-123', '')).toBe('Confirm your new password.');
  });

  it('reports a mismatch', () => {
    expect(validatePasswordConfirm('secret-123', 'secret-124')).toBe("Passwords don't match.");
  });
});
