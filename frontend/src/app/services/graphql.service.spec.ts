import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GraphQLService } from './graphql.service';
import { AuthStateService } from './auth-state.service';

describe('GraphQLService', () => {
  let service: GraphQLService;
  let authState: AuthStateService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GraphQLService);
    authState = TestBed.inject(AuthStateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('POSTs the operation to /query with variables and sends cookies', async () => {
    const promise = service.query({ query: '{ test }', variables: { id: '1' } });

    const req = httpMock.expectOne('/query');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ query: '{ test }', variables: { id: '1' } });
    expect(req.request.withCredentials).toBe(true);
    req.flush({ data: { test: 'ok' } });

    const result = await promise;
    expect(result.data).toEqual({ test: 'ok' });
  });

  it('attaches the bearer header from auth state when a token exists', async () => {
    authState.setAccessToken('token-123');

    const promise = service.query({ query: '{ me }' });

    const req = httpMock.expectOne('/query');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    req.flush({ data: { me: 'user' } });

    await promise;
  });

  it('attaches no bearer header when no token exists', async () => {
    const promise = service.query({ query: '{ test }' });

    const req = httpMock.expectOne('/query');
    expect(req.request.headers.has('Authorization')).toBeFalsy();
    req.flush({ data: { test: 'ok' } });

    await promise;
  });

  it('attaches no bearer header when skipAuth is set even if a token exists', async () => {
    authState.setAccessToken('token-123');

    const promise = service.query(
      { query: 'mutation RefreshToken { refreshToken { accessToken } }' },
      { skipAuth: true },
    );

    const req = httpMock.expectOne('/query');
    expect(req.request.headers.has('Authorization')).toBeFalsy();
    req.flush({ data: { refreshToken: { accessToken: 'refreshed' } } });

    await promise;
  });

  it('returns GraphQL errors with their extensions.code', async () => {
    const promise = service.query<{ me: string }>({ query: '{ me }' });

    const req = httpMock.expectOne('/query');
    req.flush({
      errors: [{ message: 'The access token has expired.', extensions: { code: 'TOKEN_EXPIRED' } }],
    });

    const result = await promise;
    expect(result.errors?.[0]?.extensions?.code).toBe('TOKEN_EXPIRED');
  });
});
