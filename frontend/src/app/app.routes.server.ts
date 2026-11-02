import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // The login screen has no auth-state-dependent markup, so it can be
    // prerendered at build time.
    path: 'login',
    renderMode: RenderMode.Prerender,
  },
  {
    // Public menu data is fetched in the browser through the auth-aware
    // GraphQL path (`/query` with cookies), so it cannot be prerendered.
    path: 'menu',
    renderMode: RenderMode.Client,
  },
  {
    // Guest checkout reads the menu and places orders in the browser.
    path: 'order',
    renderMode: RenderMode.Client,
  },
  {
    // Staff screens depend on the in-memory-token auth guard and permission
    // claims, so they must render in the browser where that state exists.
    path: 'prep',
    renderMode: RenderMode.Client,
  },
  {
    path: 'payments',
    renderMode: RenderMode.Client,
  },
  {
    // The protected shell and unknown URLs fall back to client rendering.
    path: '**',
    renderMode: RenderMode.Client,
  },
];
