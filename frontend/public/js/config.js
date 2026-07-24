window.API_BASE_URL = (function () {
  var host = window.location.hostname;

  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  // Codespaces public URLs look like: NAME-5173.app.github.dev
  // The backend is the same NAME but on port 3000 instead.
  var backendHost = host.replace(/-\d+\./, '-3000.');
  return 'https://' + backendHost;
})();