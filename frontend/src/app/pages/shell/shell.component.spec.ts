import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthStateService } from '../../services/auth-state.service';
import { ShellComponent } from './shell.component';

// Builds an unsigned token shaped like the backend's access token.
function tokenWithClaims(claims: Record<string, unknown>): string {
  const payload = btoa(JSON.stringify(claims))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
}

describe('ShellComponent', () => {
  let authState: AuthStateService;

  const card = (
    fixture: ComponentFixture<ShellComponent>,
    key: string,
  ): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-card="${key}"]`);

  const createComponent = async (): Promise<ComponentFixture<ShellComponent>> => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [provideRouter([])],
    });
    authState = TestBed.inject(AuthStateService);
    authState.setAccessToken(tokenWithClaims({ permissions: [] }));
  });

  it('renders the welcome heading and cards for menu and new order', async () => {
    const fixture = await createComponent();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Welcome back');
    expect(card(fixture, 'menu')).toBeTruthy();
    expect(card(fixture, 'order')).toBeTruthy();
  });

  it('hides staff cards from a customer without staff permissions', async () => {
    const fixture = await createComponent();

    expect(card(fixture, 'prep')).toBeNull();
    expect(card(fixture, 'payments')).toBeNull();
    expect(card(fixture, 'reports')).toBeNull();
  });

  it('shows cards for the permissions the user holds', async () => {
    authState.setAccessToken(tokenWithClaims({ permissions: ['payment.accept'] }));

    const fixture = await createComponent();

    expect(card(fixture, 'payments')).toBeTruthy();
    expect(card(fixture, 'prep')).toBeNull();
  });

  it('shows every staff card when the claims claim is absent', async () => {
    authState.setAccessToken(tokenWithClaims({}));

    const fixture = await createComponent();

    expect(card(fixture, 'prep')).toBeTruthy();
    expect(card(fixture, 'payments')).toBeTruthy();
    expect(card(fixture, 'reports')).toBeTruthy();
  });
});
