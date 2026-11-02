import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { MenuComponent } from './pages/menu/menu.component';
import { ShellComponent } from './pages/shell/shell.component';

export const routes: Routes = [
  // Public menu browsing: guests and signed-in staff share the same screen.
  { path: 'menu', title: 'Coffee Shop — Menu', component: MenuComponent },
  // Guest checkout stays public; the staff payment panel inside is gated by
  // the decoded `payment.accept` permission and the backend independently.
  // Lazy-loaded so guest checkout code is not part of the initial bundle until
  // the customer actually starts an order.
  {
    path: 'order',
    title: 'Coffee Shop — New order',
    loadComponent: () => import('./pages/order/order.component').then((m) => m.OrderComponent),
  },
  // Public auth entry; the screen has no auth-state-dependent markup, so it
  // can still be prerendered at build time while loading its component lazily.
  {
    path: 'login',
    title: 'Coffee Shop — Sign in',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  // Staff screens require a signed-in session. Permissions are enforced by the
  // screens (hide/disable) and by the backend (FORBIDDEN), not by the guard.
  // They are lazy-loaded so the authenticated staff workspace code is not part
  // of the initial bundle.
  {
    path: 'prep',
    title: 'Coffee Shop — Preparation queue',
    loadComponent: () => import('./pages/prep/prep.component').then((m) => m.PrepComponent),
    canActivate: [authGuard],
  },
  {
    path: 'payments',
    title: 'Coffee Shop — Payments & refunds',
    loadComponent: () =>
      import('./pages/payments/payments.component').then((m) => m.PaymentsComponent),
    canActivate: [authGuard],
  },
  // Signed-in landing page with the workspace navigation.
  { path: '', pathMatch: 'full', component: ShellComponent, canActivate: [authGuard] },
  // Unknown public URLs land on the menu rather than the protected shell.
  { path: '**', redirectTo: 'menu' },
];
