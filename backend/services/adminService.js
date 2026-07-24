const pool = require("../utils/db");
const {
  CCA_CATEGORIES,
  CCA_STATUSES,
  QUESTION_STATUSES,
  USER_ROLES,
  isSupportedQuestionStatus,
  isSupportedUserRole,
  validateCcaInput,
} = require("./adminValidation");

class AdminServiceError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "AdminServiceError";
    this.code = code;
    this.details = details;
  }
}

const normaliseSqlErrorText = (error) => {
  return [
    error && error.message,
    error && error.sql,
    error && error.sqlMessage,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

const isMissingAdminLogsError = (error) => {
  return (
    error &&
    error.code === "ER_NO_SUCH_TABLE" &&
    normaliseSqlErrorText(error).includes(
      "admin_logs"
    )
  );
};

const requirePositiveId = (
  value,
  code,
  message
) => {
  const id = Number(value);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw new AdminServiceError(
      code,
      message
    );
  }

  return id;
};

const toNullable = (value) => {
  return value === "" ||
    value === undefined
    ? null
    : value;
};

const createAdminService = (
  databasePool
) => {
  const database = () =>
    databasePool.promise();

  const schemaTableExists = async (
    executor,
    tableName
  ) => {
    const [rows] = await executor.execute(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
        ) AS table_exists
      `,
      [tableName]
    );

    return Boolean(
      rows[0] &&
        Number(rows[0].table_exists)
    );
  };

  const schemaColumnExists = async (
    executor,
    tableName,
    columnName
  ) => {
    const [rows] = await executor.execute(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND COLUMN_NAME = ?
        ) AS column_exists
      `,
      [tableName, columnName]
    );

    return Boolean(
      rows[0] &&
        Number(rows[0].column_exists)
    );
  };

  const writeAdminLog = async (
    connection,
    adminUserId,
    action,
    targetType,
    targetId
  ) => {
    await connection.execute(
      `
        INSERT INTO admin_logs (
          admin_user_id,
          action,
          target_type,
          target_id
        )
        VALUES (?, ?, ?, ?)
      `,
      [
        adminUserId,
        action,
        targetType,
        targetId,
      ]
    );
  };

  const withAdminTransaction = async (
    adminUserId,
    callback
  ) => {
    const actorId = requirePositiveId(
      adminUserId,
      "ADMIN_FORBIDDEN",
      "Administrator access is required."
    );
    const connection =
      await database().getConnection();

    try {
      await connection.beginTransaction();

      const [adminRows] =
        await connection.execute(
          `
            SELECT user_id, role
            FROM users
            WHERE user_id = ?
            FOR UPDATE
          `,
          [actorId]
        );

      const actor = adminRows[0];

      if (
        !actor ||
        actor.role !== "admin"
      ) {
        throw new AdminServiceError(
          "ADMIN_FORBIDDEN",
          "Administrator access is required."
        );
      }

      const accountStatusAvailable =
        await schemaColumnExists(
          connection,
          "users",
          "account_status"
        );

      if (accountStatusAvailable) {
        const [statusRows] =
          await connection.execute(
            `
              SELECT account_status
              FROM users
              WHERE user_id = ?
              FOR UPDATE
            `,
            [actorId]
          );

        if (
          !statusRows[0] ||
          statusRows[0].account_status !==
            "active"
        ) {
          throw new AdminServiceError(
            "ADMIN_FORBIDDEN",
            "Administrator access is required."
          );
        }
      }

      const result = await callback(
        connection,
        {
          actorId,
          accountStatusAvailable,
        }
      );

      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        // Preserve the original failure. A rollback
        // error must not make a partial write appear
        // successful.
      }

      if (isMissingAdminLogsError(error)) {
        throw new AdminServiceError(
          "ADMIN_LOGS_MISSING",
          "The admin activity-log migration has not been applied."
        );
      }

      throw error;
    } finally {
      connection.release();
    }
  };

  const getLockedUser = async (
    connection,
    userId,
    accountStatusAvailable
  ) => {
    const statusProjection =
      accountStatusAvailable
        ? "account_status"
        : "'active' AS account_status";
    const [rows] = await connection.execute(
      `
        SELECT
          user_id,
          username,
          email,
          role,
          ${statusProjection},
          two_factor_enabled,
          two_factor_secret
        FROM users
        WHERE user_id = ?
        FOR UPDATE
      `,
      [userId]
    );

    if (!rows[0]) {
      throw new AdminServiceError(
        "USER_NOT_FOUND",
        "The requested user does not exist."
      );
    }

    return rows[0];
  };

  const protectLastActiveAdmin = async (
    connection,
    targetUser,
    accountStatusAvailable
  ) => {
    if (
      targetUser.role !== "admin" ||
      targetUser.account_status !== "active"
    ) {
      return;
    }

    const activeStatusClause =
      accountStatusAvailable
        ? "AND account_status = 'active'"
        : "";
    const [activeAdmins] =
      await connection.execute(
        `
          SELECT user_id
          FROM users
          WHERE role = 'admin'
            ${activeStatusClause}
          ORDER BY user_id
          FOR UPDATE
        `
      );

    if (activeAdmins.length <= 1) {
      throw new AdminServiceError(
        "LAST_ACTIVE_ADMIN",
        "The last active administrator cannot be changed or deleted."
      );
    }
  };

  const ensureQuestionTables = async (
    executor
  ) => {
    const questionsAvailable =
      await schemaTableExists(
        executor,
        "questions"
      );
    const repliesAvailable =
      await schemaTableExists(
        executor,
        "question_replies"
      );

    if (
      !questionsAvailable ||
      !repliesAvailable
    ) {
      throw new AdminServiceError(
        "QUESTION_TABLES_MISSING",
        "The question moderation migration has not been applied."
      );
    }
  };

  const service = {
    async getDashboardData() {
      const executor = database();
      const tableMap = {
        users: "users",
        ccas: "ccas",
        groups: "student_groups",
        questions: "questions",
      };
      const [availableRows] =
        await executor.execute(
          `
            SELECT TABLE_NAME
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME IN (
                'users',
                'ccas',
                'student_groups',
                'questions'
              )
          `
        );
      const availableTables = new Set(
        availableRows.map(
          (row) => row.TABLE_NAME
        )
      );
      const stats = {};

      for (const [
        key,
        tableName,
      ] of Object.entries(tableMap)) {
        if (
          !availableTables.has(tableName)
        ) {
          stats[key] = {
            count: null,
            available: false,
          };
          continue;
        }

        const [countRows] =
          await executor.query(
            `SELECT COUNT(*) AS total FROM \`${tableName}\``
          );
        stats[key] = {
          count: Number(
            countRows[0].total
          ),
          available: true,
        };
      }

      let recentUsers = [];

      if (
        availableTables.has("users")
      ) {
        [recentUsers] =
          await executor.execute(
            `
              SELECT
                user_id,
                username,
                email,
                role,
                created_at
              FROM users
              ORDER BY created_at DESC
              LIMIT 8
            `
          );
      }

      return {
        stats,
        recentUsers,
      };
    },

    async getUsers(filters = {}) {
      const executor = database();
      const suspensionAvailable =
        await schemaColumnExists(
          executor,
          "users",
          "account_status"
        );
      const conditions = [];
      const parameters = [];
      const username =
        typeof filters.username === "string"
          ? filters.username.trim()
          : "";
      const email =
        typeof filters.email === "string"
          ? filters.email.trim()
          : "";
      const role =
        typeof filters.role === "string"
          ? filters.role.trim()
          : "";
      const status =
        typeof filters.status === "string"
          ? filters.status.trim()
          : "";

      if (username) {
        conditions.push(
          "u.username LIKE ?"
        );
        parameters.push(`%${username}%`);
      }

      if (email) {
        conditions.push("u.email LIKE ?");
        parameters.push(`%${email}%`);
      }

      if (role && USER_ROLES.includes(role)) {
        conditions.push("u.role = ?");
        parameters.push(role);
      }

      if (
        suspensionAvailable &&
        ["active", "suspended"].includes(
          status
        )
      ) {
        conditions.push(
          "u.account_status = ?"
        );
        parameters.push(status);
      }

      const whereClause =
        conditions.length > 0
          ? `WHERE ${conditions.join(
              " AND "
            )}`
          : "";
      const statusProjection =
        suspensionAvailable
          ? "u.account_status"
          : "'active' AS account_status";
      const [users] =
        await executor.execute(
          `
            SELECT
              u.user_id,
              u.name,
              u.username,
              u.email,
              u.role,
              ${statusProjection},
              u.two_factor_enabled,
              u.created_at
            FROM users u
            ${whereClause}
            ORDER BY u.created_at DESC,
              u.user_id DESC
          `,
          parameters
        );
      const [roleRows] =
        await executor.execute(
          `
            SELECT DISTINCT role
            FROM users
            ORDER BY role
          `
        );

      return {
        users,
        roles: roleRows
          .map((row) => row.role)
          .filter(isSupportedUserRole),
        suspensionAvailable,
      };
    },

    async getUserById(userId) {
      const targetUserId =
        requirePositiveId(
          userId,
          "USER_NOT_FOUND",
          "The requested user does not exist."
        );
      const executor = database();
      const suspensionAvailable =
        await schemaColumnExists(
          executor,
          "users",
          "account_status"
        );
      const statusProjection =
        suspensionAvailable
          ? "u.account_status"
          : "'active' AS account_status";
      const [rows] = await executor.execute(
        `
          SELECT
            u.user_id,
            u.name,
            u.username,
            u.email,
            u.role,
            ${statusProjection},
            u.two_factor_enabled,
            u.two_factor_secret,
            u.created_at,
            p.profile_id,
            p.display_name,
            p.profile_picture,
            p.bio,
            p.diploma,
            p.year_of_study,
            p.semester,
            p.class_code,
            p.interests,
            p.skills,
            p.looking_for,
            p.is_searchable,
            p.created_at AS profile_created_at,
            p.updated_at AS profile_updated_at
          FROM users u
          LEFT JOIN profiles p
            ON p.user_id = u.user_id
          WHERE u.user_id = ?
          LIMIT 1
        `,
        [targetUserId]
      );

      if (!rows[0]) {
        return null;
      }

      const questionsAvailable =
        await schemaTableExists(
          executor,
          "questions"
        );
      const impactQueries = [
        executor.execute(
          `
            SELECT
              (SELECT COUNT(*)
               FROM student_groups
               WHERE creator_id = ?) AS owned_groups,
              (SELECT COUNT(*)
               FROM group_members
               WHERE user_id = ?) AS group_memberships,
              (SELECT COUNT(*)
               FROM group_posts
               WHERE user_id = ?) AS group_posts,
              (SELECT COUNT(*)
               FROM group_replies
               WHERE user_id = ?) AS group_replies,
              (SELECT COUNT(*)
               FROM ccas
               WHERE created_by = ?) AS created_ccas
          `,
          [
            targetUserId,
            targetUserId,
            targetUserId,
            targetUserId,
            targetUserId,
          ]
        ),
      ];

      if (questionsAvailable) {
        impactQueries.push(
          executor.execute(
            `
              SELECT COUNT(*) AS questions
              FROM questions
              WHERE user_id = ?
            `,
            [targetUserId]
          )
        );
      }

      const impactResults =
        await Promise.all(impactQueries);
      const impact =
        impactResults[0][0][0];

      return {
        ...rows[0],
        suspension_available:
          suspensionAvailable,
        deletionImpact: {
          ownedGroups: Number(
            impact.owned_groups
          ),
          groupMemberships: Number(
            impact.group_memberships
          ),
          groupPosts: Number(
            impact.group_posts
          ),
          groupReplies: Number(
            impact.group_replies
          ),
          createdCcas: Number(
            impact.created_ccas
          ),
          questions: questionsAvailable
            ? Number(
                impactResults[1][0][0]
                  .questions
              )
            : null,
        },
      };
    },

    async resetUserTwoFactor({
      adminUserId,
      targetUserId,
    }) {
      const userId = requirePositiveId(
        targetUserId,
        "USER_NOT_FOUND",
        "The requested user does not exist."
      );

      return withAdminTransaction(
        adminUserId,
        async (
          connection,
          { accountStatusAvailable }
        ) => {
          const target =
            await getLockedUser(
              connection,
              userId,
              accountStatusAvailable
            );

          if (
            !target.two_factor_enabled &&
            !target.two_factor_secret
          ) {
            throw new AdminServiceError(
              "TWO_FACTOR_ALREADY_RESET",
              "Two-factor authentication is already reset."
            );
          }

          await connection.execute(
            `
              UPDATE users
              SET two_factor_secret = NULL,
                  two_factor_enabled = FALSE
              WHERE user_id = ?
            `,
            [userId]
          );
          await writeAdminLog(
            connection,
            Number(adminUserId),
            "reset_user_2fa",
            "user",
            userId
          );

          return {
            userId,
            username: target.username,
            email: target.email,
          };
        }
      );
    },

    async setUserSuspension({
      adminUserId,
      targetUserId,
      suspended,
    }) {
      const userId = requirePositiveId(
        targetUserId,
        "USER_NOT_FOUND",
        "The requested user does not exist."
      );
      const actorId = requirePositiveId(
        adminUserId,
        "ADMIN_FORBIDDEN",
        "Administrator access is required."
      );

      if (actorId === userId) {
        throw new AdminServiceError(
          "SELF_ACTION_NOT_ALLOWED",
          "Administrators cannot suspend their own account."
        );
      }

      return withAdminTransaction(
        actorId,
        async (
          connection,
          { accountStatusAvailable }
        ) => {
          if (!accountStatusAvailable) {
            throw new AdminServiceError(
              "ACCOUNT_STATUS_MISSING",
              "The account-status migration has not been applied."
            );
          }

          const target =
            await getLockedUser(
              connection,
              userId,
              true
            );
          const nextStatus = suspended
            ? "suspended"
            : "active";

          if (
            target.account_status ===
            nextStatus
          ) {
            throw new AdminServiceError(
              "ACCOUNT_STATUS_UNCHANGED",
              `The account is already ${nextStatus}.`
            );
          }

          if (suspended) {
            await protectLastActiveAdmin(
              connection,
              target,
              true
            );
          }

          await connection.execute(
            `
              UPDATE users
              SET account_status = ?
              WHERE user_id = ?
            `,
            [nextStatus, userId]
          );
          await writeAdminLog(
            connection,
            actorId,
            suspended
              ? "suspend_user"
              : "unsuspend_user",
            "user",
            userId
          );

          return {
            userId,
            status: nextStatus,
          };
        }
      );
    },

    async changeUserRole({
      adminUserId,
      targetUserId,
      newRole,
      confirmAdminPromotion = false,
    }) {
      const userId = requirePositiveId(
        targetUserId,
        "USER_NOT_FOUND",
        "The requested user does not exist."
      );
      const actorId = requirePositiveId(
        adminUserId,
        "ADMIN_FORBIDDEN",
        "Administrator access is required."
      );

      if (!isSupportedUserRole(newRole)) {
        throw new AdminServiceError(
          "INVALID_ROLE",
          "Select a supported user role."
        );
      }

      if (actorId === userId) {
        throw new AdminServiceError(
          "SELF_ACTION_NOT_ALLOWED",
          "Administrators cannot change their own role."
        );
      }

      return withAdminTransaction(
        actorId,
        async (
          connection,
          { accountStatusAvailable }
        ) => {
          const target =
            await getLockedUser(
              connection,
              userId,
              accountStatusAvailable
            );

          if (target.role === newRole) {
            throw new AdminServiceError(
              "ROLE_UNCHANGED",
              "The account already has that role."
            );
          }

          if (
            newRole === "admin" &&
            confirmAdminPromotion !== true
          ) {
            throw new AdminServiceError(
              "ADMIN_PROMOTION_CONFIRMATION_REQUIRED",
              "Administrator promotion must be explicitly confirmed."
            );
          }

          if (target.role === "admin") {
            await protectLastActiveAdmin(
              connection,
              target,
              accountStatusAvailable
            );
          }

          await connection.execute(
            `
              UPDATE users
              SET role = ?
              WHERE user_id = ?
            `,
            [newRole, userId]
          );
          await writeAdminLog(
            connection,
            actorId,
            "change_user_role",
            "user",
            userId
          );

          return {
            userId,
            previousRole: target.role,
            role: newRole,
          };
        }
      );
    },

    async deleteUser({
      adminUserId,
      targetUserId,
      confirmed = false,
    }) {
      const userId = requirePositiveId(
        targetUserId,
        "USER_NOT_FOUND",
        "The requested user does not exist."
      );
      const actorId = requirePositiveId(
        adminUserId,
        "ADMIN_FORBIDDEN",
        "Administrator access is required."
      );

      if (confirmed !== true) {
        throw new AdminServiceError(
          "CONFIRMATION_REQUIRED",
          "User deletion must be explicitly confirmed."
        );
      }

      if (actorId === userId) {
        throw new AdminServiceError(
          "SELF_ACTION_NOT_ALLOWED",
          "Administrators cannot delete their own account."
        );
      }

      try {
        return await withAdminTransaction(
          actorId,
          async (
            connection,
            { accountStatusAvailable }
          ) => {
            const target =
              await getLockedUser(
                connection,
                userId,
                accountStatusAvailable
              );
            await protectLastActiveAdmin(
              connection,
              target,
              accountStatusAvailable
            );

            await connection.execute(
              `
                DELETE FROM users
                WHERE user_id = ?
              `,
              [userId]
            );
            await writeAdminLog(
              connection,
              actorId,
              "delete_user",
              "user",
              userId
            );

            return {
              userId,
              username: target.username,
              email: target.email,
            };
          }
        );
      } catch (error) {
        if (
          error &&
          error.code ===
            "ER_ROW_IS_REFERENCED_2"
        ) {
          throw new AdminServiceError(
            "DEPENDENT_RECORDS",
            "The account still has dependent records that cannot be removed automatically."
          );
        }

        throw error;
      }
    },

    async getGroups(filters = {}) {
      const search =
        typeof filters.search === "string"
          ? filters.search.trim()
          : "";
      const conditions = [];
      const parameters = [];

      if (search) {
        conditions.push(
          `(
            g.group_name LIKE ?
            OR g.description LIKE ?
            OR u.username LIKE ?
          )`
        );
        const pattern = `%${search}%`;
        parameters.push(
          pattern,
          pattern,
          pattern
        );
      }

      const whereClause =
        conditions.length
          ? `WHERE ${conditions.join(
              " AND "
            )}`
          : "";
      const [groups] =
        await database().execute(
          `
            SELECT
              g.*,
              u.username AS creator_username,
              u.email AS creator_email,
              (
                SELECT COUNT(*)
                FROM group_members gm
                WHERE gm.group_id = g.group_id
                  AND gm.join_status = 'accepted'
              ) AS member_count,
              (
                SELECT COUNT(*)
                FROM group_posts gp
                WHERE gp.group_id = g.group_id
              ) AS post_count
            FROM student_groups g
            LEFT JOIN users u
              ON u.user_id = g.creator_id
            ${whereClause}
            ORDER BY g.created_at DESC,
              g.group_id DESC
          `,
          parameters
        );

      return {
        groups,
      };
    },

    async getGroupById(groupId) {
      const id = requirePositiveId(
        groupId,
        "GROUP_NOT_FOUND",
        "The requested group does not exist."
      );
      const executor = database();
      const [rows] = await executor.execute(
        `
          SELECT
            g.*,
            u.username AS creator_username,
            u.email AS creator_email,
            (
              SELECT COUNT(*)
              FROM group_members gm
              WHERE gm.group_id = g.group_id
                AND gm.join_status = 'accepted'
            ) AS member_count,
            (
              SELECT COUNT(*)
              FROM group_members gm
              WHERE gm.group_id = g.group_id
                AND gm.join_status = 'pending'
            ) AS pending_count,
            (
              SELECT COUNT(*)
              FROM group_posts gp
              WHERE gp.group_id = g.group_id
            ) AS post_count,
            (
              SELECT COUNT(*)
              FROM group_replies gr
              INNER JOIN group_posts gp
                ON gp.group_post_id =
                  gr.group_post_id
              WHERE gp.group_id = g.group_id
            ) AS reply_count
          FROM student_groups g
          LEFT JOIN users u
            ON u.user_id = g.creator_id
          WHERE g.group_id = ?
          LIMIT 1
        `,
        [id]
      );

      if (!rows[0]) {
        return null;
      }

      const [members] =
        await executor.execute(
          `
            SELECT
              gm.group_member_id,
              gm.user_id,
              gm.member_role,
              gm.join_status,
              gm.joined_at,
              u.username,
              u.email,
              p.display_name
            FROM group_members gm
            INNER JOIN users u
              ON u.user_id = gm.user_id
            LEFT JOIN profiles p
              ON p.user_id = gm.user_id
            WHERE gm.group_id = ?
            ORDER BY
              CASE gm.join_status
                WHEN 'accepted' THEN 0
                WHEN 'pending' THEN 1
                ELSE 2
              END,
              gm.joined_at ASC
          `,
          [id]
        );

      return {
        ...rows[0],
        members,
      };
    },

    async deleteGroup({
      adminUserId,
      groupId,
      confirmed = false,
    }) {
      const id = requirePositiveId(
        groupId,
        "GROUP_NOT_FOUND",
        "The requested group does not exist."
      );

      if (confirmed !== true) {
        throw new AdminServiceError(
          "CONFIRMATION_REQUIRED",
          "Group deletion must be explicitly confirmed."
        );
      }

      return withAdminTransaction(
        adminUserId,
        async (connection, { actorId }) => {
          const [rows] =
            await connection.execute(
              `
                SELECT
                  group_id,
                  group_name
                FROM student_groups
                WHERE group_id = ?
                FOR UPDATE
              `,
              [id]
            );

          if (!rows[0]) {
            throw new AdminServiceError(
              "GROUP_NOT_FOUND",
              "The requested group does not exist."
            );
          }

          await connection.execute(
            `
              DELETE FROM student_groups
              WHERE group_id = ?
            `,
            [id]
          );
          await writeAdminLog(
            connection,
            actorId,
            "delete_group",
            "group",
            id
          );

          return {
            groupId: id,
            groupName:
              rows[0].group_name,
          };
        }
      );
    },

    async getCcas(filters = {}) {
      const search =
        typeof filters.search === "string"
          ? filters.search.trim()
          : "";
      const status =
        typeof filters.status === "string"
          ? filters.status.trim()
          : "";
      const conditions = [];
      const parameters = [];

      if (search) {
        conditions.push(
          `(
            c.cca_name LIKE ?
            OR c.description LIKE ?
            OR c.category LIKE ?
          )`
        );
        const pattern = `%${search}%`;
        parameters.push(
          pattern,
          pattern,
          pattern
        );
      }

      if (
        status &&
        CCA_STATUSES.includes(status)
      ) {
        conditions.push("c.status = ?");
        parameters.push(status);
      }

      const whereClause =
        conditions.length
          ? `WHERE ${conditions.join(
              " AND "
            )}`
          : "";
      const [ccas] =
        await database().execute(
          `
            SELECT
              c.*,
              u.username AS creator_username,
              u.email AS creator_email
            FROM ccas c
            LEFT JOIN users u
              ON u.user_id = c.created_by
            ${whereClause}
            ORDER BY c.created_at DESC,
              c.cca_id DESC
          `,
          parameters
        );

      return {
        ccas,
      };
    },

    async getCcaById(ccaId) {
      const id = requirePositiveId(
        ccaId,
        "CCA_NOT_FOUND",
        "The requested CCA does not exist."
      );
      const [rows] =
        await database().execute(
          `
            SELECT
              c.*,
              u.username AS creator_username,
              u.email AS creator_email
            FROM ccas c
            LEFT JOIN users u
              ON u.user_id = c.created_by
            WHERE c.cca_id = ?
            LIMIT 1
          `,
          [id]
        );

      return rows[0] || null;
    },

    async createCca({
      adminUserId,
      cca,
    }) {
      const validation =
        validateCcaInput(cca);

      if (!validation.isValid) {
        throw new AdminServiceError(
          "CCA_VALIDATION_FAILED",
          "Correct the highlighted CCA fields.",
          validation.errors
        );
      }

      return withAdminTransaction(
        adminUserId,
        async (connection, { actorId }) => {
          const value = validation.value;
          const [result] =
            await connection.execute(
              `
                INSERT INTO ccas (
                  cca_name,
                  category,
                  description,
                  meeting_day,
                  meeting_start_time,
                  meeting_end_time,
                  location,
                  contact_email,
                  image_url,
                  created_by,
                  status
                )
                VALUES (
                  ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?
                )
              `,
              [
                value.cca_name,
                value.category,
                toNullable(
                  value.description
                ),
                toNullable(
                  value.meeting_day
                ),
                value.meeting_start_time,
                value.meeting_end_time,
                toNullable(value.location),
                toNullable(
                  value.contact_email
                ),
                toNullable(value.image_url),
                actorId,
                value.status,
              ]
            );
          const ccaId = Number(
            result.insertId
          );

          await writeAdminLog(
            connection,
            actorId,
            "create_cca",
            "cca",
            ccaId
          );

          return {
            ccaId,
            value,
          };
        }
      );
    },

    async updateCca({
      adminUserId,
      ccaId,
      cca,
    }) {
      const id = requirePositiveId(
        ccaId,
        "CCA_NOT_FOUND",
        "The requested CCA does not exist."
      );
      const validation =
        validateCcaInput(cca);

      if (!validation.isValid) {
        throw new AdminServiceError(
          "CCA_VALIDATION_FAILED",
          "Correct the highlighted CCA fields.",
          validation.errors
        );
      }

      return withAdminTransaction(
        adminUserId,
        async (connection, { actorId }) => {
          const [rows] =
            await connection.execute(
              `
                SELECT cca_id
                FROM ccas
                WHERE cca_id = ?
                FOR UPDATE
              `,
              [id]
            );

          if (!rows[0]) {
            throw new AdminServiceError(
              "CCA_NOT_FOUND",
              "The requested CCA does not exist."
            );
          }

          const value = validation.value;

          await connection.execute(
            `
              UPDATE ccas
              SET cca_name = ?,
                  category = ?,
                  description = ?,
                  meeting_day = ?,
                  meeting_start_time = ?,
                  meeting_end_time = ?,
                  location = ?,
                  contact_email = ?,
                  image_url = ?,
                  status = ?
              WHERE cca_id = ?
            `,
            [
              value.cca_name,
              value.category,
              toNullable(value.description),
              toNullable(value.meeting_day),
              value.meeting_start_time,
              value.meeting_end_time,
              toNullable(value.location),
              toNullable(
                value.contact_email
              ),
              toNullable(value.image_url),
              value.status,
              id,
            ]
          );
          await writeAdminLog(
            connection,
            actorId,
            "update_cca",
            "cca",
            id
          );

          return {
            ccaId: id,
            value,
          };
        }
      );
    },

    async toggleCcaStatus({
      adminUserId,
      ccaId,
    }) {
      const id = requirePositiveId(
        ccaId,
        "CCA_NOT_FOUND",
        "The requested CCA does not exist."
      );

      return withAdminTransaction(
        adminUserId,
        async (connection, { actorId }) => {
          const [rows] =
            await connection.execute(
              `
                SELECT cca_id, status
                FROM ccas
                WHERE cca_id = ?
                FOR UPDATE
              `,
              [id]
            );

          if (!rows[0]) {
            throw new AdminServiceError(
              "CCA_NOT_FOUND",
              "The requested CCA does not exist."
            );
          }

          const status =
            rows[0].status === "active"
              ? "inactive"
              : "active";

          await connection.execute(
            `
              UPDATE ccas
              SET status = ?
              WHERE cca_id = ?
            `,
            [status, id]
          );
          await writeAdminLog(
            connection,
            actorId,
            "toggle_cca_status",
            "cca",
            id
          );

          return {
            ccaId: id,
            status,
          };
        }
      );
    },

    async deleteCca({
      adminUserId,
      ccaId,
      confirmed = false,
    }) {
      const id = requirePositiveId(
        ccaId,
        "CCA_NOT_FOUND",
        "The requested CCA does not exist."
      );

      if (confirmed !== true) {
        throw new AdminServiceError(
          "CONFIRMATION_REQUIRED",
          "CCA deletion must be explicitly confirmed."
        );
      }

      return withAdminTransaction(
        adminUserId,
        async (connection, { actorId }) => {
          const [rows] =
            await connection.execute(
              `
                SELECT cca_id, cca_name
                FROM ccas
                WHERE cca_id = ?
                FOR UPDATE
              `,
              [id]
            );

          if (!rows[0]) {
            throw new AdminServiceError(
              "CCA_NOT_FOUND",
              "The requested CCA does not exist."
            );
          }

          await connection.execute(
            `
              DELETE FROM ccas
              WHERE cca_id = ?
            `,
            [id]
          );
          await writeAdminLog(
            connection,
            actorId,
            "delete_cca",
            "cca",
            id
          );

          return {
            ccaId: id,
            ccaName: rows[0].cca_name,
          };
        }
      );
    },

    async getQuestionAvailability() {
      const executor = database();
      const questions =
        await schemaTableExists(
          executor,
          "questions"
        );
      const replies =
        await schemaTableExists(
          executor,
          "question_replies"
        );
      const helpfulVotes =
        await schemaTableExists(
          executor,
          "helpful_votes"
        );

      return {
        available:
          questions && replies,
        questions,
        replies,
        helpfulVotes,
      };
    },

    async getQuestions(filters = {}) {
      const executor = database();
      const availability =
        await service.getQuestionAvailability();

      if (!availability.available) {
        return {
          available: false,
          questions: [],
        };
      }

      const search =
        typeof filters.search === "string"
          ? filters.search.trim()
          : "";
      const status =
        typeof filters.status === "string"
          ? filters.status.trim()
          : "";

      if (
        status &&
        !isSupportedQuestionStatus(status)
      ) {
        throw new AdminServiceError(
          "INVALID_QUESTION_STATUS",
          "Select a supported question status."
        );
      }

      const conditions = [];
      const parameters = [];

      if (search) {
        conditions.push(
          `(
            q.title LIKE ?
            OR q.content LIKE ?
            OR u.username LIKE ?
          )`
        );
        const pattern = `%${search}%`;
        parameters.push(
          pattern,
          pattern,
          pattern
        );
      }

      if (status) {
        conditions.push("q.status = ?");
        parameters.push(status);
      }

      const whereClause =
        conditions.length
          ? `WHERE ${conditions.join(
              " AND "
            )}`
          : "";
      const [questions] =
        await executor.execute(
          `
            SELECT
              q.*,
              u.name,
              u.username,
              u.email,
              u.username AS author_username,
              u.email AS author_email,
              (
                SELECT COUNT(*)
                FROM question_replies qr
                WHERE qr.question_id =
                  q.question_id
              ) AS reply_count
            FROM questions q
            LEFT JOIN users u
              ON u.user_id = q.user_id
            ${whereClause}
            ORDER BY q.created_at DESC,
              q.question_id DESC
          `,
          parameters
        );

      return {
        available: true,
        questions,
      };
    },

    async getQuestionById(questionId) {
      const id = requirePositiveId(
        questionId,
        "QUESTION_NOT_FOUND",
        "The requested question does not exist."
      );
      const executor = database();

      await ensureQuestionTables(executor);

      const [rows] = await executor.execute(
        `
          SELECT
            q.*,
            u.name,
            u.username,
            u.email,
            u.username AS author_username,
            u.email AS author_email
          FROM questions q
          LEFT JOIN users u
            ON u.user_id = q.user_id
          WHERE q.question_id = ?
          LIMIT 1
        `,
        [id]
      );

      if (!rows[0]) {
        return null;
      }

      const helpfulVotesAvailable =
        await schemaTableExists(
          executor,
          "helpful_votes"
        );
      const helpfulProjection =
        helpfulVotesAvailable
          ? `(
              SELECT COUNT(*)
              FROM helpful_votes hv
              WHERE hv.reply_id =
                qr.reply_id
            )`
          : "0";
      const [replies] =
        await executor.execute(
          `
            SELECT
              qr.*,
              u.name,
              u.username,
              u.email,
              u.username AS author_username,
              u.email AS author_email,
              ${helpfulProjection}
                AS helpful_count
            FROM question_replies qr
            LEFT JOIN users u
              ON u.user_id = qr.user_id
            WHERE qr.question_id = ?
            ORDER BY qr.created_at ASC,
              qr.reply_id ASC
          `,
          [id]
        );

      return {
        question: rows[0],
        replies,
      };
    },

    async updateQuestionStatus({
      adminUserId,
      questionId,
      status,
    }) {
      const id = requirePositiveId(
        questionId,
        "QUESTION_NOT_FOUND",
        "The requested question does not exist."
      );

      if (
        !isSupportedQuestionStatus(status)
      ) {
        throw new AdminServiceError(
          "INVALID_QUESTION_STATUS",
          "Select a supported question status."
        );
      }

      return withAdminTransaction(
        adminUserId,
        async (connection, { actorId }) => {
          await ensureQuestionTables(
            connection
          );
          const [rows] =
            await connection.execute(
              `
                SELECT question_id, status
                FROM questions
                WHERE question_id = ?
                FOR UPDATE
              `,
              [id]
            );

          if (!rows[0]) {
            throw new AdminServiceError(
              "QUESTION_NOT_FOUND",
              "The requested question does not exist."
            );
          }

          if (rows[0].status === status) {
            throw new AdminServiceError(
              "QUESTION_STATUS_UNCHANGED",
              "The question already has that status."
            );
          }

          await connection.execute(
            `
              UPDATE questions
              SET status = ?
              WHERE question_id = ?
            `,
            [status, id]
          );
          await writeAdminLog(
            connection,
            actorId,
            "moderate_question_status",
            "question",
            id
          );

          return {
            questionId: id,
            status,
          };
        }
      );
    },

    async deleteQuestion({
      adminUserId,
      questionId,
      confirmed = false,
    }) {
      const id = requirePositiveId(
        questionId,
        "QUESTION_NOT_FOUND",
        "The requested question does not exist."
      );

      if (confirmed !== true) {
        throw new AdminServiceError(
          "CONFIRMATION_REQUIRED",
          "Question deletion must be explicitly confirmed."
        );
      }

      return withAdminTransaction(
        adminUserId,
        async (connection, { actorId }) => {
          await ensureQuestionTables(
            connection
          );
          const [rows] =
            await connection.execute(
              `
                SELECT question_id, title
                FROM questions
                WHERE question_id = ?
                FOR UPDATE
              `,
              [id]
            );

          if (!rows[0]) {
            throw new AdminServiceError(
              "QUESTION_NOT_FOUND",
              "The requested question does not exist."
            );
          }

          await connection.execute(
            `
              DELETE FROM questions
              WHERE question_id = ?
            `,
            [id]
          );
          await writeAdminLog(
            connection,
            actorId,
            "delete_question",
            "question",
            id
          );

          return {
            questionId: id,
            title: rows[0].title,
          };
        }
      );
    },

    async deleteQuestionReply({
      adminUserId,
      replyId,
      confirmed = false,
    }) {
      const id = requirePositiveId(
        replyId,
        "QUESTION_REPLY_NOT_FOUND",
        "The requested reply does not exist."
      );

      if (confirmed !== true) {
        throw new AdminServiceError(
          "CONFIRMATION_REQUIRED",
          "Reply deletion must be explicitly confirmed."
        );
      }

      return withAdminTransaction(
        adminUserId,
        async (connection, { actorId }) => {
          await ensureQuestionTables(
            connection
          );
          const [rows] =
            await connection.execute(
              `
                SELECT reply_id, question_id
                FROM question_replies
                WHERE reply_id = ?
                FOR UPDATE
              `,
              [id]
            );

          if (!rows[0]) {
            throw new AdminServiceError(
              "QUESTION_REPLY_NOT_FOUND",
              "The requested reply does not exist."
            );
          }

          await connection.execute(
            `
              DELETE FROM question_replies
              WHERE reply_id = ?
            `,
            [id]
          );
          await writeAdminLog(
            connection,
            actorId,
            "delete_question_reply",
            "question_reply",
            id
          );

          return {
            replyId: id,
            questionId: Number(
              rows[0].question_id
            ),
          };
        }
      );
    },

    async getActivity(filters = {}) {
      const executor = database();
      const available =
        await schemaTableExists(
          executor,
          "admin_logs"
        );

      if (!available) {
        return {
          available: false,
          logs: [],
          admins: [],
          actions: [],
          targetTypes: [],
        };
      }

      const conditions = [];
      const parameters = [];
      const adminUserId = Number(
        filters.adminUserId
      );
      const action =
        typeof filters.action === "string"
          ? filters.action.trim()
          : "";
      const targetType =
        typeof filters.targetType ===
        "string"
          ? filters.targetType.trim()
          : "";

      if (
        Number.isSafeInteger(
          adminUserId
        ) &&
        adminUserId > 0
      ) {
        conditions.push(
          "l.admin_user_id = ?"
        );
        parameters.push(adminUserId);
      }

      if (action) {
        conditions.push("l.action = ?");
        parameters.push(action);
      }

      if (targetType) {
        conditions.push(
          "l.target_type = ?"
        );
        parameters.push(targetType);
      }

      const whereClause =
        conditions.length
          ? `WHERE ${conditions.join(
              " AND "
            )}`
          : "";
      const [logs] =
        await executor.execute(
          `
            SELECT
              l.id,
              l.id AS log_id,
              l.admin_user_id,
              l.action,
              l.target_type,
              l.target_id,
              l.created_at,
              u.username AS admin_username,
              u.email AS admin_email
            FROM admin_logs l
            LEFT JOIN users u
              ON u.user_id =
                l.admin_user_id
            ${whereClause}
            ORDER BY l.created_at DESC,
              l.id DESC
            LIMIT 500
          `,
          parameters
        );
      const [
        [admins],
        [actionRows],
        [targetTypeRows],
      ] = await Promise.all([
        executor.execute(
          `
            SELECT DISTINCT
              l.admin_user_id AS user_id,
              u.username,
              u.email
            FROM admin_logs l
            LEFT JOIN users u
              ON u.user_id =
                l.admin_user_id
            WHERE l.admin_user_id
              IS NOT NULL
            ORDER BY u.username,
              l.admin_user_id
          `
        ),
        executor.execute(
          `
            SELECT DISTINCT action
            FROM admin_logs
            ORDER BY action
          `
        ),
        executor.execute(
          `
            SELECT DISTINCT target_type
            FROM admin_logs
            ORDER BY target_type
          `
        ),
      ]);

      return {
        available: true,
        logs,
        admins,
        actions: actionRows.map(
          (row) => row.action
        ),
        targetTypes:
          targetTypeRows.map(
            (row) => row.target_type
          ),
      };
    },
  };

  return service;
};

const adminService =
  createAdminService(pool);

module.exports = adminService;
module.exports.AdminServiceError =
  AdminServiceError;
module.exports.CCA_CATEGORIES =
  CCA_CATEGORIES;
module.exports.CCA_STATUSES =
  CCA_STATUSES;
module.exports.QUESTION_STATUSES =
  QUESTION_STATUSES;
module.exports.USER_ROLES = USER_ROLES;
module.exports.createAdminService =
  createAdminService;
