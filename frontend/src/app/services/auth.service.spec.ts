import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthError, AuthService } from './auth.service';
import { AuthStateService } from './auth-state.service';

describe('AuthService', () => {
  let authService: AuthService;
  let authState: AuthStateService;
  let httpMock: HttpTestingController;

  /** Lets promise continuations (orchestration steps) run so the next request is issued. */
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    authService = TestBed.inject(AuthService);
    authState = TestBed.inject(AuthStateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('stores the access token after successful login', async () => {
    const promise = authService.login('owner@coffee.local', 'password123');

    const req = httpMock.expectOne('/query');
    expect(req.request.body.query).toContain('mutation Login');
    expect(req.request.body.variables).toEqual({
      email: 'owner@coffee.local',
      password: 'password123',
    });
    req.flush({
      data: { login: { accessToken: 'new-access-token', tokenType: 'Bearer', expiresIn: 900 } },
    });

    const result = await promise;
    expect(result).toEqual({ accessToken: 'new-access-token' });
    expect(authState.accessToken()).toBe('new-access-token');
  });

  it('throws on failed login', async () => {
    const promise = authService.login('wrong@coffee.local', 'wrong');

    const req = httpMock.expectOne('/query');
    req.flush({
      errors: [{ message: 'Authentication is required.', extensions: { code: 'UNAUTHENTICATED' } }],
    });

    await expect(promise).rejects.toBeInstanceOf(AuthError);
    await expect(promise).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(authState.accessToken()).toBeNull();
  });

  it('returns true and updates the token on successful refresh', async () => {
    authState.setAccessToken('expired-token');

    const promise = authService.refreshSession();

    const req = httpMock.expectOne('/query');
    expect(req.request.body.query).toContain('mutation RefreshToken');
    // Refresh is cookie-based: no bearer header even though a token is held.
    expect(req.request.headers.has('Authorization')).toBeFalsy();
    req.flush({
      data: {
        refreshToken: { accessToken: 'refreshed-token', tokenType: 'Bearer', expiresIn: 900 },
      },
    });

    const result = await promise;
    expect(result).toBe(true);
    expect(authState.accessToken()).toBe('refreshed-token');
  });

  it('clears the session and returns false on INVALID_REFRESH_TOKEN', async () => {
    authState.setAccessToken('expired-token');

    const promise = authService.refreshSession();

    const req = httpMock.expectOne('/query');
    req.flush({
      errors: [
        { message: 'The refresh token is invalid.', extensions: { code: 'INVALID_REFRESH_TOKEN' } },
      ],
    });

    const result = await promise;
    expect(result).toBe(false);
    expect(authState.isAuthenticated()).toBe(false);
  });

  it('calls the logout mutation and clears the session', async () => {
    authState.setAccessToken('token-123');

    const promise = authService.logout();

    const req = httpMock.expectOne('/query');
    expect(req.request.body.query).toContain('mutation Logout');
    req.flush({ data: { logout: true } });

    await promise;
    expect(authState.isAuthenticated()).toBe(false);
  });

  describe('query orchestration', () => {
    it('refreshes once and retries on TOKEN_EXPIRED, updating the token on success', async () => {
      authState.setAccessToken('expired-token');

      const promise = authService.query<{ me: string }>({ query: '{ me }' });

      // Original operation fails with the expired bearer.
      let req = httpMock.expectOne('/query');
      expect(req.request.headers.get('Authorization')).toBe('Bearer expired-token');
      req.flush({
        errors: [
          { message: 'The access token has expired.', extensions: { code: 'TOKEN_EXPIRED' } },
        ],
      });
      await settle();

      // Refresh runs once, cookie-only (no bearer).
      req = httpMock.expectOne('/query');
      expect(req.request.body.query).toContain('mutation RefreshToken');
      expect(req.request.headers.has('Authorization')).toBeFalsy();
      req.flush({
        data: {
          refreshToken: { accessToken: 'refreshed-token', tokenType: 'Bearer', expiresIn: 900 },
        },
      });
      await settle();

      // The original operation is retried once with the new token.
      req = httpMock.expectOne('/query');
      expect(req.request.body.query).toContain('{ me }');
      expect(req.request.headers.get('Authorization')).toBe('Bearer refreshed-token');
      req.flush({ data: { me: 'user' } });

      const result = await promise;
      expect(result.data).toEqual({ me: 'user' });
      expect(authState.accessToken()).toBe('refreshed-token');
    });

    it('clears the session and returns the TOKEN_EXPIRED errors when the refresh fails', async () => {
      authState.setAccessToken('expired-token');

      const promise = authService.query<{ me: string }>({ query: '{ me }' });

      let req = httpMock.expectOne('/query');
      req.flush({ errors: [{ extensions: { code: 'TOKEN_EXPIRED' } }] });
      await settle();

      req = httpMock.expectOne('/query');
      req.flush({ errors: [{ extensions: { code: 'INVALID_REFRESH_TOKEN' } }] });

      const result = await promise;
      expect(result.errors?.[0]?.extensions?.code).toBe('TOKEN_EXPIRED');
      expect(authState.isAuthenticated()).toBe(false);
    });

    it('retries only once when TOKEN_EXPIRED persists after refresh', async () => {
      authState.setAccessToken('expired-token');

      const promise = authService.query<{ me: string }>({ query: '{ me }' });

      let req = httpMock.expectOne('/query');
      req.flush({ errors: [{ extensions: { code: 'TOKEN_EXPIRED' } }] });
      await settle();

      req = httpMock.expectOne('/query');
      req.flush({
        data: {
          refreshToken: { accessToken: 'refreshed-token', tokenType: 'Bearer', expiresIn: 900 },
        },
      });
      await settle();

      // The single retry still fails; no further refresh is attempted.
      req = httpMock.expectOne('/query');
      req.flush({ errors: [{ extensions: { code: 'TOKEN_EXPIRED' } }] });

      const result = await promise;
      expect(result.errors?.[0]?.extensions?.code).toBe('TOKEN_EXPIRED');
    });

    it('refreshes once and retries on UNAUTHENTICATED while a token is held', async () => {
      authState.setAccessToken('expired-token');

      const promise = authService.query<{ me: string }>({ query: '{ me }' });

      // The merged backend surfaces an expired bearer as UNAUTHENTICATED.
      let req = httpMock.expectOne('/query');
      expect(req.request.headers.get('Authorization')).toBe('Bearer expired-token');
      req.flush({
        errors: [
          { message: 'Authentication is required.', extensions: { code: 'UNAUTHENTICATED' } },
        ],
      });
      await settle();

      // Refresh runs once, cookie-only (no bearer).
      req = httpMock.expectOne('/query');
      expect(req.request.body.query).toContain('mutation RefreshToken');
      expect(req.request.headers.has('Authorization')).toBeFalsy();
      req.flush({
        data: {
          refreshToken: { accessToken: 'refreshed-token', tokenType: 'Bearer', expiresIn: 900 },
        },
      });
      await settle();

      // The original operation is retried once with the new token.
      req = httpMock.expectOne('/query');
      expect(req.request.body.query).toContain('{ me }');
      expect(req.request.headers.get('Authorization')).toBe('Bearer refreshed-token');
      req.flush({ data: { me: 'user' } });

      const result = await promise;
      expect(result.data).toEqual({ me: 'user' });
      expect(authState.accessToken()).toBe('refreshed-token');
    });

    it('passes UNAUTHENTICATED through untouched when no token is held', async () => {
      const promise = authService.query<{ me: string }>({ query: '{ me }' });

      const req = httpMock.expectOne('/query');
      expect(req.request.headers.has('Authorization')).toBeFalsy();
      req.flush({
        errors: [
          { message: 'Authentication is required.', extensions: { code: 'UNAUTHENTICATED' } },
        ],
      });

      const result = await promise;
      expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
      // No refresh was attempted (httpMock.verify() would fail otherwise).
    });

    it('clears the session and returns the UNAUTHENTICATED errors when the refresh fails', async () => {
      authState.setAccessToken('expired-token');

      const promise = authService.query<{ me: string }>({ query: '{ me }' });

      let req = httpMock.expectOne('/query');
      req.flush({ errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] });
      await settle();

      req = httpMock.expectOne('/query');
      req.flush({ errors: [{ extensions: { code: 'INVALID_REFRESH_TOKEN' } }] });

      const result = await promise;
      expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
      expect(authState.isAuthenticated()).toBe(false);
    });

    it('passes successful responses through untouched', async () => {
      const promise = authService.query<{ categories: unknown[] }>({
        query: '{ categories { id } }',
      });

      const req = httpMock.expectOne('/query');
      req.flush({ data: { categories: [] } });

      const result = await promise;
      expect(result.data).toEqual({ categories: [] });
    });
  });
});
