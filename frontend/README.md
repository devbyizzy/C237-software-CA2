# RPConnect Frontend

EJS-rendered pages that fetch dashboard/profile/student data from the backend REST API
client-side (no server-side data injection — EJS is just the rendering engine).

## Run

```
npm install
npm start        # http://localhost:5173
```

Make sure the backend is running first (default: http://localhost:3000). To point at a different
backend URL, edit `public/js/config.js` or set `window.API_BASE_URL` before the page scripts load.

## Routes

- `/` - Dashboard
- `/profile` - Your own profile (or `/profile?id=<user_id>` to view another student's)
- `/students` - Student Finder

## Structure

```
server.js       Express server, EJS view engine
views/*.ejs     Page templates (index, profile, students)
public/css/     Stylesheet
public/js/      Client-side scripts (fetch calls to the backend API)
```
