const pool = require(
  "../../backend/utils/db"
);
const {
  accountStatusAllowsAccess,
  getAccountStatusByUserId,
} = require(
  "../../backend/utils/accountStatus"
);

const SESSION_COOKIE_NAME = "connect.sid";

const getSessionUserId = (sessionUser) => {
  if (!sessionUser) {
    return null;
  }

  const rawUserId =
    sessionUser.userId ??
    sessionUser.user_id;

  if (
    typeof rawUserId === "number"
  ) {
    return Number.isSafeInteger(
      rawUserId
    ) && rawUserId > 0
      ? rawUserId
      : null;
  }

  if (
    typeof rawUserId !== "string" ||
    !/^[1-9]\d*$/.test(rawUserId)
  ) {
    return null;
  }

  const userId = Number(rawUserId);

  return Number.isSafeInteger(userId)
    ? userId
    : null;
};

const clearDeniedSession = (
  req,
  res,
  logger,
  cookieName
) => {
  return new Promise((resolve) => {
    const session = req.session;

    const finish = () => {
      res.clearCookie(cookieName);
      resolve(res.redirect("/login"));
    };

    if (!session) {
      finish();
      return;
    }

    delete session.user;
    delete session.pendingUser;
    delete session.pendingTwoFactorSecret;
    delete session.pendingTwoFactorQrCode;

    if (
      typeof session.destroy !==
      "function"
    ) {
      finish();
      return;
    }

    let callbackCalled = false;

    const onDestroyed = (error) => {
      if (callbackCalled) {
        return;
      }

      callbackCalled = true;

      if (error) {
        logger.error(
          "Denied session cleanup error:",
          error
        );
      }

      finish();
    };

    try {
      session.destroy(onDestroyed);
    } catch (error) {
      onDestroyed(error);
    }
  });
};

const createRequireLogin = ({
  database = pool.promise(),
  loadAccountStatus =
    getAccountStatusByUserId,
  logger = console,
  cookieName = SESSION_COOKIE_NAME,
} = {}) => {
  return async function requireLogin(
    req,
    res,
    next
  ) {
    const sessionUser =
      req.session && req.session.user;

    if (!sessionUser) {
      return res.redirect("/login");
    }

    const userId =
      getSessionUserId(sessionUser);

    if (!userId) {
      return clearDeniedSession(
        req,
        res,
        logger,
        cookieName
      );
    }

    let accountStatus;

    try {
      accountStatus =
        await loadAccountStatus(
          database,
          userId
        );
    } catch (error) {
      logger.error(
        "Session account lookup error:",
        error
      );

      return res
        .status(503)
        .send(
          "Account access is temporarily unavailable."
        );
    }

    if (
      !accountStatusAllowsAccess(
        accountStatus
      )
    ) {
      return clearDeniedSession(
        req,
        res,
        logger,
        cookieName
      );
    }

    return next();
  };
};

const requireLogin =
  createRequireLogin();

module.exports = requireLogin;
module.exports.clearDeniedSession =
  clearDeniedSession;
module.exports.createRequireLogin =
  createRequireLogin;
module.exports.getSessionUserId =
  getSessionUserId;
