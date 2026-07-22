const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5173;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/profile', (req, res) => {
  res.render('profile');
});

app.get('/students', (req, res) => {
  res.render('students');
});

app.get('/ccas', (req, res) => {
  res.render('ccas');
});

app.get('/ccas/:id', (req, res) => {
  res.render('ccaDetails');
});

app.get('/admin/ccas/add', (req, res) => {
  res.render('addCCA');
});

app.get('/admin/ccas/:id/edit', (req, res) => {
  res.render('editCCA');
});

app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.listen(PORT, () => {
  console.log(`RPConnect frontend running at http://localhost:${PORT}`);
});