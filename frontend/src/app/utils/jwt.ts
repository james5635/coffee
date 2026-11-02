/**
 * Client-side access-token claim decoding.
 *
 * The backend signs HS256 access tokens carrying `roles` and `permissions`
 * claims. The frontend decodes the payload (without verifying the signature)
 * only to decide which navigation and actions to show; it is **not** a
 * security boundary. Every protected operation is still authorized by the
 * backend, and `FORBIDDEN` responses remain the source of truth.
 */

/** Authorization claims relevant to UI gating; `null` means absent/invalid. */
export interface AccessTokenClaims {
  roles: string[] | null;
  permissions: string[] | null;
}

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Decodes one base64url segment as UTF-8 text, or returns `null`. */
function decodeBase64Url(value: string): string | null {
  if (!BASE64URL_PATTERN.test(value)) {
    return null;
  }
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Returns the string entries of a claim, or `null` when it is not an array. */
function stringArrayClaim(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Decodes `roles` and `permissions` from a JWT access token.
 *
 * Returns `null` when the token is malformed or its payload is not a JSON
 * object, so callers can fall back to authentication-only gating. A claim that
 * is missing or not an array is reported as `null`; an empty array is reported
 * as `[]` (the claim is present and grants nothing).
 */
export function decodeAccessTokenClaims(
  token: string | null | undefined,
): AccessTokenClaims | null {
  if (!token) {
    return null;
  }

  const segments = token.split('.');
  if (segments.length !== 3) {
    return null;
  }

  const payload = decodeBase64Url(segments[1]);
  if (payload === null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const claims = parsed as Record<string, unknown>;
  return {
    roles: stringArrayClaim(claims['roles']),
    permissions: stringArrayClaim(claims['permissions']),
  };
}
