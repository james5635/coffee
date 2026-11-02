import { Injectable, inject } from '@angular/core';
import {
  LoginDocument,
  LoginMutation,
  LoginMutationVariables,
  LogoutDocument,
  LogoutMutation,
  RefreshTokenDocument,
  RefreshTokenMutation,
} from '../../graphql/generated/graphql';
import {
  GraphQLRequest,
  GraphQLResponse,
  GraphQLService,
  graphQLErrorCode,
  hasGraphQLErrorCode,
} from './graphql.service';
import { AuthStateService } from './auth-state.service';

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
 * orchestration: on `TOKEN_EXPIRED`, or on `UNAUTHENTICATED` while a token is
 * held (the code the merged backend emits for an expired bearer with a valid
 * refresh cookie), refresh the session once and retry the original operation
 * once with the new token; on refresh failure clear the session so the app can
 * route to login. Concurrent refresh triggers are coalesced into a single
 * in-flight refresh (single-flight), so parallel expiring requests never race
 * to consume the rotating refresh cookie; the session is cleared only when
 * that shared refresh genuinely fails.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly graphql = inject(GraphQLService);
  private readonly authState = inject(AuthStateService);

  /** Shared in-flight refresh, so concurrent triggers await one rotation. */
  private refreshInFlight: Promise<boolean> | null = null;

  /**
   * Runs a GraphQL operation with refresh-on-expiry orchestration. Responses
   * that carry neither refreshable code pass through untouched; a failed
   * refresh clears the session and returns the original response.
   */
  async query<T>(req: GraphQLRequest): Promise<GraphQLResponse<T>> {
    const response = await this.graphql.query<T>(req);
    if (!this.isRefreshable(response)) {
      return response;
    }
    const refreshed = await this.refreshSession();
    if (!refreshed) {
      return response;
    }
    // Single retry; the bearer header is re-read from auth state automatically.
    return this.graphql.query<T>(req);
  }

  /**
   * Whether a response should trigger a refresh attempt: `TOKEN_EXPIRED`
   * (design's trigger) or `UNAUTHENTICATED` while a token is held (what the
   * merged backend emits when an expired bearer passes through anonymously
   * with a refresh cookie present). `UNAUTHENTICATED` without a held token is
   * a genuinely anonymous request and passes through untouched; boot-time
   * session restore is handled explicitly by `restoreSession` at app start.
   */
  private isRefreshable<T>(response: GraphQLResponse<T>): boolean {
    if (hasGraphQLErrorCode(response, 'TOKEN_EXPIRED')) {
      return true;
    }
    return this.authState.isAuthenticated() && hasGraphQLErrorCode(response, 'UNAUTHENTICATED');
  }

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    // Credentials authenticate the request; skip any stale in-memory bearer.
    const response = await this.graphql.query<LoginMutation>(
      { query: LoginDocument, variables: { email, password } satisfies LoginMutationVariables },
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
   * Concurrent callers share a single in-flight refresh (single-flight), so
   * parallel expiring requests never race each other to the rotating refresh
   * cookie and a losing response can't clear a freshly rotated token.
   */
  refreshSession(): Promise<boolean> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.performRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async performRefresh(): Promise<boolean> {
    try {
      const response = await this.graphql.query<RefreshTokenMutation>(
        { query: RefreshTokenDocument },
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
   * Restores the session on app boot from the HttpOnly refresh cookie. The
   * access token is memory-only, so a full page reload otherwise loses the
   * session. Always settles the auth state's initialized signal, whether the
   * silent refresh succeeds or not, so the guard can safely decide after this.
   * Browser-only; the app initializer skips it during SSR.
   */
  async restoreSession(): Promise<void> {
    try {
      if (!this.authState.isAuthenticated()) {
        await this.refreshSession();
      }
    } finally {
      this.authState.markInitialized();
    }
  }

  /**
   * Ends the server session (best effort) and always clears local auth state,
   * so a failed logout call cannot trap the user in an authenticated UI.
   */
  async logout(): Promise<void> {
    try {
      await this.graphql.query<LogoutMutation>({ query: LogoutDocument });
    } catch {
      // Ignore network/server failures; local state is cleared regardless.
    }
    this.authState.clearSession();
  }
}
