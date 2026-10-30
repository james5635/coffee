import { Injectable, inject } from '@angular/core';
import { GraphQLService, GraphQLResponse } from './graphql.service';
import { AuthStateService } from './auth-state.service';

interface LoginResponse {
  login: {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
  };
}

interface RefreshTokenResponse {
  refreshToken: {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
  };
}

interface LogoutResponse {
  logout: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly graphql = inject(GraphQLService);
  private readonly authState = inject(AuthStateService);

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const response = await this.graphql.query<LoginResponse>({
      query: `
        mutation Login($email: String!, $password: String!) {
          login(email: $email, password: $password) {
            accessToken
            tokenType
            expiresIn
          }
        }
      `,
      variables: { email, password },
    });

    if (response.errors) {
      const code = response.errors[0]?.code;
      if (code === 'UNAUTHENTICATED') {
        throw new Error('UNAUTHENTICATED');
      }
      throw new Error(response.errors[0]?.message || 'Login failed');
    }

    const accessToken = response.data?.login?.accessToken;
    if (!accessToken) {
      throw new Error('No access token in response');
    }

    this.authState.setAccessToken(accessToken);
    return { accessToken };
  }

  async refreshSession(): Promise<boolean> {
    const response = await this.graphql.query<RefreshTokenResponse>({
      query: `
        mutation RefreshToken {
          refreshToken {
            accessToken
            tokenType
            expiresIn
          }
        }
      `,
    });

    if (response.errors) {
      const code = response.errors[0]?.code;
      if (code === 'INVALID_REFRESH_TOKEN') {
        this.authState.clearSession();
        return false;
      }
      throw new Error(response.errors[0]?.message || 'Refresh failed');
    }

    const accessToken = response.data?.refreshToken?.accessToken;
    if (!accessToken) {
      this.authState.clearSession();
      return false;
    }

    this.authState.setAccessToken(accessToken);
    return true;
  }

  async logout(): Promise<void> {
    await this.graphql.query<LogoutResponse>({
      query: `
        mutation Logout {
          logout
        }
      `,
    });

    this.authState.clearSession();
  }
}