const ACCOUNT_STATUS_ACTIVE = "active";
const ACCOUNT_STATUS_SUSPENDED =
  "suspended";

const normaliseAccountStatus = (value) => {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : null;
};

const isMissingAccountStatusColumnError = (
  error
) => {
  if (
    !error ||
    error.code !== "ER_BAD_FIELD_ERROR"
  ) {
    return false;
  }

  const errorContext = [
    error.sqlMessage,
    error.message,
    error.sql,
  ]
    .filter(
      (value) => typeof value === "string"
    )
    .join(" ")
    .toLowerCase();

  return errorContext.includes(
    "account_status"
  );
};

const getAccountStatusByUserId = async (
  database,
  userId
) => {
  try {
    const [users] = await database.execute(
      `
        SELECT account_status
        FROM users
        WHERE user_id = ?
        LIMIT 1
      `,
      [userId]
    );

    return {
      available: true,
      status:
        users.length > 0
          ? normaliseAccountStatus(
              users[0].account_status
            )
          : null,
    };
  } catch (error) {
    if (
      isMissingAccountStatusColumnError(
        error
      )
    ) {
      // Keep authentication working until the
      // optional migration is run, while still
      // rejecting sessions whose user row was
      // deleted.
      const [users] =
        await database.execute(
          `
            SELECT user_id
            FROM users
            WHERE user_id = ?
            LIMIT 1
          `,
          [userId]
        );

      return {
        available: false,
        status:
          users.length > 0
            ? ACCOUNT_STATUS_ACTIVE
            : null,
      };
    }

    throw error;
  }
};

const accountStatusAllowsAccess = (
  accountStatus
) => {
  return (
    Boolean(accountStatus) &&
    (accountStatus.available === true ||
      accountStatus.available === false) &&
    accountStatus.status ===
      ACCOUNT_STATUS_ACTIVE
  );
};

const accountIsSuspended = (
  accountStatus
) => {
  return (
    Boolean(accountStatus) &&
    accountStatus.available === true &&
    accountStatus.status ===
      ACCOUNT_STATUS_SUSPENDED
  );
};

module.exports = {
  ACCOUNT_STATUS_ACTIVE,
  ACCOUNT_STATUS_SUSPENDED,
  accountIsSuspended,
  accountStatusAllowsAccess,
  getAccountStatusByUserId,
  isMissingAccountStatusColumnError,
  normaliseAccountStatus,
};
