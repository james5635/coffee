import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { AuthStateService } from '../services/auth-state.service';
import { ProfileService, Profile } from '../services/profile.service';
import { WorkspaceLayoutComponent } from './workspace-layout.component';

// Builds an unsigned token shaped like the backend's access token.
function tokenWithClaims(claims: Record<string, unknown>): string {
  const payload = btoa(JSON.stringify(claims))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
}

// Lets the component's floating logout promise settle before assertions.
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('WorkspaceLayoutComponent', () => {
  const logout = vi.fn().mockResolvedValue(undefined);
  const profileLoad = vi.fn().mockResolvedValue(true);
  const profileClear = vi.fn();
  let authState: AuthStateService;
  let profileSignal: ReturnType<typeof signal<Profile | null>>;
  const profileMock = () => ({
    profile: profileSignal.asReadonly(),
    load: profileLoad,
    clear: profileClear,
  });

  const navLink = (
    fixture: ComponentFixture<WorkspaceLayoutComponent>,
    key: string,
  ): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-nav="${key}"]`);

  const createComponent = async (): Promise<ComponentFixture<WorkspaceLayoutComponent>> => {
    const fixture = TestBed.createComponent(WorkspaceLayoutComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    logout.mockClear();
    profileLoad.mockClear();
    profileClear.mockClear();
    profileSignal = signal<Profile | null>({
      id: '1',
      email: 'olive@coffee.local',
      displayName: 'Olive Owner',
      roles: ['owner_admin'],
    });
    TestBed.configureTestingModule({
      imports: [WorkspaceLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { logout } },
        { provide: ProfileService, useValue: profileMock() },
      ],
    });
    authState = TestBed.inject(AuthStateService);
    authState.setAccessToken(tokenWithClaims({ permissions: [] }));
  });

  it('links every user to the menu and guest checkout', async () => {
    const fixture = await createComponent();

    expect(navLink(fixture, 'menu')).toBeTruthy();
    expect(navLink(fixture, 'order')).toBeTruthy();
  });

  it('hides staff screens from a customer without staff permissions', async () => {
    const fixture = await createComponent();

    expect(navLink(fixture, 'prep')).toBeNull();
    expect(navLink(fixture, 'payments')).toBeNull();
    expect(navLink(fixture, 'reports')).toBeNull();
  });

  it('shows the prep queue to a user with the preparation-queue permission', async () => {
    authState.setAccessToken(tokenWithClaims({ permissions: ['order.read.preparation_queue'] }));

    const fixture = await createComponent();

    expect(navLink(fixture, 'prep')).toBeTruthy();
    expect(navLink(fixture, 'payments')).toBeNull();
  });

  it('shows payments to a user who can accept payments', async () => {
    authState.setAccessToken(tokenWithClaims({ permissions: ['payment.accept'] }));

    const fixture = await createComponent();

    expect(navLink(fixture, 'payments')).toBeTruthy();
    expect(navLink(fixture, 'prep')).toBeNull();
  });

  it('shows payments to a user who can issue refunds', async () => {
    authState.setAccessToken(tokenWithClaims({ permissions: ['payment.refund'] }));

    const fixture = await createComponent();

    expect(navLink(fixture, 'payments')).toBeTruthy();
  });

  it('shows sales reports to a user with report.sales.read', async () => {
    authState.setAccessToken(tokenWithClaims({ permissions: ['report.sales.read'] }));

    const fixture = await createComponent();

    expect(navLink(fixture, 'reports')).toBeTruthy();
  });

  it('falls back to authentication-only gating when claims are absent', async () => {
    authState.setAccessToken(tokenWithClaims({}));

    const fixture = await createComponent();

    expect(navLink(fixture, 'prep')).toBeTruthy();
    expect(navLink(fixture, 'payments')).toBeTruthy();
    expect(navLink(fixture, 'reports')).toBeTruthy();
  });

  it('shows Sign in instead of the profile row when unauthenticated', async () => {
    authState.clearSession();

    const fixture = await createComponent();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-profile-toggle]')).toBeNull();
    expect(el.querySelector('[data-logout]')).toBeNull();
    expect(el.querySelector('[data-signin]')).toBeTruthy();
  });

  it('shows the profile row with name, role and initial avatar when authenticated', async () => {
    authState.setAccessToken(tokenWithClaims({ roles: ['owner_admin'], permissions: [] }));

    const fixture = await createComponent();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Olive Owner');
    expect(el.textContent).toContain('Owner');
    expect(el.querySelector('[data-profile-toggle]')?.textContent).toContain('O');
    expect(el.querySelector('[data-signin]')).toBeNull();
    expect(el.querySelector('[data-logout]')).toBeNull();
  });

  it('opens the profile menu on click and logs out from it', async () => {
    const fixture = await createComponent();
    const el = fixture.nativeElement as HTMLElement;

    const toggle = el.querySelector<HTMLButtonElement>('[data-profile-toggle]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    el.querySelector<HTMLButtonElement>('[data-logout]')!.click();
    await settle();
    await fixture.whenStable();

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('closes the profile menu on Escape', async () => {
    const fixture = await createComponent();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = el.querySelector<HTMLButtonElement>('[data-profile-toggle]')!;

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles the mobile drawer and reflects state on the toggle button', async () => {
    const fixture = await createComponent();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = el.querySelector<HTMLButtonElement>('[data-nav-toggle]')!;

    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the drawer on Escape and on backdrop click', async () => {
    const fixture = await createComponent();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = el.querySelector<HTMLButtonElement>('[data-nav-toggle]')!;

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();
    const backdrop = el.querySelector<HTMLButtonElement>(
      'button[aria-label="Close workspace menu"]',
    )!;
    backdrop.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('logs out and returns to the sign-in screen', async () => {
    const fixture = await createComponent();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('[data-profile-toggle]')!.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-logout]')!.click();
    await settle();
    await fixture.whenStable();

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
