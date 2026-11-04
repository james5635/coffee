import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStateService } from '../../services/auth-state.service';

/**
 * Signed-in landing page: welcome + workspace cards. The shared left-sidebar
 * chrome lives in {@link WorkspaceLayoutComponent}; this component is the
 * page content only.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterLink],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  private readonly authState = inject(AuthStateService);

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
}
