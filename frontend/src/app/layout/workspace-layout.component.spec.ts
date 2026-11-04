import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AuthStateService } from '../services/auth-state.service';
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
  let authState: AuthStateService;

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
    TestBed.configureTestingModule({
      imports: [WorkspaceLayoutComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: { logout } }],
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

  it('shows Sign in instead of Log out when unauthenticated', async () => {
    authState.clearSession();

    const fixture = await createComponent();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-logout]')).toBeNull();
    expect(el.querySelector('[data-signin]')).toBeTruthy();
  });

  it('shows Log out instead of Sign in when authenticated', async () => {
    const fixture = await createComponent();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-logout]')).toBeTruthy();
    expect(el.querySelector('[data-signin]')).toBeNull();
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

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-logout]')
      ?.click();
    await settle();
    await fixture.whenStable();

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
