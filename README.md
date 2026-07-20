<<<<<<< HEAD
# C237-software-CA2 — RPConnect

C237 Software Application Development CA2 web application project.

RPConnect is an online community platform for Republic Polytechnic students.
**This branch implements Member 5's feature: Class and Friend Groups** — students
can create, browse, search, join and discuss in groups based on their class,
module, CCA or interests.

## Tech stack

Node.js + Express + EJS + MySQL (`mysql2`), following the C237 application flow:

```
user action → Express route → SQL query → database response → EJS update
```

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the database, tables and demo data:

   ```bash
   mysql -u root -p < sql/groups_schema.sql
   ```

   (Set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` environment variables if
   your MySQL credentials differ from `root` / empty password / `rpconnect`.)

3. Start the server:

   ```bash
   npm start
   ```

4. Open http://localhost:3000 — you'll be redirected to a temporary dev-login
   page (pick any demo user). This page is a stand-in until Member 1's real
   login/OTP feature is merged.

## Groups feature — routes

| Method | Route | Purpose | CRUD |
|--------|-------|---------|------|
| GET  | `/groups` | Browse + search groups (keyword, type, diploma filters) | Read |
| GET  | `/groups/create` | New-group form | — |
| POST | `/groups/create` | Insert group; creator becomes owner | Create |
| GET  | `/groups/:id` | Group details, members, join requests, discussion board | Read |
| GET  | `/groups/:id/edit` | Edit form (owner only) | — |
| POST | `/groups/:id/edit` | Update group details (owner only) | Update |
| POST | `/groups/:id/delete` | Delete group + cascade posts/members (owner only) | Delete |
| POST | `/groups/:id/join` | Join public group instantly / request private group | Create |
| POST | `/groups/:id/leave` | Leave a group (owner cannot leave) | Delete |
| POST | `/groups/:id/requests/:userId/accept` | Owner accepts a pending request | Update |
| POST | `/groups/:id/requests/:userId/reject` | Owner rejects a pending request | Update |
| POST | `/groups/:id/posts` | Member creates a discussion post | Create |
| POST | `/group-posts/:postId/replies` | Member replies to a post | Create |

## Database tables (see `sql/groups_schema.sql`)

- `groups` — group details (type, diploma/class/module info, privacy, max members)
- `group_members` — membership rows with `member_role` (owner/moderator/member)
  and `join_status` (pending/accepted/rejected) implementing the join-request flow
- `group_posts` — discussion board posts inside a group
- `group_replies` — replies under a post

All routes are session-protected: an unauthenticated visitor is redirected to
`/login` before any group page or action.
=======
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
>>>>>>> origin/main
