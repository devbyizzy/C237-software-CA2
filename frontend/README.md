# RPConnect Frontend

Static HTML/CSS/JS client that fetches dashboard data from the backend API.

## Run

```
npm install
npm start        # http://localhost:5173
```

Make sure the backend is running first (default: http://localhost:3000). To point at a different
backend URL, edit `js/config.js` or set `window.API_BASE_URL` before `main.js` loads.

You can also just open `index.html` directly in a browser instead of running the server, as long
as the backend has CORS enabled (it does, by default).
