import { Injectable, inject, signal } from '@angular/core';
import { MeDocument, MeQuery } from '../../graphql/generated/graphql';
import { AuthService } from './auth.service';

/** The signed-in user's own profile, fetched via the `me` query. */
export type Profile = MeQuery['me'];

/**
 * Reads the `me` query through the auth-aware orchestration (so an expired
 * access token triggers a transparent refresh + retry) and holds the result
 * in memory. Anonymous users and load failures leave the profile `null`; the
 * sidebar falls back to a generic avatar in that case.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly auth = inject(AuthService);

  private readonly viewer = signal<Profile | null>(null);

  /** The current viewer profile, or `null` when anonymous/unavailable. */
  readonly profile = this.viewer.asReadonly();

  /** Fetches the profile; returns whether it is now held. */
  async load(): Promise<boolean> {
    try {
      const response = await this.auth.query<MeQuery>({ query: MeDocument });
      const me = response.data?.me ?? null;
      this.viewer.set(me);
      return me !== null;
    } catch {
      this.viewer.set(null);
      return false;
    }
  }

  /** Clears the held profile (on logout). */
  clear(): void {
    this.viewer.set(null);
  }
}
