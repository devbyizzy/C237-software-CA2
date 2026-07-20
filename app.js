const express = require('express');
const path = require('path');

const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing (for future POST forms)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.use('/dashboard', dashboardRoutes);

app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// 404 handler
app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.listen(PORT, () => {
  console.log(`RPConnect running at http://localhost:${PORT}`);
});
