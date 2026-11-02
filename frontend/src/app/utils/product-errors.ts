/**
 * Shared error surfacing for product operations.
 *
 * Services throw a typed error carrying the backend GraphQL code
 * (`BAD_USER_INPUT`, `INVALID_STATE`, `NOT_FOUND`, `FORBIDDEN`,
 * `INSUFFICIENT_BALANCE`, the auth codes, or `INTERNAL`). Screens translate
 * those codes into plain-language messages scoped to the operation, while
 * auth failures share one "session ended" message and transport failures get a
 * connection message. The backend is always the source of truth; this module
 * only decides what the user reads.
 */

/** Backend codes that mean the session could not be refreshed. */
export const AUTH_ERROR_CODES = [
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'INVALID_REFRESH_TOKEN',
] as const;

/** Messages for one operation's error surface. */
export interface ProductErrorMessages {
  /** Plain-language message per backend code. */
  codes: Readonly<Record<string, string>>;
  /** Shared message for auth codes (session ended, sign in again). */
  auth: string;
  /** Message for a backend code this operation does not map. */
  unknown: string;
  /** Message for a transport/network failure with no backend code. */
  offline: string;
}

/** Reads the backend code from a typed service error, if present. */
export function codedErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** Translates a product-operation error into the message to show the user. */
export function productErrorMessage(error: unknown, messages: ProductErrorMessages): string {
  const code = codedErrorCode(error);
  if (!code) {
    return messages.offline;
  }
  if ((AUTH_ERROR_CODES as readonly string[]).includes(code)) {
    return messages.auth;
  }
  return messages.codes[code] ?? messages.unknown;
}
