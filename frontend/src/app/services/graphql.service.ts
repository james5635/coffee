import { Injectable, inject } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import type { DocumentNode } from 'graphql';
import { firstValueFrom } from 'rxjs';

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
  /** A codegen-produced typed document, or a raw operation string. */
  query: DocumentNode | string;
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

/** Maps Apollo's combined GraphQL errors back to the backend's wire shape. */
function toGraphQLErrors(error: unknown): GraphQLError[] | undefined {
  if (!error) {
    return undefined;
  }
  if (CombinedGraphQLErrors.is(error)) {
    return error.errors.map((graphQLError) => {
      const extensions = graphQLError.extensions as { code?: unknown } | undefined;
      return {
        message: graphQLError.message,
        extensions: typeof extensions?.code === 'string' ? { code: extensions.code } : undefined,
      };
    });
  }
  return [{ message: error instanceof Error ? error.message : String(error) }];
}

/** Operation type of a document, defaulting to `query` for anonymous shorthand. */
function operationType(document: DocumentNode): 'query' | 'mutation' | 'subscription' {
  for (const definition of document.definitions) {
    if (definition.kind === 'OperationDefinition') {
      return definition.operation;
    }
  }
  return 'query';
}

/**
 * Apollo-backed GraphQL transport for the backend's `/query` endpoint.
 *
 * Operations execute through the app's Apollo client (see `provideAppApollo`):
 * the link chain attaches the in-memory access token from `AuthStateService`
 * and always sends cookies so the HttpOnly refresh token reaches the backend
 * (via the dev proxy). GraphQL errors are returned in the backend's wire shape
 * (`errors[].extensions.code`) rather than thrown; network/transport failures
 * still reject so callers can distinguish them.
 */
@Injectable({ providedIn: 'root' })
export class GraphQLService {
  private readonly apollo = inject(Apollo);

  async query<T>(req: GraphQLRequest, options?: QueryOptions): Promise<GraphQLResponse<T>> {
    const document = typeof req.query === 'string' ? gql(req.query) : req.query;
    const common = {
      variables: req.variables,
      // Preserve the Phase 1 contract: every call goes to the network and
      // responses are never served from (or written to) the cache.
      fetchPolicy: 'no-cache' as const,
      // Return GraphQL errors alongside data instead of throwing, so callers
      // keep inspecting `errors[].extensions.code` (auth refresh orchestration).
      errorPolicy: 'all' as const,
      context: { skipAuth: options?.skipAuth ?? false },
    };

    const result =
      operationType(document) === 'mutation'
        ? await firstValueFrom(this.apollo.mutate<T>({ mutation: document, ...common }))
        : await firstValueFrom(this.apollo.query<T>({ query: document, ...common }));

    if (result.error && !CombinedGraphQLErrors.is(result.error)) {
      throw result.error;
    }

    return {
      data: result.data as T | undefined,
      errors: toGraphQLErrors(result.error),
    };
  }
}
