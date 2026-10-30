import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly _accessToken = signal<string | null>(null);

  readonly accessToken = this._accessToken.asReadonly();

  readonly isAuthenticated = computed(() => this._accessToken() !== null);

  setAccessToken(token: string): void {
    this._accessToken.set(token);
  }

  clearSession(): void {
    this._accessToken.set(null);
  }
}