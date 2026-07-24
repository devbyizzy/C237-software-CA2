# RPConnect Admin Dashboard Changes

This file compiles the complete Admin Dashboard implementation currently in
the working tree. No migration was executed, no live data was changed, and no
Git commit or push was performed.

## Delivered functionality

### Dashboard and authorization

- Live dashboard counts for users, CCAs, RP Circles, and questions.
- Recent-user summary.
- Every `/admin` route is protected by an authenticated, exact lowercase
  `admin` role.
- Admin authorization is revalidated against the live user record on every
  admin request, including account status when the migration is installed.
- Existing normal-user sessions are also revalidated. Suspending or deleting
  an account clears its session on its next protected request.
- Before the account-status migration is installed, existing users continue
  to work while deleted user IDs still fail closed.

### User management

- Search and filter users by username, email, role, and account status.
- View account and profile details.
- Suspend and unsuspend accounts.
- Change roles using the strict `year1`, `year2`, `year3`, and `admin`
  allowlist.
- Require a dedicated acknowledgement before granting the `admin` role.
- Reset exactly the user's 2FA secret and enabled flag.
- Delete users with explicit cascade-impact warnings.
- Prevent self-suspension, self-role changes, and self-deletion.
- Lock active administrator rows during destructive admin-account changes.

### RP Circle management

- List and search all `student_groups`.
- View creator, academic context, accepted members, pending requests, posts,
  replies, and individual membership records.
- Delete a group through one parent-row delete, relying on the audited
  database cascades for memberships, posts, and replies.

### CCA management

- List, search, and filter CCAs.
- Create and edit CCAs using the live schema fields.
- Activate or deactivate a CCA.
- Delete a CCA.
- Validate name, category, description, weekdays, start/end times, location,
  contact email, HTTP(S) image URL, and status.

### Question moderation

- Graceful unavailable state until the question migration is installed.
- List, search, and filter questions.
- View questions and replies.
- Mark questions open or resolved.
- Delete questions and individual replies.
- Display helpful-vote counts when that table is available.

### Activity logs and UI

- Newest-first admin activity page.
- Filters for administrator, action, and target type.
- Consistent active-aware sidebar for Dashboard, Users, RP Circles, CCAs,
  Questions, Activity Logs, and Logout.
- Responsive, admin-scoped styles and accessible navigation/table behavior.
- All server-rendered dynamic values use escaped EJS output.

## Admin routes

```text
GET  /admin

GET  /admin/users
GET  /admin/users/:id
POST /admin/users/:id/reset-2fa
POST /admin/users/:id/suspend
POST /admin/users/:id/unsuspend
POST /admin/users/:id/change-role
POST /admin/users/:id/delete

GET  /admin/groups
GET  /admin/groups/:id
POST /admin/groups/:id/delete

GET  /admin/ccas
GET  /admin/ccas/new
POST /admin/ccas
GET  /admin/ccas/:id/edit
POST /admin/ccas/:id/edit
POST /admin/ccas/:id/toggle-status
POST /admin/ccas/:id/delete

GET  /admin/questions
GET  /admin/questions/:id
POST /admin/questions/:id/status
POST /admin/questions/:id/delete
POST /admin/question-replies/:id/delete

GET  /admin/activity
```

Every state-changing admin route uses POST, a session-bound CSRF token,
canonical positive IDs, server-side validation, parameterized SQL, a database
transaction, and an `admin_logs` entry.

## SQL migrations to run manually

The read-only schema audit confirmed that all three objects are currently
missing from the configured database. Run these files manually against the
RPConnect MySQL 8 database, preferably in this order:

1. `sql/20260724_create_admin_logs.sql`
2. `sql/20260724_add_user_account_status.sql`
3. `sql/20260724_create_question_moderation_tables.sql`

The migrations are non-destructive and rerunnable. Do not run
`sql/schema finial.sql` as a migration; that file rebuilds the database.

Until the migrations are installed:

- Dashboard, user browsing, RP Circle browsing, and CCA browsing still work.
- Suspension controls display as unavailable.
- Question moderation and activity history display an unavailable state.
- Mutations that require audit logging roll back and show a safe migration
  message.

## Files created

```text
ADMIN_DASHBOARD_CHANGES.md
backend/services/adminService.js
backend/services/adminValidation.js
backend/tests/accountStatus.test.js
backend/tests/adminService.test.js
backend/tests/adminValidation.test.js
backend/utils/accountStatus.js
frontend/middleware/requireAdmin.js
frontend/middleware/requireLogin.js
frontend/public/css/admin.css
frontend/routes/admin.js
frontend/tests/adminHelpers.test.js
frontend/tests/requireAdmin.test.js
frontend/tests/requireLogin.test.js
frontend/views/admin/activity.ejs
frontend/views/admin/cca-form.ejs
frontend/views/admin/ccas.ejs
frontend/views/admin/dashboard.ejs
frontend/views/admin/error.ejs
frontend/views/admin/group-details.ejs
frontend/views/admin/groups.ejs
frontend/views/admin/partials/header.ejs
frontend/views/admin/partials/sidebar.ejs
frontend/views/admin/question-details.ejs
frontend/views/admin/questions.ejs
frontend/views/admin/user-details.ejs
frontend/views/admin/users.ejs
sql/20260724_add_user_account_status.sql
sql/20260724_create_admin_logs.sql
sql/20260724_create_question_moderation_tables.sql
```

## Files modified

```text
backend/controllers/authController.js
backend/controllers/twoFactorController.js
backend/routes/ccas.js
frontend/public/js/nav.js
frontend/server.js
```

No package manifest or `node_modules` file was changed.

## Automated verification

Run from the repository root:

```powershell
node --test --test-isolation=none backend/tests/*.test.js frontend/tests/*.test.js
```

Expected result at handoff: `39` tests passed and `0` failed.

Syntax-check the changed JavaScript:

```powershell
$files = @(
  "backend/controllers/authController.js",
  "backend/controllers/twoFactorController.js",
  "backend/routes/ccas.js",
  "backend/services/adminService.js",
  "backend/services/adminValidation.js",
  "backend/utils/accountStatus.js",
  "frontend/middleware/requireAdmin.js",
  "frontend/middleware/requireLogin.js",
  "frontend/public/js/nav.js",
  "frontend/routes/admin.js",
  "frontend/server.js"
)

foreach ($file in $files) {
  node --check $file
}
```

The final verification also included:

- Read-only execution of every admin service listing/detail query against the
  current database.
- Successful EJS rendering of all eleven admin documents with populated,
  empty, unavailable, error, and self-account branches.
- Frontend smoke check: `/login` returned HTTP 200 and an unauthenticated
  `/admin` request redirected to `/login`.
- `git diff --check`.

## Exact local testing steps

1. Open the project:

   ```powershell
   Set-Location "C:\Republic Polytechnic\AY2026 - Sem 1\C237 - SoftwareAppDev\C237-software-CA2"
   ```

2. In MySQL Workbench, connect to the same database configured by the
   application and run the three migration files in the order listed above.

3. Start the backend in one terminal:

   ```powershell
   npm start --prefix backend
   ```

4. Start the frontend in a second terminal:

   ```powershell
   npm start --prefix frontend
   ```

5. Open `http://localhost:5173/login`.

6. Sign in as a normal user and confirm `/admin` returns Access denied.

7. Sign in as an administrator and confirm the six sidebar sections load.

8. Use disposable records to test:

   - user suspend/unsuspend, role change, and 2FA reset;
   - self-action protections;
   - RP Circle details and deletion;
   - CCA create, edit, status toggle, and deletion;
   - question status, reply deletion, and question deletion;
   - activity filters and newest-first ordering.

9. Suspend a user who is already signed in. On that user's next protected
   page request, confirm the session is cleared and redirected to login.

10. Use the permanent delete actions only with disposable test records. User,
    group, question, and reply deletion follows the foreign-key cascade
    warnings shown in the UI.

## Scope note

The legacy backend REST API does not have a shared authentication layer.
Frontend sessions and every new admin route are protected, and the old
unauthenticated CCA admin mutation endpoints were removed. Applying shared
authentication to every legacy API endpoint would be a separate,
application-wide authentication redesign.
