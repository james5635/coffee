import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Minimal authenticated shell rendered at `/` behind `authGuard`: a header
 * with a link to the public menu and a logout control. Phase 1 placeholder
 * content until product screens land in Phase 2.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterLink],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
