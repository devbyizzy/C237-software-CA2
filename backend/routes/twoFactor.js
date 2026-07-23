const express = require("express");

const {
  getTwoFactorStatus,
  setupTwoFactor,
  enableTwoFactor,
  verifyTwoFactorLogin,
  disableTwoFactor,
} = require(
  "../controllers/twoFactorController"
);

const router = express.Router();

router.get(
  "/status/:userId",
  getTwoFactorStatus
);

router.post(
  "/setup",
  setupTwoFactor
);

router.post(
  "/enable",
  enableTwoFactor
);

router.post(
  "/verify-login",
  verifyTwoFactorLogin
);

router.post(
  "/disable",
  disableTwoFactor
);

module.exports = router;