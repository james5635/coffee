package main

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/james5635/coffee/backend/graph"
	"github.com/james5635/coffee/backend/service"
	"github.com/james5635/coffee/backend/utils/auth"
	"log/slog"
)

// stubAuthService is a test double for service.AuthService.
type stubAuthService struct {
	authenticatePrincipal auth.Principal
	authenticateErr       error
	loginPair             service.TokenPair
	loginErr              error
	refreshPair           service.TokenPair
	refreshErr            error
	logoutErr             error
}

func (s *stubAuthService) Login(ctx context.Context, email, password string) (service.TokenPair, error) {
	return s.loginPair, s.loginErr
}

func (s *stubAuthService) Refresh(ctx context.Context, refreshToken string) (service.TokenPair, error) {
	return s.refreshPair, s.refreshErr
}

func (s *stubAuthService) Logout(ctx context.Context, refreshToken string) error {
	return s.logoutErr
}

func (s *stubAuthService) Authenticate(ctx context.Context, token string) (auth.Principal, error) {
	return s.authenticatePrincipal, s.authenticateErr
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func newTestContext(req *http.Request) *gin.Context {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	return c
}

func TestBearerMiddlewareNoTokenProceedsAnonymously(t *testing.T) {
	svc := &stubAuthService{}
	mw := bearerMiddleware(svc, testLogger())
	req := httptest.NewRequest("POST", "/query", nil)
	c := newTestContext(req)

	mw(c)

	if c.IsAborted() {
		t.Errorf("middleware aborted without a bearer token")
	}
	if _, ok := auth.PrincipalFromContext(c.Request.Context()); ok {
		t.Errorf("expected anonymous principal without a bearer token")
	}
}

func TestBearerMiddlewareValidTokenSetsPrincipal(t *testing.T) {
	principal := auth.NewPrincipal(1, []string{"owner"}, []string{"order.manage"})
	svc := &stubAuthService{authenticatePrincipal: principal}
	mw := bearerMiddleware(svc, testLogger())
	req := httptest.NewRequest("POST", "/query", nil)
	req.Header.Set("Authorization", "Bearer valid.access.token")
	c := newTestContext(req)

	mw(c)

	if c.IsAborted() {
		t.Errorf("middleware aborted for a valid bearer token")
	}
	got, ok := auth.PrincipalFromContext(c.Request.Context())
	if !ok {
		t.Fatalf("expected principal in context")
	}
	if got.UserID != 1 {
		t.Errorf("UserID = %d, want 1", got.UserID)
	}
	if !got.HasRole("owner") {
		t.Errorf("expected role owner")
	}
	if !got.HasPermission("order.manage") {
		t.Errorf("expected permission order.manage")
	}
}

func TestBearerMiddlewareExpiredTokenAborts401(t *testing.T) {
	svc := &stubAuthService{authenticateErr: service.ErrTokenExpired}
	mw := bearerMiddleware(svc, testLogger())
	req := httptest.NewRequest("POST", "/query", nil)
	req.Header.Set("Authorization", "Bearer expired.token")
	c := newTestContext(req)

	mw(c)

	if !c.IsAborted() {
		t.Errorf("expected middleware to abort for an expired token")
	}
	if c.Writer.Status() != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", c.Writer.Status(), http.StatusUnauthorized)
	}
}

func TestBearerMiddlewareInvalidTokenAborts401(t *testing.T) {
	svc := &stubAuthService{authenticateErr: service.ErrUnauthenticated}
	mw := bearerMiddleware(svc, testLogger())
	req := httptest.NewRequest("POST", "/query", nil)
	req.Header.Set("Authorization", "Bearer invalid.token")
	c := newTestContext(req)

	mw(c)

	if !c.IsAborted() {
		t.Errorf("expected middleware to abort for an invalid token")
	}
	if c.Writer.Status() != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", c.Writer.Status(), http.StatusUnauthorized)
	}
}

func TestBearerMiddlewareNonBearerHeaderProceedsAnonymously(t *testing.T) {
	svc := &stubAuthService{}
	mw := bearerMiddleware(svc, testLogger())
	req := httptest.NewRequest("POST", "/query", nil)
	req.Header.Set("Authorization", "Basic base64stuff")
	c := newTestContext(req)

	mw(c)

	if c.IsAborted() {
		t.Errorf("middleware aborted for a non-bearer authorization header")
	}
	if _, ok := auth.PrincipalFromContext(c.Request.Context()); ok {
		t.Errorf("expected anonymous principal for a non-bearer header")
	}
}

func TestBearerMiddlewareRefreshCookieStoredInContext(t *testing.T) {
	svc := &stubAuthService{}
	mw := bearerMiddleware(svc, testLogger())
	req := httptest.NewRequest("POST", "/query", nil)
	req.AddCookie(&http.Cookie{Name: "refresh_token", Value: "rt-123"})
	c := newTestContext(req)

	mw(c)

	got, ok := auth.RefreshTokenFromContext(c.Request.Context())
	if !ok {
		t.Fatalf("expected refresh token in context from cookie")
	}
	if got != "rt-123" {
		t.Errorf("refresh token = %q, want %q", got, "rt-123")
	}
}

func TestSetRefreshTokenCookieAttributes(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/query", nil)

	setRefreshTokenCookie(c, "rt-token")

	resp := w.Result()
	var found *http.Cookie
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "refresh_token" {
			found = cookie
			break
		}
	}
	if found == nil {
		t.Fatalf("refresh_token cookie was not set")
	}
	if found.Value != "rt-token" {
		t.Errorf("value = %q, want %q", found.Value, "rt-token")
	}
	if found.Path != "/" {
		t.Errorf("path = %q, want %q", found.Path, "/")
	}
	if !found.HttpOnly {
		t.Errorf("expected HttpOnly")
	}
	if found.SameSite != http.SameSiteLaxMode {
		t.Errorf("SameSite = %d, want %d (Lax)", found.SameSite, http.SameSiteLaxMode)
	}
	wantMaxAge := int(service.RefreshTokenTTL.Seconds())
	if found.MaxAge != wantMaxAge {
		t.Errorf("MaxAge = %d, want %d", found.MaxAge, wantMaxAge)
	}
	if strings.Contains(w.Header().Get("Set-Cookie"), "Secure") {
		t.Errorf("expected Secure=false in non-release mode")
	}
}

func TestClearRefreshTokenCookie(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/query", nil)

	clearRefreshTokenCookie(c)

	resp := w.Result()
	var found *http.Cookie
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "refresh_token" {
			found = cookie
			break
		}
	}
	if found == nil {
		t.Fatalf("refresh_token cookie was not cleared")
	}
	if found.Value != "" {
		t.Errorf("value = %q, want empty", found.Value)
	}
	if found.MaxAge != -1 {
		t.Errorf("MaxAge = %d, want -1", found.MaxAge)
	}
}

func TestRefreshCookieActionLogin(t *testing.T) {
	body := `{"data":{"login":{"accessToken":"at","refreshToken":"rt-1","tokenType":"Bearer","expiresIn":900}}}`
	token, action := refreshCookieAction([]byte(body))
	if action != "set" || token != "rt-1" {
		t.Errorf("got %q, %q; want %q, %q", token, action, "rt-1", "set")
	}
}

func TestRefreshCookieActionRefresh(t *testing.T) {
	body := `{"data":{"refreshToken":{"accessToken":"at","refreshToken":"rt-2","tokenType":"Bearer","expiresIn":900}}}`
	token, action := refreshCookieAction([]byte(body))
	if action != "set" || token != "rt-2" {
		t.Errorf("got %q, %q; want %q, %q", token, action, "rt-2", "set")
	}
}

func TestRefreshCookieActionLogout(t *testing.T) {
	body := `{"data":{"logout":true}}`
	token, action := refreshCookieAction([]byte(body))
	if action != "clear" {
		t.Errorf("got %q, %q; want %q, %q", token, action, "", "clear")
	}
}

func TestRefreshCookieActionErrorsNone(t *testing.T) {
	body := `{"data":{"login":null},"errors":[{"message":"bad credentials","extensions":{"code":"UNAUTHENTICATED"}}]}`
	token, action := refreshCookieAction([]byte(body))
	if action != "none" || token != "" {
		t.Errorf("got %q, %q; want %q, %q", token, action, "", "none")
	}
}

func TestRefreshCookieActionNullPayloadNone(t *testing.T) {
	body := `{"data":{"login":null,"refreshToken":null,"logout":null}}`
	_, action := refreshCookieAction([]byte(body))
	if action != "none" {
		t.Errorf("got %q, want %q", action, "none")
	}
}

func graphqlHandlerBody(t *testing.T, w *httptest.ResponseRecorder) []byte {
	t.Helper()
	resp := w.Result()
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read graphql response body: %v", err)
	}
	return body
}

func TestGraphQLHandlerLoginSetsRefreshCookie(t *testing.T) {
	svc := &stubAuthService{
		loginPair: service.TokenPair{
			AccessToken:  "access-token",
			RefreshToken: "rt-123",
			ExpiresIn:    900,
		},
	}
	resolvers := &graph.Resolver{Auth: svc}
	h := graphqlHandler(resolvers, testLogger())

	body := `{"query":"mutation { login(email: \"alice@example.com\", password: \"password\") { accessToken refreshToken tokenType expiresIn } }"}`
	req := httptest.NewRequest("POST", "/query", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req

	h(c)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	respBody := graphqlHandlerBody(t, w)
	if !strings.Contains(string(respBody), `"refreshToken":"rt-123"`) {
		t.Errorf("body = %s, want refreshToken rt-123", respBody)
	}
	setCookie := w.Header().Get("Set-Cookie")
	if !strings.Contains(setCookie, "refresh_token=rt-123") {
		t.Errorf("Set-Cookie = %q, want refresh_token=rt-123", setCookie)
	}
	if !strings.Contains(setCookie, "HttpOnly") {
		t.Errorf("expected HttpOnly in Set-Cookie: %q", setCookie)
	}
	if !strings.Contains(setCookie, "Path=/") {
		t.Errorf("expected Path=/ in Set-Cookie: %q", setCookie)
	}
	if !strings.Contains(setCookie, "SameSite=Lax") {
		t.Errorf("expected SameSite=Lax in Set-Cookie: %q", setCookie)
	}
	wantMaxAge := strconv.Itoa(int(service.RefreshTokenTTL.Seconds()))
	if !strings.Contains(setCookie, "Max-Age="+wantMaxAge) {
		t.Errorf("expected Max-Age=%s in Set-Cookie: %q", wantMaxAge, setCookie)
	}
	if strings.Contains(setCookie, "Secure") {
		t.Errorf("expected Secure=false in non-release mode: %q", setCookie)
	}
}

func TestGraphQLHandlerLogoutClearsRefreshCookie(t *testing.T) {
	svc := &stubAuthService{}
	resolvers := &graph.Resolver{Auth: svc}
	h := graphqlHandler(resolvers, testLogger())

	body := `{"query":"mutation { logout }"}`
	req := httptest.NewRequest("POST", "/query", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req

	h(c)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	respBody := graphqlHandlerBody(t, w)
	if !strings.Contains(string(respBody), `"logout":true`) {
		t.Errorf("body = %s, want logout true", respBody)
	}
	setCookie := w.Header().Get("Set-Cookie")
	if !strings.Contains(setCookie, "refresh_token=") {
		t.Errorf("Set-Cookie = %q, want refresh_token cleared", setCookie)
	}
}

// testAuthRouter builds a gin engine wiring bearerMiddleware ahead of the
// graphqlHandler, mirroring the production route in main.go.
func testAuthRouter(authSvc service.AuthService, resolvers *graph.Resolver) *gin.Engine {
	router := gin.New()
	router.POST("/query", bearerMiddleware(authSvc, testLogger()), graphqlHandler(resolvers, testLogger()))
	return router
}

// TestBearerMiddlewareExpiredWithRefreshCookieProceedsAnonymously verifies C1:
// an expired bearer token with a refresh_token cookie present must NOT short
// circuit to 401. The request proceeds anonymously so the refreshToken/logout
// resolvers can run, and the refresh token stays in context.
func TestBearerMiddlewareExpiredWithRefreshCookieProceedsAnonymously(t *testing.T) {
	svc := &stubAuthService{authenticateErr: service.ErrTokenExpired}
	mw := bearerMiddleware(svc, testLogger())
	req := httptest.NewRequest("POST", "/query", nil)
	req.Header.Set("Authorization", "Bearer expired.access.token")
	req.AddCookie(&http.Cookie{Name: "refresh_token", Value: "rt-123"})
	c := newTestContext(req)

	mw(c)

	if c.IsAborted() {
		t.Errorf("middleware aborted for an expired token with a refresh cookie")
	}
	if c.Writer.Status() == http.StatusUnauthorized {
		t.Errorf("status = %d, expected not 401 (request proceeded anonymously)", c.Writer.Status())
	}
	if _, ok := auth.PrincipalFromContext(c.Request.Context()); ok {
		t.Errorf("expected anonymous principal (no user) for expired token")
	}
	got, ok := auth.RefreshTokenFromContext(c.Request.Context())
	if !ok {
		t.Fatalf("expected refresh token in context from cookie")
	}
	if got != "rt-123" {
		t.Errorf("refresh token = %q, want %q", got, "rt-123")
	}
}

// TestBearerMiddlewareExpiredNoRefreshCookieAborts401 verifies C1: an expired
// bearer token without a refresh cookie still short-circuits with 401.
func TestBearerMiddlewareExpiredNoRefreshCookieAborts401(t *testing.T) {
	svc := &stubAuthService{authenticateErr: service.ErrTokenExpired}
	mw := bearerMiddleware(svc, testLogger())
	req := httptest.NewRequest("POST", "/query", nil)
	req.Header.Set("Authorization", "Bearer expired.access.token")
	c := newTestContext(req)

	mw(c)

	if !c.IsAborted() {
		t.Errorf("expected middleware to abort for an expired token without a refresh cookie")
	}
	if c.Writer.Status() != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", c.Writer.Status(), http.StatusUnauthorized)
	}
}

// TestGraphQLHandlerExpiredBearerWithRefreshCookieRefreshProceeds verifies C1
// end to end: an expired bearer token with a refresh cookie lets the refresh
// resolver run and rotate the token instead of returning 401.
func TestGraphQLHandlerExpiredBearerWithRefreshCookieRefreshProceeds(t *testing.T) {
	svc := &stubAuthService{
		authenticateErr: service.ErrTokenExpired,
		refreshPair: service.TokenPair{
			AccessToken:  "new-access",
			RefreshToken: "new-rt",
			ExpiresIn:    900,
		},
	}
	resolvers := &graph.Resolver{Auth: svc}
	router := testAuthRouter(svc, resolvers)

	body := `{"query":"mutation { refreshToken { accessToken refreshToken tokenType expiresIn } }"}`
	req := httptest.NewRequest("POST", "/query", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer expired.access.token")
	req.AddCookie(&http.Cookie{Name: "refresh_token", Value: "rt-123"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	respBody := graphqlHandlerBody(t, w)
	if !strings.Contains(string(respBody), `"refreshToken":"new-rt"`) {
		t.Errorf("body = %s, want rotated refresh token", respBody)
	}
	setCookie := w.Header().Get("Set-Cookie")
	if !strings.Contains(setCookie, "refresh_token=new-rt") {
		t.Errorf("Set-Cookie = %q, want refresh_token=new-rt", setCookie)
	}
}

// TestGraphQLHandlerExpiredBearerWithRefreshCookieLogoutClearsCookie verifies
// C1 end to end: logout is reachable with an expired bearer token when a
// refresh cookie is present, and the refresh cookie is cleared.
func TestGraphQLHandlerExpiredBearerWithRefreshCookieLogoutClearsCookie(t *testing.T) {
	svc := &stubAuthService{
		authenticateErr: service.ErrTokenExpired,
	}
	resolvers := &graph.Resolver{Auth: svc}
	router := testAuthRouter(svc, resolvers)

	body := `{"query":"mutation { logout }"}`
	req := httptest.NewRequest("POST", "/query", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer expired.access.token")
	req.AddCookie(&http.Cookie{Name: "refresh_token", Value: "rt-123"})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	respBody := graphqlHandlerBody(t, w)
	if !strings.Contains(string(respBody), `"logout":true`) {
		t.Errorf("body = %s, want logout true", respBody)
	}
	setCookie := w.Header().Get("Set-Cookie")
	if !strings.Contains(setCookie, "refresh_token=") {
		t.Errorf("Set-Cookie = %q, want refresh_token cleared", setCookie)
	}
	if !strings.Contains(setCookie, "Max-Age=-1") && !strings.Contains(setCookie, "Max-Age=0") {
		t.Errorf("expected cookie cleared (Max-Age=-1) in Set-Cookie: %q", setCookie)
	}
}
