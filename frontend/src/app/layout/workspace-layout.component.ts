import { Component, ElementRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AuthStateService } from '../services/auth-state.service';
import { ProfileService } from '../services/profile.service';

/** Human labels for the staff roles; unknown roles fall back to the raw claim. */
const ROLE_LABELS: Record<string, string> = {
  owner_admin: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
  barista: 'Barista',
  customer: 'Customer',
};

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
export class WorkspaceLayoutComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly authState = inject(AuthStateService);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Sidebar drawer state (mobile only; static on desktop). */
  protected readonly sidebarOpen = signal(false);

  /** Whether the profile menu (name + logout) is open. */
  protected readonly profileOpen = signal(false);

  /** Whether a session is held; drives the footer action (profile vs Sign in). */
  protected readonly isAuthenticated = computed(() => this.authState.isAuthenticated());

  /** The loaded profile, or null while it is being fetched (or failed). */
  protected readonly profile = this.profileService.profile;

  /** First character of the display name, for the avatar circle; `?` when absent. */
  protected readonly profileInitial = computed(() => {
    const name = this.profile()?.displayName?.trim();
    return name ? name[0].toUpperCase() : '?';
  });

  /** First role, mapped to a human label; raw role when unknown; 'Account' when absent. */
  protected readonly roleLabel = computed(() => {
    const role = this.profile()?.roles[0];
    if (!role) {
      return 'Account';
    }
    return ROLE_LABELS[role] ?? role;
  });

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

  ngOnInit(): void {
    if (this.authState.isAuthenticated() && this.profile() === null) {
      void this.profileService.load();
    }
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  protected toggleProfile(): void {
    this.profileOpen.update((open) => !open);
  }

  protected closeProfile(): void {
    this.profileOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closeSidebar();
    this.closeProfile();
  }

  @HostListener('document:click', ['$event.target'])
  protected onDocumentClick(target: EventTarget | null): void {
    if (!this.profileOpen()) {
      return;
    }
    const root = this.host.nativeElement.querySelector('[data-profile-menu-root]');
    if (root && target instanceof Node && !root.contains(target)) {
      this.closeProfile();
    }
  }

  protected async logout(): Promise<void> {
    this.profileService.clear();
    this.profileOpen.set(false);
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
