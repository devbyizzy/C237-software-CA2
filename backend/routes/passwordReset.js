const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const pool = require("../utils/db");
const database = pool.promise();

const router = express.Router();

const normaliseText = (value) => {
  return typeof value === "string"
    ? value.trim()
    : "";
};

/*
|--------------------------------------------------------------------------
| Request password reset
|--------------------------------------------------------------------------
*/

router.post(
  "/forgot-password",
  async (req, res) => {
    try {
      const email = normaliseText(
        req.body.email
      ).toLowerCase();

      if (!email) {
        return res.status(400).json({
          success: false,
          message:
            "Please enter your RP email.",
        });
      }

      const [users] =
        await database.execute(
          `
            SELECT
              user_id,
              email
            FROM users
            WHERE LOWER(email) = ?
            LIMIT 1
          `,
          [email]
        );

      /*
       * Return the same message whether the
       * email exists or not.
       */
      if (users.length === 0) {
        return res.status(200).json({
          success: true,
          message:
            "If the email is registered, a password reset link has been created.",
        });
      }

      const user = users[0];

      const resetToken = crypto
        .randomBytes(32)
        .toString("hex");

      const tokenHash = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      const expiresAt = new Date(
        Date.now() + 15 * 60 * 1000
      );

      await database.execute(
        `
          DELETE FROM password_reset_tokens
          WHERE user_id = ?
             OR expires_at < NOW()
             OR used_at IS NOT NULL
        `,
        [user.user_id]
      );

      await database.execute(
        `
          INSERT INTO password_reset_tokens (
            user_id,
            token_hash,
            expires_at
          )
          VALUES (?, ?, ?)
        `,
        [
          user.user_id,
          tokenHash,
          expiresAt,
        ]
      );

      const resetLink =
        `http://localhost:5173/reset-password?token=${resetToken}`;

      console.log(
        "\nPassword reset link:"
      );
      console.log(resetLink);
      console.log(
        "This link expires in 15 minutes.\n"
      );

      return res.status(200).json({
        success: true,
        message:
          "If the email is registered, a password reset link has been created.",
        resetLink:
          process.env.NODE_ENV ===
          "production"
            ? undefined
            : resetLink,
      });
    } catch (error) {
      console.error(
        "Forgot password error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to process the password reset request.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Check reset token
|--------------------------------------------------------------------------
*/

router.get(
  "/reset-password/:token",
  async (req, res) => {
    try {
      const token = normaliseText(
        req.params.token
      );

      if (!token) {
        return res.status(400).json({
          success: false,
          message:
            "Password reset token is missing.",
        });
      }

      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const [tokens] =
        await database.execute(
          `
            SELECT reset_id
            FROM password_reset_tokens
            WHERE token_hash = ?
              AND expires_at > NOW()
              AND used_at IS NULL
            LIMIT 1
          `,
          [tokenHash]
        );

      if (tokens.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "This password reset link is invalid or has expired.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "The password reset token is valid.",
      });
    } catch (error) {
      console.error(
        "Reset token verification error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to verify the password reset link.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| Reset password
|--------------------------------------------------------------------------
*/

router.post(
  "/reset-password",
  async (req, res) => {
    const token = normaliseText(
      req.body.token
    );

    const password =
      typeof req.body.password ===
      "string"
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
      return res.status(400).json({
        success: false,
        message:
          "Please complete all required fields.",
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

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    let connection;

    try {
      connection =
        await database.getConnection();

      await connection.beginTransaction();

      const [tokens] =
        await connection.execute(
          `
            SELECT
              reset_id,
              user_id
            FROM password_reset_tokens
            WHERE token_hash = ?
              AND expires_at > NOW()
              AND used_at IS NULL
            LIMIT 1
            FOR UPDATE
          `,
          [tokenHash]
        );

      if (tokens.length === 0) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            "This password reset link is invalid or has expired.",
        });
      }

      const resetRecord = tokens[0];

      const passwordHash =
        await bcrypt.hash(password, 12);

      const [updateResult] =
        await connection.execute(
          `
            UPDATE users
            SET password_hash = ?
            WHERE user_id = ?
          `,
          [
            passwordHash,
            resetRecord.user_id,
          ]
        );

      if (
        updateResult.affectedRows !== 1
      ) {
        await connection.rollback();

        return res.status(404).json({
          success: false,
          message:
            "The user account could not be found.",
        });
      }

      await connection.execute(
        `
          UPDATE password_reset_tokens
          SET used_at = NOW()
          WHERE reset_id = ?
        `,
        [resetRecord.reset_id]
      );

      await connection.execute(
        `
          DELETE FROM password_reset_tokens
          WHERE user_id = ?
            AND reset_id != ?
        `,
        [
          resetRecord.user_id,
          resetRecord.reset_id,
        ]
      );

      await connection.commit();

      return res.status(200).json({
        success: true,
        message:
          "Your password has been reset successfully.",
      });
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }

      console.error(
        "Reset password error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to reset your password.",
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

module.exports = router;