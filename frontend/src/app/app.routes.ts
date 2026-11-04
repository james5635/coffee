import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { WorkspaceLayoutComponent } from './layout/workspace-layout.component';
import { MenuComponent } from './pages/menu/menu.component';
import { ShellComponent } from './pages/shell/shell.component';

export const routes: Routes = [
  // Every route except /login renders inside the shared workspace layout
  // (left sidebar with the app navigation, mobile top bar + drawer). The
  // layout itself is public — guests get Menu and New order; staff links are
  // permission-gated inside the layout and the backend remains the boundary.
  {
    path: '',
    component: WorkspaceLayoutComponent,
    children: [
      {
        path: 'menu',
        title: 'Coffee Shop — Menu',
        component: MenuComponent,
      },
      // Guest checkout stays public; the staff payment panel inside is gated
      // by the decoded `payment.accept` permission and the backend
      // independently. Lazy-loaded so guest checkout code is not part of the
      // initial bundle until the customer actually starts an order.
      {
        path: 'order',
        title: 'Coffee Shop — New order',
        loadComponent: () =>
          import('./pages/order/order.component').then((m) => m.OrderComponent),
      },
      // Staff screens require a signed-in session. Permissions are enforced
      // by the screens (hide/disable) and by the backend (FORBIDDEN), not by
      // the guard. They are lazy-loaded so the authenticated staff workspace
      // code is not part of the initial bundle.
      {
        path: 'prep',
        title: 'Coffee Shop — Preparation queue',
        loadComponent: () =>
          import('./pages/prep/prep.component').then((m) => m.PrepComponent),
        canActivate: [authGuard],
      },
      {
        path: 'payments',
        title: 'Coffee Shop — Payments & refunds',
        loadComponent: () =>
          import('./pages/payments/payments.component').then((m) => m.PaymentsComponent),
        canActivate: [authGuard],
      },
      {
        path: 'reports',
        title: 'Coffee Shop — Sales reports',
        loadComponent: () =>
          import('./pages/reports/reports.component').then((m) => m.ReportsComponent),
        canActivate: [authGuard],
      },
      // Signed-in landing page with the workspace cards.
      { path: '', pathMatch: 'full', component: ShellComponent, canActivate: [authGuard] },
    ],
  },
  // Public auth entry; the screen has no auth-state-dependent markup, so it
  // can still be prerendered at build time while loading its component lazily.
  // It is deliberately outside the workspace layout.
  {
    path: 'login',
    title: 'Coffee Shop — Sign in',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  // Unknown public URLs land on the menu rather than the protected shell.
  { path: '**', redirectTo: 'menu' },
];
