import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { GraphQLService } from './graphql.service';

describe('GraphQLService', () => {
  let service: GraphQLService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [GraphQLService],
    });
    service = TestBed.inject(GraphQLService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('sends POST to /query with variables', async () => {
    const promise = service.query({ query: '{ test }', variables: { id: 1 } });

    const req = httpMock.expectOne('/query');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ query: '{ test }', variables: { id: 1 } });
    req.flush({ data: { test: 'ok' } });

    const result = await promise;
    expect(result.data).toEqual({ test: 'ok' });
  });

  it('attaches Authorization header when accessToken is present', async () => {
    const promise = service.query({ query: '{ me }' }, 'access-token-123');

    const req = httpMock.expectOne('/query');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-token-123');
    req.flush({ data: { me: 'user' } });

    const result = await promise;
    expect(result.data).toEqual({ me: 'user' });
  });

  it('does not attach Authorization header when no token provided', async () => {
    const promise = service.query({ query: '{ test }' });

    const req = httpMock.expectOne('/query');
    expect(req.request.headers.has('Authorization')).toBeFalsy();
    req.flush({ data: { test: 'ok' } });

    const result = await promise;
    expect(result.data).toEqual({ test: 'ok' });
  });

  it('returns errors array from GraphQL response', async () => {
    const promise = service.query({ query: '{ test }' });

    const req = httpMock.expectOne('/query');
    req.flush({ errors: [{ code: 'UNAUTHENTICATED', message: 'Login required' }] });

    const result = await promise;
    expect(result.errors).toEqual([{ code: 'UNAUTHENTICATED', message: 'Login required' }]);
  });
});