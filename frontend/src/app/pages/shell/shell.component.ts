import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AuthStateService } from '../../services/auth-state.service';

/**
 * Signed-in landing page and workspace navigation.
 *
 * Every user can reach the public menu and guest checkout. Staff links are
 * shown from the decoded access-token permissions when that claim is present;
 * when it is absent the design's authentication-only fallback applies and the
 * backend remains the permission boundary. The auth guard protects the route
 * itself, and the staff screens protect their own actions.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);

  /** Baristas and owners can open the preparation queue. */
  protected readonly canViewPrepQueue = computed(() =>
    this.authState.hasPermission('order.read.preparation_queue'),
  );

  /** Cashiers record payments; managers/owners also issue refunds. */
  protected readonly canManagePayments = computed(
    () =>
      this.authState.hasPermission('payment.accept') ||
      this.authState.hasPermission('payment.refund'),
  );

  /** Staff with the sales-report permission (or the auth-only fallback). */
  protected readonly canViewReports = computed(() =>
    this.authState.hasPermission('report.sales.read'),
  );

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
