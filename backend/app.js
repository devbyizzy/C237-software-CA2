const express = require('express');
const cors = require('cors');

const dashboardRoutes = require('./routes/dashboard');
const profileRoutes = require('./routes/profile');
const studentsRoutes = require('./routes/students');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// API routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/students', studentsRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'RPConnect API is running',
    endpoints: [
      'GET  /api/dashboard',
      'GET  /api/profile',
      'PUT  /api/profile',
      'GET  /api/profile/:id',
      'GET  /api/students?diploma=&class_code=&interest='
    ]
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`RPConnect backend API running at http://localhost:${PORT}`);
});