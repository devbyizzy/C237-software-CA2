const express = require("express");
const cors = require("cors");

const dashboardRoutes = require('./routes/dashboard');
const profileRoutes = require('./routes/profile');
const studentsRoutes = require('./routes/students');
const ccaRoutes = require('./routes/ccas');
const authRoutes = require("./routes/auth");
const passwordResetRoutes = require("./routes/passwordReset")
const twoFactorRoutes = require("./routes/twoFactor");

const pool = require('./utils/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// API routes
app.use("/api/auth", authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/ccas', ccaRoutes);
app.use("/api/auth", passwordResetRoutes);
app.use("/api/auth/2fa",twoFactorRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "RPConnect API is running",
    endpoints: [
      'GET  /api/dashboard',
      'GET  /api/profile',
      'PUT  /api/profile',
      'GET  /api/profile/:id',
      'GET  /api/students?diploma=&class_code=&interest=',
      'GET  /api/ccas?search=&category='
    ]
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
});

app.use((error, req, res, next) => {
  console.error("Backend error:", error);

  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
});

app.listen(PORT, () => {
  console.log(
    `RPConnect backend API running at http://localhost:${PORT}`
  );
});