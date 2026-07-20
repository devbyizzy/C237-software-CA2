// app.js - RPConnect entry point (Class and Friend Groups branch).
// Flow for every feature: user action -> Express route -> SQL query
// -> database response -> EJS renders the updated page.
const express = require('express');
const session = require('express-session');
const db = require('./db');

const app = express();

// EJS is the template engine: routes pass data to views/*.ejs files.
app.set('view engine', 'ejs');

// Parse HTML <form> submissions into req.body.
app.use(express.urlencoded({ extended: false }));

// Serve the stylesheet from /public.
app.use(express.static('public'));

// Session middleware: after login, req.session.userId identifies the user.
// (Member 1's real login feature will reuse this same session setup.)
app.use(session({
    secret: 'rpconnect-dev-secret',   // move to an env variable in production
    resave: false,
    saveUninitialized: false
}));

// Make the logged-in user's id available to every EJS view as "currentUserId".
app.use((req, res, next) => {
    res.locals.currentUserId = req.session.userId || null;
    next();
});

// Mount all /groups and /group-posts routes (this branch's feature).
app.use('/', require('./routes/groups'));

// Home page simply redirects to the groups browser for this branch.
app.get('/', (req, res) => res.redirect('/groups'));

// ------------------------------------------------------------------
// TEMPORARY dev login - REMOVE when Member 1's real login is merged.
// Lets us pick any user from the database so the session-protected
// group routes can be demonstrated on this branch alone.
// ------------------------------------------------------------------
app.get('/login', async (req, res) => {
    const [users] = await db.query('SELECT user_id, name, diploma FROM users');
    res.render('devLogin', { users });
});

app.post('/login', (req, res) => {
    req.session.userId = Number(req.body.user_id);  // what Member 1's code will also set
    res.redirect('/groups');
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

app.listen(3000, () => console.log('RPConnect running on http://localhost:3000'));
