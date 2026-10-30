import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ code?: string; message?: string }>;
}

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class GraphQLService {
  private readonly http = inject(HttpClient);

  query<T>(req: GraphQLRequest, accessToken?: string): Promise<GraphQLResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response$ = this.http.post<GraphQLResponse<T>>('/query', req, { headers });
    return firstValueFrom(response$);
  }
}