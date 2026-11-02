import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { gql } from 'apollo-angular';
import { GraphQLService } from './graphql.service';
import { AuthStateService } from './auth-state.service';
import { provideAppApollo } from '../app.config';

describe('GraphQLService', () => {
  let service: GraphQLService;
  let authState: AuthStateService;
  let httpMock: HttpTestingController;

  /** Lets Apollo's link chain reach the HTTP layer before asserting on it. */
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideAppApollo()],
    });
    service = TestBed.inject(GraphQLService);
    authState = TestBed.inject(AuthStateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('executes typed documents through Apollo as POST /query with variables and cookies', async () => {
    const promise = service.query({
      query: gql`
        query Test($id: ID) {
          test(id: $id)
        }
      `,
      variables: { id: '1' },
    });
    await settle();

    const req = httpMock.expectOne('/query');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.query).toContain('query Test($id: ID)');
    expect(req.request.body.variables).toEqual({ id: '1' });
    expect(req.request.withCredentials).toBe(true);
    req.flush({ data: { test: 'ok' } });

    const result = await promise;
    expect(result.data).toEqual({ test: 'ok' });
    expect(result.errors).toBeUndefined();
  });

  it('attaches the bearer header from auth state when a token exists', async () => {
    authState.setAccessToken('token-123');

    const promise = service.query({
      query: gql`
        query Me {
          me
        }
      `,
    });
    await settle();

    const req = httpMock.expectOne('/query');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    req.flush({ data: { me: 'user' } });

    await promise;
  });

  it('attaches no bearer header when no token exists', async () => {
    const promise = service.query({
      query: gql`
        query Test {
          test
        }
      `,
    });
    await settle();

    const req = httpMock.expectOne('/query');
    expect(req.request.headers.has('Authorization')).toBeFalsy();
    req.flush({ data: { test: 'ok' } });

    await promise;
  });

  it('attaches no bearer header when skipAuth is set even if a token exists', async () => {
    authState.setAccessToken('token-123');

    const promise = service.query(
      {
        query: gql`
          mutation RefreshToken {
            refreshToken {
              accessToken
            }
          }
        `,
      },
      { skipAuth: true },
    );
    await settle();

    const req = httpMock.expectOne('/query');
    expect(req.request.headers.has('Authorization')).toBeFalsy();
    req.flush({ data: { refreshToken: { accessToken: 'refreshed' } } });

    await promise;
  });

  it('accepts a raw operation string and parses it for Apollo', async () => {
    const promise = service.query({ query: 'query { categories { id } }' });
    await settle();

    const req = httpMock.expectOne('/query');
    expect(req.request.body.query).toContain('categories');
    req.flush({ data: { categories: [] } });

    const result = await promise;
    expect(result.data).toEqual({ categories: [] });
  });

  it('returns GraphQL errors with their extensions.code', async () => {
    const promise = service.query<{ me: string }>({
      query: gql`
        query Me {
          me
        }
      `,
    });
    await settle();

    const req = httpMock.expectOne('/query');
    req.flush({
      errors: [{ message: 'The access token has expired.', extensions: { code: 'TOKEN_EXPIRED' } }],
    });

    const result = await promise;
    expect(result.errors?.[0]?.extensions?.code).toBe('TOKEN_EXPIRED');
    expect(result.errors?.[0]?.message).toBe('The access token has expired.');
  });
});
