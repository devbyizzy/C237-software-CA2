const express = require("express");
const path = require("path");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 5173;
const API_URL =
  process.env.API_URL || "http://localhost:3000";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "rpconnect-development-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60,
    },
  })
);

const requestBackend = async (
  endpoint,
  method,
  body
) => {
  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  return {
    status: response.status,
    data,
  };
};

const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  next();
};

app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }

  return res.redirect("/login");
});

app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }

  res.render("auth/login", {
    error: null,
    success:
      req.query.registered === "true"
        ? "Your account has been created. You can now log in."
        : req.query.deleted === "true"
        ? "Your account has been permanently deleted."
        : null,
    formData: {},
  });
});

app.post("/login", async (req, res) => {
  const loginId =
    typeof req.body.loginId === "string"
      ? req.body.loginId.trim()
      : "";

  const password =
    typeof req.body.password === "string"
      ? req.body.password
      : "";

  if (!loginId || !password) {
    return res.status(400).render("auth/login", {
      error:
        "Please enter your username or RP email and password.",
      success: null,
      formData: {
        loginId,
      },
    });
  }

  try {
    const result = await requestBackend(
      "/api/auth/login",
      "POST",
      {
        loginId,
        password,
      }
    );

    if (!result.data.success) {
      return res
        .status(result.status)
        .render("auth/login", {
          error:
            result.data.message ||
            "Unable to log in.",
          success: null,
          formData: {
            loginId,
          },
        });
    }

    req.session.user =
      result.data.user || {
        loginId,
      };

    return req.session.save((error) => {
      if (error) {
        console.error(
          "Session save error:",
          error
        );

        return res
          .status(500)
          .render("auth/login", {
            error:
              "Login succeeded, but the session could not be created.",
            success: null,
            formData: {
              loginId,
            },
          });
      }

      return res.redirect("/dashboard");
    });
  } catch (error) {
    console.error(
      "Frontend login request error:",
      error
    );

    return res.status(503).render("auth/login", {
      error:
        "The authentication server is unavailable. Make sure the backend is running.",
      success: null,
      formData: {
        loginId,
      },
    });
  }
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
  res.status(404).send("Page not found");
});

app.listen(PORT, () => {
  console.log(
    `RPConnect frontend running at http://localhost:${PORT}`
  );
});