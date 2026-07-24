const express = require("express");
const cors = require("cors");

const dashboardRoutes = require('./routes/dashboard');
const profileRoutes = require('./routes/profile');
const studentsRoutes = require('./routes/students');
const ccaRoutes = require('./routes/ccas');
const groupRoutes = require('./routes/groups');
const groupPostRoutes = require('./routes/groupPosts');
const interestGroupRoutes = require('./routes/interestGroups');
const forumRoutes = require('./routes/forum');
const authRoutes = require("./routes/auth");
const passwordResetRoutes = require("./routes/passwordReset")
const twoFactorRoutes = require("./routes/twoFactor");
// ===== ADVANCED SEARCH FEATURE START =====
const searchRoutes = require('./routes/search');
// ===== ADVANCED SEARCH FEATURE END =====

const pool = require('./utils/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || origin === "http://localhost:5173" || origin.endsWith(".app.github.dev")) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
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
app.use('/api/groups', groupRoutes);
app.use('/api/group-posts', groupPostRoutes);
app.use('/api/interest-groups', interestGroupRoutes);
app.use('/api/questions', forumRoutes);
app.use("/api/auth", passwordResetRoutes);
app.use("/api/auth/2fa",twoFactorRoutes);
// ===== ADVANCED SEARCH FEATURE START =====
app.use('/api', searchRoutes);
// ===== ADVANCED SEARCH FEATURE END =====

app.get("/", (req, res) => {
  res.json({
    message: "RPConnect API is running",
    endpoints: [
      'GET  /api/dashboard',
      'GET  /api/profile',
      'PUT  /api/profile',
      'GET  /api/profile/:id',
      'GET  /api/students?diploma=&class_code=&interest=',
      'GET  /api/ccas?search=&category=',
      'GET  /api/groups?search=&type=&diploma=&class_code=&sort=&mine=&user_id=',
      'GET  /api/groups/dashboard?user_id=',
      'GET  /api/groups/:id',
      'GET  /api/groups/:id/members',
      'GET  /api/groups/:id/posts',
      'GET  /api/groups/:id/requests?user_id=',
      'POST /api/groups',
      'POST /api/groups/:id/edit',
      'POST /api/groups/:id/delete',
      'POST /api/groups/:id/join',
      'POST /api/groups/:id/leave',
      'POST /api/groups/:id/requests/:userId/accept',
      'POST /api/groups/:id/requests/:userId/reject',
      'POST /api/groups/:id/posts',
      'POST /api/group-posts/:id/replies'
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