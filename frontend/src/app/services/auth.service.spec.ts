import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { GraphQLService } from './graphql.service';
import { AuthStateService } from './auth-state.service';

describe('AuthService', () => {
  let authService: AuthService;
  let graphqlService: GraphQLService;
  let authState: AuthStateService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService, GraphQLService, AuthStateService],
    });
    authService = TestBed.inject(AuthService);
    graphqlService = TestBed.inject(GraphQLService);
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
    expect(req.request.body.variables).toEqual({ email: 'owner@coffee.local', password: 'password123' });
    req.flush({ data: { login: { accessToken: 'new-access-token', tokenType: 'Bearer', expiresIn: 900 } } });

    await promise;
    expect(authState.accessToken()).toBe('new-access-token');
  });

  it('throws on failed login (UNAUTHENTICATED)', async () => {
    const promise = authService.login('wrong@email.com', 'wrong');

    const req = httpMock.expectOne('/query');
    expect(req.request.body.query).toContain('mutation Login');
    req.flush({ errors: [{ code: 'UNAUTHENTICATED', message: 'Invalid credentials' }] });

    await expect(promise).rejects.toThrow('UNAUTHENTICATED');
    expect(authState.accessToken()).toBeNull();
  });

  it('returns false and clears session on INVALID_REFRESH_TOKEN', async () => {
    const promise = authService.refreshSession();

    const req = httpMock.expectOne('/query');
    expect(req.request.body.query).toContain('mutation RefreshToken');
    req.flush({ errors: [{ code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' }] });

    const result = await promise;
    expect(result).toBeFalsy();
    expect(authState.accessToken()).toBeNull();
  });

  it('returns true and updates token on successful refresh', async () => {
    const promise = authService.refreshSession();

    const req = httpMock.expectOne('/query');
    expect(req.request.body.query).toContain('mutation RefreshToken');
    req.flush({ data: { refreshToken: { accessToken: 'refreshed-token', tokenType: 'Bearer', expiresIn: 900 } } });

    const result = await promise;
    expect(result).toBeTruthy();
    expect(authState.accessToken()).toBe('refreshed-token');
  });

  it('calls logout mutation and clears session', async () => {
    const promise = authService.logout();

    const req = httpMock.expectOne('/query');
    expect(req.request.body.query).toContain('mutation Logout');
    req.flush({ data: { logout: true } });

    await promise;
    expect(authState.accessToken()).toBeNull();
  });
});