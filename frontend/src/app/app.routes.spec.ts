import { RenderMode } from '@angular/ssr';
import { routes } from './app.routes';
import { serverRoutes } from './app.routes.server';
import { authGuard } from './auth/auth.guard';
import { MenuComponent } from './pages/menu/menu.component';

describe('app routes', () => {
  it('exposes /menu as a public route', () => {
    const menu = routes.find((route) => route.path === 'menu');

    expect(menu?.component).toBe(MenuComponent);
    expect(menu?.canActivate).toBeUndefined();
  });

  it('keeps the shell landing protected by the auth guard', () => {
    const shell = routes.find((route) => route.path === '');

    expect(shell?.canActivate).toContain(authGuard);
  });

  it('renders the public menu in the browser (it loads data through /query)', () => {
    const menu = serverRoutes.find((route) => route.path === 'menu');

    expect(menu?.renderMode).toBe(RenderMode.Client);
  });
});
