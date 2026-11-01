import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AuthError, AuthService } from '../../services/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const authService = { login: vi.fn() };

  beforeEach(async () => {
    authService.login.mockReset();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  /** Fills the form with valid credentials (validation gates submit). */
  const fillForm = (fixture: ComponentFixture<LoginComponent>) => {
    const email = fixture.debugElement.query(By.css('input[type="email"]')).nativeElement;
    const password = fixture.debugElement.query(By.css('input[type="password"]')).nativeElement;
    email.value = 'owner@coffee.local';
    email.dispatchEvent(new Event('input'));
    password.value = 'password123';
    password.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const submitForm = async (fixture: ComponentFixture<LoginComponent>) => {
    const form = (fixture.nativeElement as HTMLElement).querySelector('form');
    form!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('renders the login form', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('form')).toBeTruthy();
    expect(compiled.querySelector('input[type="email"]')).toBeTruthy();
    expect(compiled.querySelector('input[type="password"]')).toBeTruthy();
    expect(compiled.querySelector('button[type="submit"]')).toBeTruthy();
  });

  it('shows an invalid-credentials error message on UNAUTHENTICATED', async () => {
    authService.login.mockRejectedValue(new AuthError('UNAUTHENTICATED'));

    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    fillForm(fixture);
    await submitForm(fixture);

    const compiled = fixture.nativeElement as HTMLElement;
    const message = compiled.querySelector('[role="alert"]');
    expect(message).toBeTruthy();
    expect(message!.textContent).toContain('Invalid email or password');
  });

  it('navigates to / on successful login', async () => {
    authService.login.mockResolvedValue({ accessToken: 'token-123' });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    fillForm(fixture);
    await submitForm(fixture);

    expect(authService.login).toHaveBeenCalledWith('owner@coffee.local', 'password123');
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });
});
