import { Injectable, inject } from '@angular/core';
import {
  GraphQLResponse,
  GraphQLService,
  graphQLErrorCode,
  hasGraphQLErrorCode,
} from './graphql.service';
import { AuthStateService } from './auth-state.service';

const LOGIN_MUTATION = `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      tokenType
      expiresIn
    }
  }
`;

const REFRESH_MUTATION = `
  mutation RefreshToken {
    refreshToken {
      accessToken
      tokenType
      expiresIn
    }
  }
`;

const LOGOUT_MUTATION = `
  mutation Logout {
    logout
  }
`;

interface AuthPayloadResponse {
  login: { accessToken: string };
}

interface RefreshTokenResponse {
  refreshToken: { accessToken: string };
}

interface LogoutResponse {
  logout: boolean;
}

/** Thrown by AuthService mutations; `code` carries the backend GraphQL error code. */
export class AuthError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'AuthError';
  }
}

/**
 * Auth operations (login/refresh/logout) plus the auth-aware query
 * orchestration: on `TOKEN_EXPIRED`, refresh the session once and retry the
 * original operation once with the new token; on refresh failure clear the
 * session so the app can route to login.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly graphql = inject(GraphQLService);
  private readonly authState = inject(AuthStateService);

  /**
   * Runs a GraphQL operation with refresh-on-expiry orchestration. Non-
   * `TOKEN_EXPIRED` responses pass through untouched; a failed refresh clears
   * the session and returns the original `TOKEN_EXPIRED` response.
   */
  async query<T>(req: {
    query: string;
    variables?: Record<string, unknown>;
  }): Promise<GraphQLResponse<T>> {
    const response = await this.graphql.query<T>(req);
    if (!hasGraphQLErrorCode(response, 'TOKEN_EXPIRED')) {
      return response;
    }
    const refreshed = await this.refreshSession();
    if (!refreshed) {
      return response;
    }
    // Single retry; the bearer header is re-read from auth state automatically.
    return this.graphql.query<T>(req);
  }

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    // Credentials authenticate the request; skip any stale in-memory bearer.
    const response = await this.graphql.query<AuthPayloadResponse>(
      { query: LOGIN_MUTATION, variables: { email, password } },
      { skipAuth: true },
    );

    const accessToken = response.data?.login?.accessToken;
    if (!accessToken) {
      const error = response.errors?.[0];
      throw new AuthError(graphQLErrorCode(error) ?? 'INTERNAL', error?.message);
    }

    this.authState.setAccessToken(accessToken);
    return { accessToken };
  }

  /**
   * Refreshes the session from the HttpOnly refresh cookie (cookie-only, no
   * bearer). Never throws: any failure clears the session and returns false.
   */
  async refreshSession(): Promise<boolean> {
    try {
      const response = await this.graphql.query<RefreshTokenResponse>(
        { query: REFRESH_MUTATION },
        { skipAuth: true },
      );

      const accessToken = response.data?.refreshToken?.accessToken;
      if (!accessToken) {
        this.authState.clearSession();
        return false;
      }

      this.authState.setAccessToken(accessToken);
      return true;
    } catch {
      this.authState.clearSession();
      return false;
    }
  }

  /**
   * Ends the server session (best effort) and always clears local auth state,
   * so a failed logout call cannot trap the user in an authenticated UI.
   */
  async logout(): Promise<void> {
    try {
      await this.graphql.query<LogoutResponse>({ query: LOGOUT_MUTATION });
    } catch {
      // Ignore network/server failures; local state is cleared regardless.
    }
    this.authState.clearSession();
  }
}
