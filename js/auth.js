// auth.js – Google OAuth 2.0
// v1.1 – Token-Client lazy initialisiert (Fix: GIS-Script async timing)

const Auth = (() => {
  let _tokenClient = null;
  let _accessToken = null;
  let _onLoginCallback = null;
  let _onLogoutCallback = null;

  // Scopes needed: Drive file access
  const SCOPES = 'https://www.googleapis.com/auth/drive.file';

  function init(onLogin, onLogout) {
    _onLoginCallback = onLogin;
    _onLogoutCallback = onLogout;

    // Check if token is stored in sessionStorage
    const stored = sessionStorage.getItem('gapi_token');
    if (stored) {
      _accessToken = JSON.parse(stored);
      if (_accessToken && _accessToken.expires_at > Date.now()) {
        if (_onLoginCallback) _onLoginCallback(_accessToken);
        return;
      } else {
        sessionStorage.removeItem('gapi_token');
        _accessToken = null;
      }
    }
    // Token-Client wird erst beim ersten login()-Aufruf initialisiert,
    // damit das GIS-Script garantiert geladen ist.
  }

  function _ensureTokenClient() {
    if (_tokenClient) return;
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse.error) {
          console.error('OAuth error:', tokenResponse.error);
          return;
        }
        _accessToken = {
          token: tokenResponse.access_token,
          expires_at: Date.now() + (tokenResponse.expires_in * 1000)
        };
        sessionStorage.setItem('gapi_token', JSON.stringify(_accessToken));
        if (_onLoginCallback) _onLoginCallback(_accessToken);
      }
    });
  }

  function login() {
    _ensureTokenClient();
    _tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  function logout() {
    if (_accessToken) {
      google.accounts.oauth2.revoke(_accessToken.token, () => {});
    }
    _accessToken = null;
    sessionStorage.removeItem('gapi_token');
    if (_onLogoutCallback) _onLogoutCallback();
  }

  function getToken() {
    if (!_accessToken) return null;
    if (_accessToken.expires_at <= Date.now()) {
      _accessToken = null;
      sessionStorage.removeItem('gapi_token');
      return null;
    }
    return _accessToken.token;
  }

  function isLoggedIn() {
    return getToken() !== null;
  }

  return { init, login, logout, getToken, isLoggedIn };
})();
