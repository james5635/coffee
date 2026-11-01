import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { LoginComponent } from './pages/login/login.component';
import { ShellComponent } from './pages/shell/shell.component';

export const routes: Routes = [
  { path: 'login', title: 'Coffee Shop — Sign in', component: LoginComponent },
  { path: '', pathMatch: 'full', component: ShellComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
