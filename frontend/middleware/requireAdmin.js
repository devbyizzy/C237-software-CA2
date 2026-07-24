const pool = require(
  "../../backend/utils/db"
);
const {
  accountStatusAllowsAccess,
  getAccountStatusByUserId,
} = require(
  "../../backend/utils/accountStatus"
);

const getSessionUserId = (sessionUser) => {
  if (!sessionUser) {
    return null;
  }

  const userId = Number(
    sessionUser.userId ??
      sessionUser.user_id
  );

  return Number.isSafeInteger(userId) &&
    userId > 0
    ? userId
    : null;
};

const createRequireAdmin = ({
  database = pool.promise(),
  loadAccountStatus =
    getAccountStatusByUserId,
  logger = console,
} = {}) => {
  return async function requireAdmin(
    req,
    res,
    next
  ) {
    const sessionUser =
      req.session && req.session.user;

    if (!sessionUser) {
      return res.redirect("/login");
    }

    if (sessionUser.role !== "admin") {
      return res
        .status(403)
        .send("Access denied.");
    }

    const userId =
      getSessionUserId(sessionUser);

    if (!userId) {
      return res
        .status(403)
        .send("Access denied.");
    }

    let liveUser;
    let accountStatus;

    try {
      const [users] = await database.execute(
        `
          SELECT user_id, role
          FROM users
          WHERE user_id = ?
          LIMIT 1
        `,
        [userId]
      );

      liveUser = users[0] || null;

      if (liveUser) {
        accountStatus =
          await loadAccountStatus(
            database,
            userId
          );
      }
    } catch (error) {
      logger.error(
        "Admin authorization lookup error:",
        error
      );

      return res
        .status(503)
        .send(
          "Administrator access is temporarily unavailable."
        );
    }

    if (
      !liveUser ||
      liveUser.role !== "admin" ||
      !accountStatusAllowsAccess(
        accountStatus
      )
    ) {
      return res
        .status(403)
        .send("Access denied.");
    }

    return next();
  };
};

const requireAdmin = createRequireAdmin();

module.exports = requireAdmin;
module.exports.createRequireAdmin =
  createRequireAdmin;
module.exports.getSessionUserId =
  getSessionUserId;
