import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthError, AuthService } from './auth.service';
import { AuthStateService } from './auth-state.service';
import { provideAppApollo } from '../app.config';

describe('AuthService', () => {
  let authService: AuthService;
  let authState: AuthStateService;
  let httpMock: HttpTestingController;

  /** Lets promise continuations (orchestration steps) run so the next request is issued. */
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  /** Waits for Apollo's link chain to reach the HTTP layer, then returns the request. */
  const takeRequest = async () => {
    await settle();
    return httpMock.expectOne('/query');
  };

  /** Waits for Apollo's link chain to reach the HTTP layer, then returns all requests. */
  const takeRequests = async () => {
    await settle();
    return httpMock.match(() => true);
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideAppApollo()],
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

    const req = await takeRequest();
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

    const req = await takeRequest();
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

    const req = await takeRequest();
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

    const req = await takeRequest();
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

    const req = await takeRequest();
    expect(req.request.body.query).toContain('mutation Logout');
    req.flush({ data: { logout: true } });

    await promise;
    expect(authState.isAuthenticated()).toBe(false);
  });

  describe('mutation documents', () => {
    it('selects the refreshToken field in the login mutation (backend cookie layer keys on it)', async () => {
      const promise = authService.login('owner@coffee.local', 'password123');

      const req = await takeRequest();
      expect(req.request.body.query).toMatch(/login\([^)]*\)\s*\{[^}]*\brefreshToken\b[^}]*\}/);
      req.flush({
        data: {
          login: {
            accessToken: 'new-access-token',
            tokenType: 'Bearer',
            expiresIn: 900,
            refreshToken: 'login-refresh-token',
          },
        },
      });

      await promise;
    });

    it('selects the nested refreshToken field in the refresh mutation (rotation must persist)', async () => {
      const promise = authService.refreshSession();

      const req = await takeRequest();
      expect(req.request.body.query).toMatch(/refreshToken\s*\{[^}]*\brefreshToken\b[^}]*\}/);
      req.flush({
        data: {
          refreshToken: {
            accessToken: 'refreshed-token',
            tokenType: 'Bearer',
            expiresIn: 900,
            refreshToken: 'rotated-refresh-token',
          },
        },
      });

      await promise;
    });

    it('discards the returned refresh token instead of persisting it client-side', async () => {
      const promise = authService.login('owner@coffee.local', 'password123');

      const req = await takeRequest();
      req.flush({
        data: {
          login: {
            accessToken: 'new-access-token',
            tokenType: 'Bearer',
            expiresIn: 900,
            refreshToken: 'login-refresh-token',
          },
        },
      });
      await promise;

      // Only the access token is retained; the refresh token travels solely
      // via the HttpOnly cookie.
      expect(authState.accessToken()).toBe('new-access-token');
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });

  describe('boot session restore', () => {
    it('restores the session from the refresh cookie and marks initialized', async () => {
      const promise = authService.restoreSession();

      const req = await takeRequest();
      expect(req.request.body.query).toContain('mutation RefreshToken');
      // Cookie-only: no bearer header at boot even though a stale token might exist.
      expect(req.request.headers.has('Authorization')).toBeFalsy();
      req.flush({
        data: {
          refreshToken: {
            accessToken: 'restored-token',
            tokenType: 'Bearer',
            expiresIn: 900,
            refreshToken: 'rotated-refresh-token',
          },
        },
      });

      await promise;
      expect(authState.accessToken()).toBe('restored-token');
      expect(authState.isInitialized()).toBe(true);
    });

    it('stays unauthenticated and marks initialized when the refresh cookie is invalid', async () => {
      const promise = authService.restoreSession();

      const req = await takeRequest();
      req.flush({
        errors: [
          {
            message: 'The refresh token is invalid.',
            extensions: { code: 'INVALID_REFRESH_TOKEN' },
          },
        ],
      });

      await promise;
      expect(authState.isAuthenticated()).toBe(false);
      expect(authState.isInitialized()).toBe(true);
    });

    it('skips the refresh when an access token is already held', async () => {
      authState.setAccessToken('existing-token');

      await authService.restoreSession();

      expect(authState.accessToken()).toBe('existing-token');
      expect(authState.isInitialized()).toBe(true);
      // No request was issued (httpMock.verify() would fail otherwise).
    });
  });

  describe('query orchestration', () => {
    it('refreshes once and retries on TOKEN_EXPIRED, updating the token on success', async () => {
      authState.setAccessToken('expired-token');

      const promise = authService.query<{ me: string }>({ query: '{ me }' });

      // Original operation fails with the expired bearer.
      let req = await takeRequest();
      expect(req.request.headers.get('Authorization')).toBe('Bearer expired-token');
      req.flush({
        errors: [
          { message: 'The access token has expired.', extensions: { code: 'TOKEN_EXPIRED' } },
        ],
      });
      await settle();

      // Refresh runs once, cookie-only (no bearer).
      req = await takeRequest();
      expect(req.request.body.query).toContain('mutation RefreshToken');
      expect(req.request.headers.has('Authorization')).toBeFalsy();
      req.flush({
        data: {
          refreshToken: { accessToken: 'refreshed-token', tokenType: 'Bearer', expiresIn: 900 },
        },
      });
      await settle();

      // The original operation is retried once with the new token.
      req = await takeRequest();
      expect(req.request.body.query).toMatch(/\{\s*me\s*\}/);
      expect(req.request.headers.get('Authorization')).toBe('Bearer refreshed-token');
      req.flush({ data: { me: 'user' } });

      const result = await promise;
      expect(result.data).toEqual({ me: 'user' });
      expect(authState.accessToken()).toBe('refreshed-token');
    });

    it('clears the session and returns the TOKEN_EXPIRED errors when the refresh fails', async () => {
      authState.setAccessToken('expired-token');

      const promise = authService.query<{ me: string }>({ query: '{ me }' });

      let req = await takeRequest();
      req.flush({ errors: [{ extensions: { code: 'TOKEN_EXPIRED' } }] });
      await settle();

      req = await takeRequest();
      req.flush({ errors: [{ extensions: { code: 'INVALID_REFRESH_TOKEN' } }] });

      const result = await promise;
      expect(result.errors?.[0]?.extensions?.code).toBe('TOKEN_EXPIRED');
      expect(authState.isAuthenticated()).toBe(false);
    });

    it('retries only once when TOKEN_EXPIRED persists after refresh', async () => {
      authState.setAccessToken('expired-token');

      const promise = authService.query<{ me: string }>({ query: '{ me }' });

      let req = await takeRequest();
      req.flush({ errors: [{ extensions: { code: 'TOKEN_EXPIRED' } }] });
      await settle();

      req = await takeRequest();
      req.flush({
        data: {
          refreshToken: { accessToken: 'refreshed-token', tokenType: 'Bearer', expiresIn: 900 },
        },
      });
      await settle();

      // The single retry still fails; no further refresh is attempted.
      req = await takeRequest();
      req.flush({ errors: [{ extensions: { code: 'TOKEN_EXPIRED' } }] });

      const result = await promise;
      expect(result.errors?.[0]?.extensions?.code).toBe('TOKEN_EXPIRED');
    });

    it('refreshes once and retries on UNAUTHENTICATED while a token is held', async () => {
      authState.setAccessToken('expired-token');

      const promise = authService.query<{ me: string }>({ query: '{ me }' });

      // The merged backend surfaces an expired bearer as UNAUTHENTICATED.
      let req = await takeRequest();
      expect(req.request.headers.get('Authorization')).toBe('Bearer expired-token');
      req.flush({
        errors: [
          { message: 'Authentication is required.', extensions: { code: 'UNAUTHENTICATED' } },
        ],
      });
      await settle();

      // Refresh runs once, cookie-only (no bearer).
      req = await takeRequest();
      expect(req.request.body.query).toContain('mutation RefreshToken');
      expect(req.request.headers.has('Authorization')).toBeFalsy();
      req.flush({
        data: {
          refreshToken: { accessToken: 'refreshed-token', tokenType: 'Bearer', expiresIn: 900 },
        },
      });
      await settle();

      // The original operation is retried once with the new token.
      req = await takeRequest();
      expect(req.request.body.query).toMatch(/\{\s*me\s*\}/);
      expect(req.request.headers.get('Authorization')).toBe('Bearer refreshed-token');
      req.flush({ data: { me: 'user' } });

      const result = await promise;
      expect(result.data).toEqual({ me: 'user' });
      expect(authState.accessToken()).toBe('refreshed-token');
    });

    it('passes UNAUTHENTICATED through untouched when no token is held', async () => {
      const promise = authService.query<{ me: string }>({ query: '{ me }' });

      const req = await takeRequest();
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

      let req = await takeRequest();
      req.flush({ errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] });
      await settle();

      req = await takeRequest();
      req.flush({ errors: [{ extensions: { code: 'INVALID_REFRESH_TOKEN' } }] });

      const result = await promise;
      expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
      expect(authState.isAuthenticated()).toBe(false);
    });

    it('coalesces concurrent refresh triggers into a single refresh mutation', async () => {
      authState.setAccessToken('expired-token');

      const promiseA = authService.query<{ ok: boolean }>({ query: '{ a }' });
      const promiseB = authService.query<{ ok: boolean }>({ query: '{ b }' });

      // Both original operations fail with the expired bearer.
      const originals = await takeRequests();
      expect(originals.length).toBe(2);
      for (const req of originals) {
        expect(req.request.headers.get('Authorization')).toBe('Bearer expired-token');
        req.flush({ errors: [{ extensions: { code: 'TOKEN_EXPIRED' } }] });
      }
      await settle();

      // Two triggers raced, but only ONE refresh mutation is dispatched
      // (expectOne throws if a second concurrent refresh were also issued).
      const refresh = await takeRequest();
      expect(refresh.request.body.query).toContain('mutation RefreshToken');
      refresh.flush({
        data: {
          refreshToken: { accessToken: 'refreshed-token', tokenType: 'Bearer', expiresIn: 900 },
        },
      });
      await settle();

      // Both operations retry with the shared fresh token.
      const retries = await takeRequests();
      expect(retries.length).toBe(2);
      for (const req of retries) {
        expect(req.request.headers.get('Authorization')).toBe('Bearer refreshed-token');
        req.flush({ data: { ok: true } });
      }

      const [resultA, resultB] = await Promise.all([promiseA, promiseB]);
      expect(resultA.data).toEqual({ ok: true });
      expect(resultB.data).toEqual({ ok: true });
      // The session survives: the losing trigger never clears the rotated token.
      expect(authState.accessToken()).toBe('refreshed-token');
    });

    it('shares one failing refresh across concurrent triggers and clears the session once', async () => {
      authState.setAccessToken('expired-token');

      const promiseA = authService.query<{ ok: boolean }>({ query: '{ a }' });
      const promiseB = authService.query<{ ok: boolean }>({ query: '{ b }' });

      const originals = await takeRequests();
      expect(originals.length).toBe(2);
      for (const req of originals) {
        req.flush({ errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] });
      }
      await settle();

      // A single refresh mutation serves both triggers, and it genuinely fails.
      const refresh = await takeRequest();
      refresh.flush({ errors: [{ extensions: { code: 'INVALID_REFRESH_TOKEN' } }] });

      const [resultA, resultB] = await Promise.all([promiseA, promiseB]);
      expect(resultA.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
      expect(resultB.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
      expect(authState.isAuthenticated()).toBe(false);
    });

    it('starts a fresh refresh after a previous in-flight refresh settles', async () => {
      const first = authService.refreshSession();
      let req = await takeRequest();
      req.flush({
        data: {
          refreshToken: { accessToken: 'token-1', tokenType: 'Bearer', expiresIn: 900 },
        },
      });
      expect(await first).toBe(true);

      // The in-flight slot is reset, so a later trigger refreshes again.
      const second = authService.refreshSession();
      req = await takeRequest();
      req.flush({
        data: {
          refreshToken: { accessToken: 'token-2', tokenType: 'Bearer', expiresIn: 900 },
        },
      });
      expect(await second).toBe(true);
      expect(authState.accessToken()).toBe('token-2');
    });

    it('passes successful responses through untouched', async () => {
      const promise = authService.query<{ categories: unknown[] }>({
        query: '{ categories { id } }',
      });

      const req = await takeRequest();
      req.flush({ data: { categories: [] } });

      const result = await promise;
      expect(result.data).toEqual({ categories: [] });
    });
  });
});
