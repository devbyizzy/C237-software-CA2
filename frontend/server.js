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

app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.listen(PORT, () => {
  console.log(`RPConnect frontend running at http://localhost:${PORT}`);
});