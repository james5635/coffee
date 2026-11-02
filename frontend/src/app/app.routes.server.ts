import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // The login screen has no auth-state-dependent markup, so it can be
    // prerendered at build time.
    path: 'login',
    renderMode: RenderMode.Prerender,
  },
  {
    // The public menu fetches its data in the browser through the auth-aware
    // GraphQL path (`/query` with cookies), so it cannot be prerendered; render
    // it client-side like the rest of the data-backed screens.
    path: 'menu',
    renderMode: RenderMode.Client,
  },
  {
    // The protected shell is gated by the in-memory-token auth guard, so it
    // must render in the browser where that state exists.
    path: '**',
    renderMode: RenderMode.Client,
  },
];
