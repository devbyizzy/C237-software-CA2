const express = require("express");
const path = require("path");
const session = require("express-session");

const app = express();

const PORT = process.env.PORT || 5173;
const API_URL =
  process.env.API_URL || "http://localhost:3000";

app.set("view engine", "ejs");

app.set(
  "views",
  path.join(__dirname, "views")
);

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

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
  method = "GET",
  body = null
) => {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    options
  );

  let data;

  try {
    data = await response.json();
  } catch (error) {
    data = {
      success: false,
      message:
        "The backend returned an invalid response.",
    };
  }

  return {
    status: response.status,
    data,
  };
};

const requireLogin = (
  req,
  res,
  next
) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  return next();
};

const requireAdmin = (
  req,
  res,
  next
) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  if (
    req.session.user.role !== "admin"
  ) {
    return res
      .status(403)
      .send("Access denied.");
  }

  return next();
};

/*
|--------------------------------------------------------------------------
| Home
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }

  return res.redirect("/login");
});

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/dashboard");
  }

  let success = null;

  if (
    req.query.registered === "true"
  ) {
    success =
      "Your account has been created. You can now log in.";
  }

  if (
    req.query.deleted === "true"
  ) {
    success =
      "Your account has been permanently deleted.";
  }

  return res.render("auth/login", {
    error: null,
    success,
    formData: {},
  });
});

app.post(
  "/login",
  async (req, res) => {
    const loginId =
      typeof req.body.loginId ===
      "string"
        ? req.body.loginId.trim()
        : "";

    const password =
      typeof req.body.password ===
      "string"
        ? req.body.password
        : "";

    if (!loginId || !password) {
      return res
        .status(400)
        .render("auth/login", {
          error:
            "Please enter your username or RP email and password.",
          success: null,
          formData: {
            loginId,
          },
        });
    }

    try {
      const result =
        await requestBackend(
          "/api/auth/login",
          "POST",
          {
            loginId,
            password,
          }
        );

      if (
        !result.data ||
        !result.data.success
      ) {
        return res
          .status(result.status)
          .render("auth/login", {
            error:
              result.data?.message ||
              "Unable to log in.",
            success: null,
            formData: {
              loginId,
            },
          });
      }

      req.session.user =
        result.data.user;

      return req.session.save(
        (error) => {
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

          return res.redirect(
            "/dashboard"
          );
        }
      );
    } catch (error) {
      console.error(
        "Frontend login request error:",
        error
      );

      return res
        .status(503)
        .render("auth/login", {
          error:
            "The authentication server is unavailable. Make sure the backend is running.",
          success: null,
          formData: {
            loginId,
          },
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Registration
|--------------------------------------------------------------------------
*/

app.get(
  "/register",
  (req, res) => {
    if (req.session.user) {
      return res.redirect(
        "/dashboard"
      );
    }

    return res.render(
      "auth/register",
      {
        error: null,
        success: null,
        formData: {},
      }
    );
  }
);

app.post(
  "/register",
  async (req, res) => {
    const name =
      typeof req.body.name ===
      "string"
        ? req.body.name.trim()
        : "";

    const username =
      typeof req.body.username ===
      "string"
        ? req.body.username.trim()
        : "";

    const email =
      typeof req.body.email ===
      "string"
        ? req.body.email.trim()
        : "";

    const password =
      typeof req.body.password ===
      "string"
        ? req.body.password
        : "";

    const confirmPassword =
      typeof req.body
        .confirmPassword ===
      "string"
        ? req.body.confirmPassword
        : "";

    const formData = {
      name,
      username,
      email,
    };

    if (
      !name ||
      !username ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      return res
        .status(400)
        .render("auth/register", {
          error:
            "Please complete all required fields.",
          success: null,
          formData,
        });
    }

    try {
      const result =
        await requestBackend(
          "/api/auth/register",
          "POST",
          {
            name,
            username,
            email,
            password,
            confirmPassword,
          }
        );

      if (
        !result.data ||
        !result.data.success
      ) {
        return res
          .status(result.status)
          .render(
            "auth/register",
            {
              error:
                result.data
                  ?.message ||
                "Unable to create your account.",
              success: null,
              formData,
            }
          );
      }

      return res.redirect(
        "/login?registered=true"
      );
    } catch (error) {
      console.error(
        "Frontend registration request error:",
        error
      );

      return res
        .status(503)
        .render("auth/register", {
          error:
            "The authentication server is unavailable. Make sure the backend is running.",
          success: null,
          formData,
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

app.post(
  "/logout",
  (req, res) => {
    req.session.destroy(
      (error) => {
        if (error) {
          console.error(
            "Logout error:",
            error
          );

          return res
            .status(500)
            .send(
              "Unable to log out."
            );
        }

        res.clearCookie(
          "connect.sid"
        );

        return res.redirect(
          "/login"
        );
      }
    );
  }
);

/*
|--------------------------------------------------------------------------
| Delete Account
|--------------------------------------------------------------------------
*/

app.post(
  "/delete-account",
  requireLogin,
  async (req, res) => {
    const password =
      typeof req.body.password ===
      "string"
        ? req.body.password
        : "";

    if (!password) {
      return res.redirect(
        "/profile?deleteError=Please%20enter%20your%20password."
      );
    }

    try {
      const result =
        await requestBackend(
          "/api/auth/delete-account",
          "POST",
          {
            userId:
              req.session.user
                .userId,
            password,
          }
        );

      if (
        !result.data ||
        !result.data.success
      ) {
        const message =
          encodeURIComponent(
            result.data?.message ||
              "Unable to delete your account."
          );

        return res.redirect(
          `/profile?deleteError=${message}`
        );
      }

      return req.session.destroy(
        (error) => {
          if (error) {
            console.error(
              "Session destruction error:",
              error
            );

            return res
              .status(500)
              .send(
                "The account was deleted, but the session could not be cleared."
              );
          }

          res.clearCookie(
            "connect.sid"
          );

          return res.redirect(
            "/login?deleted=true"
          );
        }
      );
    } catch (error) {
      console.error(
        "Frontend delete account error:",
        error
      );

      return res.redirect(
        "/profile?deleteError=The%20authentication%20server%20is%20unavailable."
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/

app.get(
  "/dashboard",
  requireLogin,
  (req, res) => {
    return res.render("index", {
      user: req.session.user,
    });
  }
);

/*
|--------------------------------------------------------------------------
| Profile
|--------------------------------------------------------------------------
*/

app.get(
  "/profile",
  requireLogin,
  (req, res) => {
    return res.render(
      "profile",
      {
        user: req.session.user,
        deleteError:
          req.query
            .deleteError || null,
      }
    );
  }
);

/*
|--------------------------------------------------------------------------
| Students
|--------------------------------------------------------------------------
*/

app.get(
  "/students",
  requireLogin,
  (req, res) => {
    return res.render(
      "students",
      {
        user: req.session.user,
      }
    );
  }
);

/*
|--------------------------------------------------------------------------
| CCAs
|--------------------------------------------------------------------------
*/

app.get(
  "/ccas",
  requireLogin,
  (req, res) => {
    return res.render("ccas", {
      user: req.session.user,
    });
  }
);

app.get(
  "/ccas/:id",
  requireLogin,
  (req, res) => {
    return res.render(
      "ccaDetails",
      {
        user: req.session.user,
        ccaId: req.params.id,
      }
    );
  }
);

app.get(
  "/admin/ccas/add",
  requireLogin,
  (req, res) => {
    return res.render("addCCA", {
      user: req.session.user,
    });
  }
);

app.get(
  "/admin/ccas/:id/edit",
  requireLogin,
  (req, res) => {
    return res.render("editCCA", {
      user: req.session.user,
      ccaId: req.params.id,
    });
  }
);

/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  return res
    .status(404)
    .send("Page not found");
});

/*
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
*/

app.use(
  (error, req, res, next) => {
    console.error(
      "Frontend server error:",
      error
    );

    return res
      .status(500)
      .send(
        "An unexpected error occurred."
      );
  }
);

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
  console.log(
    `RPConnect frontend running at http://localhost:${PORT}`
  );

  console.log(
    `Serving static files from ${path.join(
      __dirname,
      "public"
    )}`
  );
});