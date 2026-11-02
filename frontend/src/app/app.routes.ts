import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { LoginComponent } from './pages/login/login.component';
import { MenuComponent } from './pages/menu/menu.component';
import { ShellComponent } from './pages/shell/shell.component';

export const routes: Routes = [
  // Public menu browsing: guests and signed-in staff share the same screen.
  { path: 'menu', title: 'Coffee Shop — Menu', component: MenuComponent },
  { path: 'login', title: 'Coffee Shop — Sign in', component: LoginComponent },
  // Phase 1 protected shell. Task 6 replaces it with the full staff navigation.
  { path: '', pathMatch: 'full', component: ShellComponent, canActivate: [authGuard] },
  // Unknown public URLs land on the menu rather than the protected shell.
  { path: '**', redirectTo: 'menu' },
];
