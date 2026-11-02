import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { LoginComponent } from './pages/login/login.component';
import { MenuComponent } from './pages/menu/menu.component';
import { OrderComponent } from './pages/order/order.component';
import { PaymentsComponent } from './pages/payments/payments.component';
import { PrepComponent } from './pages/prep/prep.component';
import { ShellComponent } from './pages/shell/shell.component';

export const routes: Routes = [
  // Public menu browsing: guests and signed-in staff share the same screen.
  { path: 'menu', title: 'Coffee Shop — Menu', component: MenuComponent },
  // Guest checkout stays public; the staff payment panel inside is gated by
  // the decoded `payment.accept` permission and the backend independently.
  { path: 'order', title: 'Coffee Shop — New order', component: OrderComponent },
  { path: 'login', title: 'Coffee Shop — Sign in', component: LoginComponent },
  // Staff screens require a signed-in session. Permissions are enforced by the
  // screens (hide/disable) and by the backend (FORBIDDEN), not by the guard.
  {
    path: 'prep',
    title: 'Coffee Shop — Preparation queue',
    component: PrepComponent,
    canActivate: [authGuard],
  },
  {
    path: 'payments',
    title: 'Coffee Shop — Payments & refunds',
    component: PaymentsComponent,
    canActivate: [authGuard],
  },
  // Signed-in landing page with the workspace navigation.
  { path: '', pathMatch: 'full', component: ShellComponent, canActivate: [authGuard] },
  // Unknown public URLs land on the menu rather than the protected shell.
  { path: '**', redirectTo: 'menu' },
];
