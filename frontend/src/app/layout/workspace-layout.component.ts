import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AuthStateService } from '../services/auth-state.service';

/**
 * Shared workspace layout: every route except /login renders inside this
 * chrome, so the left sidebar is always available for navigation.
 *
 * Every user can reach the public menu and guest checkout. Staff links are
 * shown from the decoded access-token permissions when that claim is present;
 * when it is absent the design's authentication-only fallback applies and the
 * backend remains the permission boundary. The sidebar is hidden from nobody
 * except on the sign-in page, where there is nothing to navigate to yet.
 */
@Component({
  selector: 'app-workspace-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './workspace-layout.component.html',
  styleUrl: './workspace-layout.component.css',
})
export class WorkspaceLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);

  /** Sidebar drawer state (mobile only; static on desktop). */
  protected readonly sidebarOpen = signal(false);

  /** Whether a session is held; drives the footer action (Log out vs Sign in). */
  protected readonly isAuthenticated = computed(() => this.authState.isAuthenticated());

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

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closeSidebar();
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
