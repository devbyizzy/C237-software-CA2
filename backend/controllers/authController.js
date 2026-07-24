const bcrypt = require("bcryptjs");
const pool = require("../utils/db");
const {
  accountStatusAllowsAccess,
  getAccountStatusByUserId,
} = require("../utils/accountStatus");

const database = pool.promise();

const RP_EMAIL_PATTERN =
  /^[0-9]{8}@myrp\.edu\.sg$/;

const USERNAME_PATTERN =
  /^[a-zA-Z0-9_]{3,20}$/;

const normaliseText = (value) => {
  return typeof value === "string"
    ? value.trim()
    : "";
};

/*
|--------------------------------------------------------------------------
| Register
|--------------------------------------------------------------------------
*/

const register = async (req, res) => {
  try {
    const name = normaliseText(
      req.body.name
    );

    const username = normaliseText(
      req.body.username
    ).toLowerCase();

    const email = normaliseText(
      req.body.email
    ).toLowerCase();

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
      !name ||
      !username ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please complete all required fields.",
      });
    }

    if (
      name.length < 2 ||
      name.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Your full name must contain between 2 and 100 characters.",
      });
    }

    if (
      !USERNAME_PATTERN.test(username)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Username must contain 3 to 20 letters, numbers or underscores.",
      });
    }

    if (!RP_EMAIL_PATTERN.test(email)) {
      return res.status(400).json({
        success: false,
        message:
          "Enter a valid RP email containing 8 digits followed by @myrp.edu.sg.",
      });
    }

    const passwordIsValid =
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password);

    if (!passwordIsValid) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least 8 characters, one uppercase letter, one lowercase letter and one number.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message:
          "The passwords do not match.",
      });
    }

    const [existingUsers] =
      await database.execute(
        `
          SELECT
            user_id,
            username,
            email
          FROM users
          WHERE LOWER(username) = ?
             OR LOWER(email) = ?
          LIMIT 1
        `,
        [username, email]
      );

    if (existingUsers.length > 0) {
      const existingUser =
        existingUsers[0];

      if (
        existingUser.username.toLowerCase() ===
        username
      ) {
        return res.status(409).json({
          success: false,
          message:
            "That username is already being used.",
        });
      }

      return res.status(409).json({
        success: false,
        message:
          "An account already exists with that RP email.",
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 12);

    const [result] =
      await database.execute(
        `
          INSERT INTO users (
            name,
            username,
            email,
            password_hash,
            role,
            two_factor_enabled,
            two_factor_secret
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          name,
          username,
          email,
          passwordHash,
          "year1",
          false,
          null,
        ]
      );

    return res.status(201).json({
      success: true,
      message:
        "Your RPConnect account has been created successfully.",
      user: {
        userId: result.insertId,
        name,
        username,
        email,
        role: "year1",
      },
    });
  } catch (error) {
    console.error(
      "Registration error:",
      error
    );

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message:
          "That username or RP email is already registered.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Unable to create your account at the moment.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
| 2FA is mandatory.
|
| First-time user:
| Password correct -> Redirect to 2FA setup.
|
| Existing 2FA user:
| Password correct -> Redirect to 2FA verification.
|
| A normal login session must not be created here.
|--------------------------------------------------------------------------
*/

const login = async (req, res) => {
  try {
    const loginId = normaliseText(
      req.body.loginId
    ).toLowerCase();

    const password =
      typeof req.body.password === "string"
        ? req.body.password
        : "";

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter your username or RP email and password.",
      });
    }

    const [users] =
      await database.execute(
        `
          SELECT
            user_id,
            name,
            username,
            email,
            password_hash,
            role,
            created_at,
            two_factor_enabled,
            two_factor_secret
          FROM users
          WHERE LOWER(username) = ?
             OR LOWER(email) = ?
          LIMIT 1
        `,
        [loginId, loginId]
      );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message:
          "The username, email or password is incorrect.",
      });
    }

    const user = users[0];

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message:
          "The username, email or password is incorrect.",
      });
    }

    const accountStatus =
      await getAccountStatusByUserId(
        database,
        user.user_id
      );

    if (
      !accountStatusAllowsAccess(
        accountStatus
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "This account has been suspended. Contact an administrator for assistance.",
      });
    }

    const userResponse = {
      userId: user.user_id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    /*
    |--------------------------------------------------------------------------
    | Mandatory first-time 2FA setup
    |--------------------------------------------------------------------------
    */

    if (
      !user.two_factor_enabled ||
      !user.two_factor_secret
    ) {
      return res.status(200).json({
        success: true,
        requiresTwoFactorSetup: true,
        requiresTwoFactor: false,
        message:
          "You must set up two-factor authentication before continuing.",
        user: userResponse,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Existing user must verify 2FA
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,
      requiresTwoFactorSetup: false,
      requiresTwoFactor: true,
      message:
        "Enter the 6-digit code from your authenticator app.",
      user: userResponse,
    });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to log in at the moment.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Delete account
|--------------------------------------------------------------------------
*/

const deleteAccount = async (
  req,
  res
) => {
  try {
    const userId = Number(
      req.body.userId
    );

    const password =
      typeof req.body.password === "string"
        ? req.body.password
        : "";

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid user account is required.",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message:
          "Enter your password to delete your account.",
      });
    }

    const [users] =
      await database.execute(
        `
          SELECT
            user_id,
            password_hash
          FROM users
          WHERE user_id = ?
          LIMIT 1
        `,
        [userId]
      );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "The account could not be found.",
      });
    }

    const user = users[0];

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message:
          "The password is incorrect.",
      });
    }

    const [result] =
      await database.execute(
        `
          DELETE FROM users
          WHERE user_id = ?
        `,
        [userId]
      );

    if (result.affectedRows !== 1) {
      return res.status(404).json({
        success: false,
        message:
          "The account could not be deleted.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Your account has been permanently deleted.",
    });
  } catch (error) {
    console.error(
      "Delete account error:",
      error
    );

    if (
      error.code ===
      "ER_ROW_IS_REFERENCED_2"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This account is linked to other records and cannot be deleted until those records are removed.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Unable to delete your account at the moment.",
    });
  }
};

module.exports = {
  register,
  login,
  deleteAccount,
};
