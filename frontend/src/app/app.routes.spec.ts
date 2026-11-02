import { RenderMode } from '@angular/ssr';
import { routes } from './app.routes';
import { serverRoutes } from './app.routes.server';
import { authGuard } from './auth/auth.guard';
import { MenuComponent } from './pages/menu/menu.component';

describe('app routes', () => {
  it('exposes /menu as a public route', () => {
    const menu = routes.find((route) => route.path === 'menu');

    expect(menu?.component).toBe(MenuComponent);
    expect(menu?.loadComponent).toBeUndefined();
    expect(menu?.canActivate).toBeUndefined();
  });

  it('exposes /order as a public guest checkout route', () => {
    const order = routes.find((route) => route.path === 'order');

    expect(order?.component).toBeUndefined();
    expect(order?.loadComponent).toBeInstanceOf(Function);
    expect(order?.canActivate).toBeUndefined();
  });

  it('protects the prep queue behind the auth guard', () => {
    const prep = routes.find((route) => route.path === 'prep');

    expect(prep?.component).toBeUndefined();
    expect(prep?.loadComponent).toBeInstanceOf(Function);
    expect(prep?.canActivate).toContain(authGuard);
  });

  it('protects payments behind the auth guard', () => {
    const payments = routes.find((route) => route.path === 'payments');

    expect(payments?.component).toBeUndefined();
    expect(payments?.loadComponent).toBeInstanceOf(Function);
    expect(payments?.canActivate).toContain(authGuard);
  });

  it('keeps the shell landing protected by the auth guard', () => {
    const shell = routes.find((route) => route.path === '');

    expect(shell?.canActivate).toContain(authGuard);
  });

  it('redirects unknown URLs to the public menu', () => {
    const fallback = routes.find((route) => route.path === '**');

    expect(fallback?.redirectTo).toBe('menu');
  });
});

describe('app server routes', () => {
  it('prerenders the login screen', () => {
    const login = serverRoutes.find((route) => route.path === 'login');

    expect(login?.renderMode).toBe(RenderMode.Prerender);
  });

  it.each(['menu', 'order', 'prep', 'payments'])(
    'renders /%s in the browser (data/auth are client-side)',
    (path) => {
      const route = serverRoutes.find((candidate) => candidate.path === path);

      expect(route?.renderMode).toBe(RenderMode.Client);
    },
  );

  it('renders the fallback route in the browser', () => {
    const fallback = serverRoutes.find((route) => route.path === '**');

    expect(fallback?.renderMode).toBe(RenderMode.Client);
  });
});
