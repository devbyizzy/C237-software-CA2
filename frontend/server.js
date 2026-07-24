const express = require("express");
const path = require("path");
const session = require("express-session");
const adminRoutes = require("./routes/admin");
const requireAdmin = require(
  "./middleware/requireAdmin"
);
const requireLogin = require(
  "./middleware/requireLogin"
);

const app = express();

const PORT = 5173;
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

const getAuthenticatedLandingPath = (
  user
) => {
  return user && user.role === "admin"
    ? "/admin"
    : "/dashboard";
};

app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect(
      getAuthenticatedLandingPath(
        req.session.user
      )
    );
  }

  return res.redirect("/login");
});

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

app.use(
  "/admin",
  requireAdmin,
  adminRoutes
);

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect(
      getAuthenticatedLandingPath(
        req.session.user
      )
    );
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

    /*
|--------------------------------------------------------------------------
| Mandatory 2FA Setup
|--------------------------------------------------------------------------
*/

if (result.data.requiresTwoFactorSetup) {
  req.session.pendingUser =
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
              "Unable to start 2FA setup.",
            success: null,
            formData: {
              loginId,
            },
          });
      }

      return res.redirect(
        "/setup-2fa"
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| Existing user must verify 2FA
|--------------------------------------------------------------------------
*/

if (result.data.requiresTwoFactor) {
  req.session.pendingUser =
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
              "Unable to start 2FA verification.",
            success: null,
            formData: {
              loginId,
            },
          });
      }

      return res.redirect(
        "/verify-2fa"
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| Safety fallback
|--------------------------------------------------------------------------
*/

return res
  .status(500)
  .render("auth/login", {
    error:
      "Invalid authentication response.",
    success: null,
    formData: {
      loginId,
    },
  });

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
        getAuthenticatedLandingPath(
          req.session.user
        )
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
| Forgot password
|--------------------------------------------------------------------------
*/

app.get("/forgot-password", (req, res) => {
  if (req.session.user) {
    return res.redirect(
      getAuthenticatedLandingPath(
        req.session.user
      )
    );
  }

  return res.render("auth/forgot-password", {
    error: null,
    success: null,
    resetLink: null,
    formData: {},
  });
});

app.post("/forgot-password", async (req, res) => {
  const email =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

  if (!email) {
    return res.status(400).render(
      "auth/forgot-password",
      {
        error: "Please enter your RP email.",
        success: null,
        resetLink: null,
        formData: {
          email,
        },
      }
    );
  }

  try {
    const result = await requestBackend(
      "/api/auth/forgot-password",
      "POST",
      {
        email,
      }
    );

    if (!result.data || !result.data.success) {
      return res.status(result.status).render(
        "auth/forgot-password",
        {
          error:
            result.data?.message ||
            "Unable to process the password reset request.",
          success: null,
          resetLink: null,
          formData: {
            email,
          },
        }
      );
    }

    return res.render("auth/forgot-password", {
      error: null,
      success: result.data.message,
      resetLink: result.data.resetLink || null,
      formData: {
        email,
      },
    });
  } catch (error) {
    console.error(
      "Frontend forgot-password error:",
      error
    );

    return res.status(503).render(
      "auth/forgot-password",
      {
        error:
          "The authentication server is unavailable.",
        success: null,
        resetLink: null,
        formData: {
          email,
        },
      }
    );
  }
});

/*
|--------------------------------------------------------------------------
| Reset password
|--------------------------------------------------------------------------
*/

app.get(
  "/reset-password",
  async (req, res) => {
    if (req.session.user) {
      return res.redirect(
        getAuthenticatedLandingPath(
          req.session.user
        )
      );
    }

    const token =
      typeof req.query.token === "string"
        ? req.query.token.trim()
        : "";

    if (!token) {
      return res.status(400).render(
        "auth/reset-password",
        {
          error:
            "The password reset token is missing.",
          success: null,
          token: "",
          tokenValid: false,
        }
      );
    }

    try {
      const result = await requestBackend(
        `/api/auth/reset-password/${encodeURIComponent(
          token
        )}`,
        "GET"
      );

      if (
        !result.data ||
        !result.data.success
      ) {
        return res.status(result.status).render(
          "auth/reset-password",
          {
            error:
              result.data?.message ||
              "This password reset link is invalid or has expired.",
            success: null,
            token: "",
            tokenValid: false,
          }
        );
      }

      return res.render(
        "auth/reset-password",
        {
          error: null,
          success: null,
          token,
          tokenValid: true,
        }
      );
    } catch (error) {
      console.error(
        "Frontend reset-token verification error:",
        error
      );

      return res.status(503).render(
        "auth/reset-password",
        {
          error:
            "The authentication server is unavailable.",
          success: null,
          token: "",
          tokenValid: false,
        }
      );
    }
  }
);

app.post(
  "/reset-password",
  async (req, res) => {
    if (req.session.user) {
      return res.redirect(
        getAuthenticatedLandingPath(
          req.session.user
        )
      );
    }

    const token =
      typeof req.body.token === "string"
        ? req.body.token.trim()
        : "";

    const password =
      typeof req.body.password === "string"
        ? req.body.password
        : "";

    const confirmPassword =
      typeof req.body.confirmPassword ===
      "string"
        ? req.body.confirmPassword
        : "";

    if (
      !token ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).render(
        "auth/reset-password",
        {
          error:
            "Please complete all required fields.",
          success: null,
          token,
          tokenValid: Boolean(token),
        }
      );
    }

    const passwordIsValid =
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password);

    if (!passwordIsValid) {
      return res.status(400).render(
        "auth/reset-password",
        {
          error:
            "Password must contain at least 8 characters, one uppercase letter, one lowercase letter and one number.",
          success: null,
          token,
          tokenValid: true,
        }
      );
    }

    if (
      password !== confirmPassword
    ) {
      return res.status(400).render(
        "auth/reset-password",
        {
          error:
            "The passwords do not match.",
          success: null,
          token,
          tokenValid: true,
        }
      );
    }

    try {
      const result = await requestBackend(
        "/api/auth/reset-password",
        "POST",
        {
          token,
          password,
          confirmPassword,
        }
      );

      if (
        !result.data ||
        !result.data.success
      ) {
        return res.status(result.status).render(
          "auth/reset-password",
          {
            error:
              result.data?.message ||
              "Unable to reset your password.",
            success: null,
            token,
            tokenValid: true,
          }
        );
      }

      return res.redirect(
        "/login?passwordReset=true"
      );
    } catch (error) {
      console.error(
        "Frontend reset-password error:",
        error
      );

      return res.status(503).render(
        "auth/reset-password",
        {
          error:
            "The authentication server is unavailable.",
          success: null,
          token,
          tokenValid: true,
        }
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| Mandatory 2FA Setup
|--------------------------------------------------------------------------
*/

app.get(
  "/setup-2fa",
  async (req, res) => {
    if (req.session.user) {
      return res.redirect(
        getAuthenticatedLandingPath(
          req.session.user
        )
      );
    }

    if (!req.session.pendingUser) {
      return res.redirect("/login");
    }

    try {
      /*
      |--------------------------------------------------------------------------
      | Reuse the same temporary secret when refreshing the page
      |--------------------------------------------------------------------------
      */

      if (
        req.session.pendingTwoFactorSecret &&
        req.session.pendingTwoFactorQrCode
      ) {
        return res.render(
          "auth/setup-2fa",
          {
            error: null,
            user:
              req.session.pendingUser,
            secret:
              req.session
                .pendingTwoFactorSecret,
            qrCodeDataUrl:
              req.session
                .pendingTwoFactorQrCode,
          }
        );
      }

      const result =
        await requestBackend(
          "/api/auth/2fa/setup",
          "POST",
          {
            userId:
              req.session.pendingUser
                .userId,
          }
        );

      if (
        !result.data ||
        !result.data.success
      ) {
        return res
          .status(result.status)
          .render(
            "auth/setup-2fa",
            {
              error:
                result.data?.message ||
                "Unable to create the 2FA setup.",
              user:
                req.session.pendingUser,
              secret: null,
              qrCodeDataUrl: null,
            }
          );
      }

      req.session
        .pendingTwoFactorSecret =
        result.data.secret;

      req.session
        .pendingTwoFactorQrCode =
        result.data.qrCodeDataUrl;

      return req.session.save(
        (error) => {
          if (error) {
            console.error(
              "2FA setup session error:",
              error
            );

            return res
              .status(500)
              .render(
                "auth/setup-2fa",
                {
                  error:
                    "Unable to save the 2FA setup.",
                  user:
                    req.session
                      .pendingUser,
                  secret: null,
                  qrCodeDataUrl:
                    null,
                }
              );
          }

          return res.render(
            "auth/setup-2fa",
            {
              error: null,
              user:
                req.session.pendingUser,
              secret:
                result.data.secret,
              qrCodeDataUrl:
                result.data
                  .qrCodeDataUrl,
            }
          );
        }
      );
    } catch (error) {
      console.error(
        "Frontend 2FA setup error:",
        error
      );

      return res
        .status(503)
        .render("auth/setup-2fa", {
          error:
            "The authentication server is unavailable.",
          user:
            req.session.pendingUser,
          secret: null,
          qrCodeDataUrl: null,
        });
    }
  }
);

app.post(
  "/setup-2fa",
  async (req, res) => {
    if (req.session.user) {
      return res.redirect(
        getAuthenticatedLandingPath(
          req.session.user
        )
      );
    }

    if (
      !req.session.pendingUser ||
      !req.session
        .pendingTwoFactorSecret
    ) {
      return res.redirect("/login");
    }

    const code =
      typeof req.body.code === "string"
        ? req.body.code
            .replace(/\s+/g, "")
            .trim()
        : "";

    if (!/^\d{6}$/.test(code)) {
      return res
        .status(400)
        .render("auth/setup-2fa", {
          error:
            "Enter the 6-digit code from your authenticator app.",
          user:
            req.session.pendingUser,
          secret:
            req.session
              .pendingTwoFactorSecret,
          qrCodeDataUrl:
            req.session
              .pendingTwoFactorQrCode,
        });
    }

    try {
      const result =
        await requestBackend(
          "/api/auth/2fa/enable",
          "POST",
          {
            userId:
              req.session.pendingUser
                .userId,

            secret:
              req.session
                .pendingTwoFactorSecret,

            code,
          }
        );

      if (
        !result.data ||
        !result.data.success
      ) {
        return res
          .status(result.status)
          .render(
            "auth/setup-2fa",
            {
              error:
                result.data?.message ||
                "The verification code is invalid.",
              user:
                req.session.pendingUser,
              secret:
                req.session
                  .pendingTwoFactorSecret,
              qrCodeDataUrl:
                req.session
                  .pendingTwoFactorQrCode,
            }
          );
      }

      /*
      |--------------------------------------------------------------------------
      | 2FA setup completed — create the real login session
      |--------------------------------------------------------------------------
      */

      req.session.user =
        req.session.pendingUser;

      delete req.session.pendingUser;
      delete req.session
        .pendingTwoFactorSecret;
      delete req.session
        .pendingTwoFactorQrCode;

      return req.session.save(
        (error) => {
          if (error) {
            console.error(
              "2FA completion session error:",
              error
            );

            return res
              .status(500)
              .send(
                "2FA was enabled, but the login session could not be created."
              );
          }

          return res.redirect(
            getAuthenticatedLandingPath(
              req.session.user
            )
          );
        }
      );
    } catch (error) {
      console.error(
        "Frontend enable 2FA error:",
        error
      );

      return res
        .status(503)
        .render("auth/setup-2fa", {
          error:
            "The authentication server is unavailable.",
          user:
            req.session.pendingUser,
          secret:
            req.session
              .pendingTwoFactorSecret,
          qrCodeDataUrl:
            req.session
              .pendingTwoFactorQrCode,
        });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Verify 2FA During Login
|--------------------------------------------------------------------------
*/

app.get(
  "/verify-2fa",
  (req, res) => {
    if (req.session.user) {
      return res.redirect(
        getAuthenticatedLandingPath(
          req.session.user
        )
      );
    }

    if (!req.session.pendingUser) {
      return res.redirect("/login");
    }

    return res.render(
      "auth/verify-2fa",
      {
        error: null,
        user:
          req.session.pendingUser,
      }
    );
  }
);

app.post(
  "/verify-2fa",
  async (req, res) => {
    if (req.session.user) {
      return res.redirect(
        getAuthenticatedLandingPath(
          req.session.user
        )
      );
    }

    if (!req.session.pendingUser) {
      return res.redirect("/login");
    }

    const code =
      typeof req.body.code === "string"
        ? req.body.code
            .replace(/\s+/g, "")
            .trim()
        : "";

    if (!/^\d{6}$/.test(code)) {
      return res
        .status(400)
        .render(
          "auth/verify-2fa",
          {
            error:
              "Enter the 6-digit code from your authenticator app.",
            user:
              req.session.pendingUser,
          }
        );
    }

    try {
      const result =
        await requestBackend(
          "/api/auth/2fa/verify-login",
          "POST",
          {
            userId:
              req.session.pendingUser
                .userId,
            code,
          }
        );

      if (
        !result.data ||
        !result.data.success
      ) {
        return res
          .status(result.status)
          .render(
            "auth/verify-2fa",
            {
              error:
                result.data?.message ||
                "The verification code is invalid or has expired.",
              user:
                req.session.pendingUser,
            }
          );
      }

      /*
      |--------------------------------------------------------------------------
      | Verification successful — create real login session
      |--------------------------------------------------------------------------
      */

      req.session.user =
        result.data.user;

      delete req.session.pendingUser;
      delete req.session
        .pendingTwoFactorSecret;
      delete req.session
        .pendingTwoFactorQrCode;

      return req.session.save(
        (error) => {
          if (error) {
            console.error(
              "2FA verification session error:",
              error
            );

            return res
              .status(500)
              .render(
                "auth/verify-2fa",
                {
                  error:
                    "The code was verified, but the login session could not be created.",
                  user:
                    result.data.user,
                }
              );
          }

          return res.redirect(
            getAuthenticatedLandingPath(
              req.session.user
            )
          );
        }
      );
    } catch (error) {
      console.error(
        "Frontend 2FA verification error:",
        error
      );

      return res
        .status(503)
        .render(
          "auth/verify-2fa",
          {
            error:
              "The authentication server is unavailable.",
            user:
              req.session.pendingUser,
          }
        );
    }
  }
);

app.post("/cancel-2fa", (req, res) => {
  delete req.session.pendingUser;
  delete req.session.pendingTwoFactorSecret;
  delete req.session.pendingTwoFactorQrCode;

  req.session.save((error) => {
    if (error) {
      console.error("Cancel 2FA session error:", error);
    }

    return res.redirect("/login");
  });
});

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
| Advanced Search Results
|--------------------------------------------------------------------------
*/

// ===== ADVANCED SEARCH FEATURE START =====
// When the user searches from the Home page, they arrive at /search.
// This route renders the Advanced Search Results page.
app.get(
  "/search",
  requireLogin,
  (req, res) => {
    return res.render(
      "searchResults",
      {
        user: req.session.user,
      }
    );
  }
);
// ===== ADVANCED SEARCH FEATURE END =====

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
  "/ccas/new",
  requireLogin,
  (req, res) => {
    return res.render("addCCA", {
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
| Groups (RP Circles)
|--------------------------------------------------------------------------
*/

app.get(
  "/groups",
  requireLogin,
  (req, res) => {
    return res.render("groups", {
      user: req.session.user,
    });
  }
);

app.get(
  "/groups/create",
  requireLogin,
  (req, res) => {
    return res.render(
      "createGroup",
      {
        user: req.session.user,
      }
    );
  }
);

app.get('/interest-groups', requireLogin, (req, res) => {
  return res.render('interestGroups', { user: req.session.user });
});

app.get('/forum', requireLogin, (req, res) => {
  return res.render('forum', { user: req.session.user });
});

app.get('/forum/:id', requireLogin, (req, res) => {
  return res.render('forumThread', { user: req.session.user, questionId: req.params.id });
});


app.get(
  "/groups/:id",
  requireLogin,
  (req, res) => {
    return res.render(
      "groupDetails",
      {
        user: req.session.user,
        groupId: req.params.id,
      }
    );
  }
);

app.get(
  "/groups/:id/requests",
  requireLogin,
  (req, res) => {
    return res.render(
      "groupRequests",
      {
        user: req.session.user,
        groupId: req.params.id,
      }
    );
  }
);

app.get(
  "/groups/:id/edit",
  requireLogin,
  (req, res) => {
    return res.render(
      "editGroup",
      {
        user: req.session.user,
        groupId: req.params.id,
      }
    );
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
