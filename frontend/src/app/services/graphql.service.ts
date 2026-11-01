import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from './auth-state.service';

/** One GraphQL error; the backend carries the error code in `extensions.code`. */
export interface GraphQLError {
  message?: string;
  /** Tolerated for responses that put the code at the top level. */
  code?: string;
  extensions?: { code?: string };
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
}

export interface QueryOptions {
  /** Skip the bearer header even when a token is held (cookie-only refresh, credential-based login). */
  skipAuth?: boolean;
}

/** Error code of a GraphQL error, reading the backend's `extensions.code` wire format. */
export function graphQLErrorCode(error: GraphQLError | undefined): string | undefined {
  return error?.extensions?.code ?? error?.code;
}

/** Whether a GraphQL response carries the given error code. */
export function hasGraphQLErrorCode<T>(response: GraphQLResponse<T>, code: string): boolean {
  return (response.errors ?? []).some((error) => graphQLErrorCode(error) === code);
}

/**
 * Minimal GraphQL client: POSTs operations to `/query`, attaching the
 * in-memory access token as a bearer header and always sending cookies so the
 * HttpOnly refresh-token cookie reaches the backend (via the dev proxy).
 */
@Injectable({ providedIn: 'root' })
export class GraphQLService {
  private readonly http = inject(HttpClient);
  private readonly authState = inject(AuthStateService);

  query<T>(req: GraphQLRequest, options?: QueryOptions): Promise<GraphQLResponse<T>> {
    const token = options?.skipAuth ? null : this.authState.accessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return firstValueFrom(
      this.http.post<GraphQLResponse<T>>('/query', req, { headers, withCredentials: true }),
    );
  }
}
