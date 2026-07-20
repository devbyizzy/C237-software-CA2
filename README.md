# RPConnect

Student community platform (no database, hardcoded sample data). Originally a single
Express + EJS server-rendered app; restructured into a separate `backend` (REST API)
and `frontend` (static client that consumes the API).

## Structure

```
backend/   Express REST API (JSON) - serves data from data/sampleData.js
frontend/  Static HTML/CSS/JS client - fetches from the backend API and renders the dashboard
```

## Run locally

Terminal 1:
```
cd backend
npm install
npm start        # http://localhost:3000
```

Terminal 2:
```
cd frontend
npm install
npm start        # http://localhost:5173
```

Then open http://localhost:5173 in your browser. The frontend calls the backend at
`http://localhost:3000` by default (configurable in `frontend/js/config.js`).
