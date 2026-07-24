const QRCode = require("qrcode");
const { authenticator } = require("otplib");

const pool = require("../utils/db");
const {
  ACCOUNT_STATUS_ACTIVE,
  accountStatusAllowsAccess,
  getAccountStatusByUserId,
} = require("../utils/accountStatus");
const database = pool.promise();

const normaliseCode = (value) => {
  return typeof value === "string"
    ? value.replace(/\s+/g, "").trim()
    : "";
};

const getUserId = (req) => {
  const userId = Number(req.body.userId);

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return null;
  }

  return userId;
};

/*
|--------------------------------------------------------------------------
| Get current 2FA status
|--------------------------------------------------------------------------
*/

const getTwoFactorStatus = async (
  req,
  res
) => {
  try {
    const userId = Number(
      req.params.userId
    );

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

    const [users] =
      await database.execute(
        `
          SELECT
            user_id,
            two_factor_enabled
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
          "The user account could not be found.",
      });
    }

    return res.status(200).json({
      success: true,
      twoFactorEnabled:
        Boolean(
          users[0].two_factor_enabled
        ),
    });
  } catch (error) {
    console.error(
      "Get 2FA status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve the 2FA status.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Generate temporary 2FA setup secret and QR code
|--------------------------------------------------------------------------
*/

const setupTwoFactor = async (
  req,
  res
) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message:
          "A valid user account is required.",
      });
    }

    const [users] =
      await database.execute(
        `
          SELECT
            user_id,
            username,
            email,
            two_factor_enabled
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
          "The user account could not be found.",
      });
    }

    const user = users[0];

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

    if (user.two_factor_enabled) {
      return res.status(409).json({
        success: false,
        message:
          "Two-factor authentication is already enabled.",
      });
    }

    const secret =
      authenticator.generateSecret();

    const accountName =
      user.email || user.username;

    const otpAuthUrl =
      authenticator.keyuri(
        accountName,
        "RPConnect",
        secret
      );

    const qrCodeDataUrl =
      await QRCode.toDataURL(
        otpAuthUrl
      );

    return res.status(200).json({
      success: true,
      message:
        "Two-factor authentication setup created.",
      secret,
      qrCodeDataUrl,
    });
  } catch (error) {
    console.error(
      "Setup 2FA error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create the 2FA setup.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Verify setup code and enable 2FA
|--------------------------------------------------------------------------
*/

const enableTwoFactor = async (
  req,
  res
) => {
  try {
    const userId = getUserId(req);

    const secret =
      typeof req.body.secret ===
      "string"
        ? req.body.secret.trim()
        : "";

    const code = normaliseCode(
      req.body.code
    );

    if (!userId || !secret || !code) {
      return res.status(400).json({
        success: false,
        message:
          "The user, setup secret and verification code are required.",
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message:
          "Enter the 6-digit code from your authenticator app.",
      });
    }

    const accountStatus =
      await getAccountStatusByUserId(
        database,
        userId
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

    const codeIsValid =
      await authenticator.verify({
        token: code,
        secret,
      });

    if (!codeIsValid) {
      return res.status(400).json({
        success: false,
        message:
          "The verification code is incorrect or has expired.",
      });
    }

    const statusCondition =
      accountStatus.available
        ? "AND account_status = ?"
        : "";
    const updateParameters = [
      secret,
      userId,
    ];

    if (accountStatus.available) {
      updateParameters.push(
        ACCOUNT_STATUS_ACTIVE
      );
    }

    const [result] =
      await database.execute(
        `
          UPDATE users
          SET
            two_factor_enabled = TRUE,
            two_factor_secret = ?
          WHERE user_id = ?
            AND two_factor_enabled = FALSE
            ${statusCondition}
        `,
        updateParameters
      );

    if (result.affectedRows !== 1) {
      const currentAccountStatus =
        await getAccountStatusByUserId(
          database,
          userId
        );

      if (
        !accountStatusAllowsAccess(
          currentAccountStatus
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "This account has been suspended. Contact an administrator for assistance.",
        });
      }

      return res.status(409).json({
        success: false,
        message:
          "Two-factor authentication could not be enabled.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Two-factor authentication has been enabled successfully.",
    });
  } catch (error) {
    console.error(
      "Enable 2FA error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to enable two-factor authentication.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Verify 2FA code during login
|--------------------------------------------------------------------------
*/

const verifyTwoFactorLogin = async (
  req,
  res
) => {
  try {
    const userId = getUserId(req);
    const code = normaliseCode(
      req.body.code
    );

    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        message:
          "The user and verification code are required.",
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message:
          "Enter the 6-digit code from your authenticator app.",
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
            role,
            two_factor_enabled,
            two_factor_secret
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
          "The user account could not be found.",
      });
    }

    const user = users[0];

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

    if (
      !user.two_factor_enabled ||
      !user.two_factor_secret
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Two-factor authentication is not enabled for this account.",
      });
    }

    const codeIsValid =
      await authenticator.verify({
        token: code,
        secret:
          user.two_factor_secret,
      });

    if (!codeIsValid) {
      return res.status(401).json({
        success: false,
        message:
          "The verification code is incorrect or has expired.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Two-factor authentication verified successfully.",
      user: {
        userId: user.user_id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(
      "Verify 2FA login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to verify the authentication code.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Disable 2FA
|--------------------------------------------------------------------------
*/

const disableTwoFactor = async (
  req,
  res
) => {
  try {
    const userId = getUserId(req);

    const password =
      typeof req.body.password ===
      "string"
        ? req.body.password
        : "";

    if (!userId || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Your password is required to disable two-factor authentication.",
      });
    }

    const [users] =
      await database.execute(
        `
          SELECT
            user_id,
            password_hash,
            two_factor_enabled
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
          "The user account could not be found.",
      });
    }

    const bcrypt =
      require("bcryptjs");

    const passwordMatches =
      await bcrypt.compare(
        password,
        users[0].password_hash
      );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message:
          "The password is incorrect.",
      });
    }

    if (
      !users[0].two_factor_enabled
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Two-factor authentication is already disabled.",
      });
    }

    await database.execute(
      `
        UPDATE users
        SET
          two_factor_enabled = FALSE,
          two_factor_secret = NULL
        WHERE user_id = ?
      `,
      [userId]
    );

    return res.status(200).json({
      success: true,
      message:
        "Two-factor authentication has been disabled.",
    });
  } catch (error) {
    console.error(
      "Disable 2FA error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to disable two-factor authentication.",
    });
  }
};

module.exports = {
  getTwoFactorStatus,
  setupTwoFactor,
  enableTwoFactor,
  verifyTwoFactorLogin,
  disableTwoFactor,
};
