import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthError, AuthService } from '../../services/auth.service';

/**
 * Public login screen. Submits credentials to `AuthService.login`; on success
 * the session is already stored in memory and the user is routed to the
 * protected shell. A backend `UNAUTHENTICATED` failure is surfaced as an
 * invalid-credentials message.
 */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.login(email.trim(), password);
      await this.router.navigate(['/']);
    } catch (error) {
      this.errorMessage.set(
        error instanceof AuthError && error.code === 'UNAUTHENTICATED'
          ? 'Invalid email or password.'
          : 'Something went wrong. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
