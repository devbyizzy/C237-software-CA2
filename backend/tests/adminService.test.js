const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createAdminService,
} = require("../services/adminService");

const normaliseSql = (sql) =>
  sql.replace(/\s+/g, " ").trim();

const rejectsWithCode = (code) => {
  return (error) => {
    assert.equal(error.code, code);
    return true;
  };
};

const createTransactionPool = ({
  actor = {
    user_id: 7,
    role: "admin",
  },
  accountStatusAvailable = false,
  actorStatus = "active",
  execute,
} = {}) => {
  const state = {
    calls: [],
    events: [],
    getConnectionCalls: 0,
    committed: false,
    rolledBack: false,
    released: false,
  };

  const connection = {
    async beginTransaction() {
      state.events.push("begin");
    },

    async execute(sql, parameters = []) {
      const call = {
        sql: normaliseSql(sql),
        parameters,
      };

      state.calls.push(call);
      state.events.push(`execute:${call.sql}`);

      if (
        call.sql.includes(
          "SELECT user_id, role FROM users"
        )
      ) {
        return [actor ? [actor] : [], []];
      }

      if (
        call.sql.includes(
          "FROM information_schema.COLUMNS"
        )
      ) {
        assert.deepEqual(parameters, [
          "users",
          "account_status",
        ]);
        return [
          [
            {
              column_exists:
                accountStatusAvailable
                  ? 1
                  : 0,
            },
          ],
          [],
        ];
      }

      if (
        call.sql.includes(
          "SELECT account_status FROM users"
        )
      ) {
        return [
          actorStatus === null
            ? []
            : [
                {
                  account_status:
                    actorStatus,
                },
              ],
          [],
        ];
      }

      if (execute) {
        return execute(call, state);
      }

      throw new Error(
        `Unexpected SQL in test: ${call.sql}`
      );
    },

    async commit() {
      state.committed = true;
      state.events.push("commit");
    },

    async rollback() {
      state.rolledBack = true;
      state.events.push("rollback");
    },

    release() {
      state.released = true;
      state.events.push("release");
    },
  };

  const database = {
    async getConnection() {
      state.getConnectionCalls += 1;
      return connection;
    },
  };

  return {
    pool: {
      promise() {
        return database;
      },
    },
    state,
  };
};

const targetUser = ({
  userId = 12,
  role = "year1",
  accountStatus = "active",
  twoFactorEnabled = 1,
  twoFactorSecret = "TEST-SECRET",
} = {}) => ({
  user_id: userId,
  username: `student${userId}`,
  email: `${userId}@myrp.edu.sg`,
  role,
  account_status: accountStatus,
  two_factor_enabled: twoFactorEnabled,
  two_factor_secret: twoFactorSecret,
});

test(
  "mutations require an exact lowercase admin role",
  async () => {
    const { pool, state } =
      createTransactionPool({
        actor: {
          user_id: 7,
          role: "Admin",
        },
      });
    const service = createAdminService(pool);

    await assert.rejects(
      service.resetUserTwoFactor({
        adminUserId: 7,
        targetUserId: 12,
      }),
      rejectsWithCode("ADMIN_FORBIDDEN")
    );

    assert.equal(state.calls.length, 1);
    assert.deepEqual(
      state.calls[0].parameters,
      [7]
    );
    assert.equal(state.committed, false);
    assert.equal(state.rolledBack, true);
    assert.equal(state.released, true);
  }
);

test(
  "a suspended admin is rejected before the target mutation",
  async () => {
    const { pool, state } =
      createTransactionPool({
        accountStatusAvailable: true,
        actorStatus: "suspended",
      });
    const service = createAdminService(pool);

    await assert.rejects(
      service.deleteGroup({
        adminUserId: 7,
        groupId: 3,
        confirmed: true,
      }),
      rejectsWithCode("ADMIN_FORBIDDEN")
    );

    assert.equal(
      state.calls.some((call) =>
        call.sql.includes(
          "FROM student_groups"
        )
      ),
      false
    );
    assert.equal(state.rolledBack, true);
  }
);

test(
  "suspension requires the account-status migration",
  async () => {
    const { pool, state } =
      createTransactionPool({
        accountStatusAvailable: false,
      });
    const service = createAdminService(pool);

    await assert.rejects(
      service.setUserSuspension({
        adminUserId: 7,
        targetUserId: 12,
        suspended: true,
      }),
      rejectsWithCode(
        "ACCOUNT_STATUS_MISSING"
      )
    );

    assert.equal(
      state.calls.some((call) =>
        call.sql.startsWith(
          "UPDATE users SET account_status"
        )
      ),
      false
    );
    assert.equal(state.rolledBack, true);
    assert.equal(state.committed, false);
  }
);

test(
  "suspension applies one status transition and records it",
  async () => {
    const expectedTarget = targetUser();
    const { pool, state } =
      createTransactionPool({
        accountStatusAvailable: true,
        execute(call) {
          if (
            call.sql.includes(
              "two_factor_enabled"
            ) &&
            call.sql.includes("FOR UPDATE")
          ) {
            return [[expectedTarget], []];
          }

          if (
            call.sql.startsWith(
              "UPDATE users SET account_status = ?"
            )
          ) {
            return [
              {
                affectedRows: 1,
              },
              [],
            ];
          }

          if (
            call.sql.startsWith(
              "INSERT INTO admin_logs"
            )
          ) {
            return [
              {
                affectedRows: 1,
              },
              [],
            ];
          }

          throw new Error(
            `Unexpected SQL in suspension test: ${call.sql}`
          );
        },
      });
    const service = createAdminService(pool);

    const result =
      await service.setUserSuspension({
        adminUserId: 7,
        targetUserId: 12,
        suspended: true,
      });

    const update = state.calls.find((call) =>
      call.sql.startsWith(
        "UPDATE users SET account_status = ?"
      )
    );
    const log = state.calls.find((call) =>
      call.sql.startsWith(
        "INSERT INTO admin_logs"
      )
    );

    assert.deepEqual(update.parameters, [
      "suspended",
      12,
    ]);
    assert.deepEqual(log.parameters, [
      7,
      "suspend_user",
      "user",
      12,
    ]);
    assert.deepEqual(result, {
      userId: 12,
      status: "suspended",
    });
    assert.equal(state.committed, true);
    assert.equal(state.rolledBack, false);
  }
);

test(
  "administrators cannot suspend themselves",
  async () => {
    const { pool, state } =
      createTransactionPool();
    const service = createAdminService(pool);

    await assert.rejects(
      service.setUserSuspension({
        adminUserId: 7,
        targetUserId: 7,
        suspended: true,
      }),
      rejectsWithCode(
        "SELF_ACTION_NOT_ALLOWED"
      )
    );

    assert.equal(
      state.getConnectionCalls,
      0
    );
  }
);

test(
  "admin suspension locks the active-admin set and rejects an unsafe final count",
  async () => {
    const { pool, state } =
      createTransactionPool({
        accountStatusAvailable: true,
        execute(call) {
          if (
            call.sql.includes(
              "two_factor_enabled"
            ) &&
            call.sql.includes(
              "FROM users"
            )
          ) {
            return [
              [
                targetUser({
                  role: "admin",
                }),
              ],
              [],
            ];
          }

          if (
            call.sql.includes(
              "WHERE role = 'admin'"
            ) &&
            call.sql.includes(
              "FOR UPDATE"
            )
          ) {
            return [
              [
                {
                  user_id: 12,
                },
              ],
              [],
            ];
          }

          throw new Error(
            `Unexpected SQL in last-admin test: ${call.sql}`
          );
        },
      });
    const service = createAdminService(pool);

    await assert.rejects(
      service.setUserSuspension({
        adminUserId: 7,
        targetUserId: 12,
        suspended: true,
      }),
      rejectsWithCode(
        "LAST_ACTIVE_ADMIN"
      )
    );

    const adminLock = state.calls.find(
      (call) =>
        call.sql.includes(
          "WHERE role = 'admin'"
        )
    );

    assert.ok(adminLock);
    assert.match(
      adminLock.sql,
      /account_status = 'active'/
    );
    assert.match(
      adminLock.sql,
      /FOR UPDATE/
    );
    assert.equal(state.rolledBack, true);
    assert.equal(state.committed, false);
  }
);

test(
  "role changes use the strict allowlist and reject self-role changes before a transaction",
  async () => {
    const invalid = createTransactionPool();
    const invalidService =
      createAdminService(invalid.pool);

    await assert.rejects(
      invalidService.changeUserRole({
        adminUserId: 7,
        targetUserId: 12,
        newRole: "moderator",
      }),
      rejectsWithCode("INVALID_ROLE")
    );
    await assert.rejects(
      invalidService.changeUserRole({
        adminUserId: 7,
        targetUserId: 12,
        newRole: "Admin",
      }),
      rejectsWithCode("INVALID_ROLE")
    );
    assert.equal(
      invalid.state.getConnectionCalls,
      0
    );

    const self = createTransactionPool();
    const selfService =
      createAdminService(self.pool);

    await assert.rejects(
      selfService.changeUserRole({
        adminUserId: 7,
        targetUserId: 7,
        newRole: "year1",
      }),
      rejectsWithCode(
        "SELF_ACTION_NOT_ALLOWED"
      )
    );
    assert.equal(
      self.state.getConnectionCalls,
      0
    );
  }
);

test(
  "administrators cannot delete themselves",
  async () => {
    const { pool, state } =
      createTransactionPool();
    const service = createAdminService(pool);

    await assert.rejects(
      service.deleteUser({
        adminUserId: 7,
        targetUserId: 7,
        confirmed: true,
      }),
      rejectsWithCode(
        "SELF_ACTION_NOT_ALLOWED"
      )
    );
    assert.equal(
      state.getConnectionCalls,
      0
    );
  }
);

test(
  "2FA reset updates exactly the two 2FA fields and writes the audit log",
  async () => {
    const expectedTarget = targetUser();
    const { pool, state } =
      createTransactionPool({
        execute(call) {
          if (
            call.sql.includes(
              "two_factor_enabled"
            ) &&
            call.sql.includes("FOR UPDATE")
          ) {
            return [[expectedTarget], []];
          }

          if (
            call.sql.startsWith(
              "UPDATE users SET"
            )
          ) {
            return [
              {
                affectedRows: 1,
              },
              [],
            ];
          }

          if (
            call.sql.startsWith(
              "INSERT INTO admin_logs"
            )
          ) {
            return [
              {
                affectedRows: 1,
              },
              [],
            ];
          }

          throw new Error(
            `Unexpected SQL in 2FA test: ${call.sql}`
          );
        },
      });
    const service = createAdminService(pool);

    const result =
      await service.resetUserTwoFactor({
        adminUserId: 7,
        targetUserId: 12,
      });

    const update = state.calls.find((call) =>
      call.sql.startsWith(
        "UPDATE users SET"
      )
    );
    const log = state.calls.find((call) =>
      call.sql.startsWith(
        "INSERT INTO admin_logs"
      )
    );

    assert.equal(
      update.sql,
      "UPDATE users SET two_factor_secret = NULL, two_factor_enabled = FALSE WHERE user_id = ?"
    );
    assert.deepEqual(update.parameters, [12]);
    assert.deepEqual(log.parameters, [
      7,
      "reset_user_2fa",
      "user",
      12,
    ]);
    assert.deepEqual(result, {
      userId: 12,
      username: "student12",
      email: "12@myrp.edu.sg",
    });
    assert.equal(state.committed, true);
  }
);

test(
  "2FA reset rolls back when its audit-log insert fails",
  async () => {
    const logFailure = new Error(
      "simulated log failure"
    );
    logFailure.code = "ER_LOG_WRITE_FAILED";
    const { pool, state } =
      createTransactionPool({
        execute(call) {
          if (
            call.sql.includes(
              "two_factor_enabled"
            ) &&
            call.sql.includes("FOR UPDATE")
          ) {
            return [[targetUser()], []];
          }

          if (
            call.sql.startsWith(
              "UPDATE users SET"
            )
          ) {
            return [
              {
                affectedRows: 1,
              },
              [],
            ];
          }

          if (
            call.sql.startsWith(
              "INSERT INTO admin_logs"
            )
          ) {
            throw logFailure;
          }

          throw new Error(
            `Unexpected SQL in rollback test: ${call.sql}`
          );
        },
      });
    const service = createAdminService(pool);

    await assert.rejects(
      service.resetUserTwoFactor({
        adminUserId: 7,
        targetUserId: 12,
      }),
      (error) => error === logFailure
    );

    assert.equal(state.committed, false);
    assert.equal(state.rolledBack, true);
    assert.deepEqual(
      state.events.slice(-2),
      ["rollback", "release"]
    );
  }
);

test(
  "group deletion removes only the parent row and records one audit entry",
  async () => {
    const { pool, state } =
      createTransactionPool({
        execute(call) {
          if (
            call.sql.includes(
              "FROM student_groups"
            ) &&
            call.sql.includes("FOR UPDATE")
          ) {
            return [
              [
                {
                  group_id: 3,
                  group_name: "Robotics",
                },
              ],
              [],
            ];
          }

          if (
            call.sql.startsWith(
              "DELETE FROM student_groups"
            )
          ) {
            return [
              {
                affectedRows: 1,
              },
              [],
            ];
          }

          if (
            call.sql.startsWith(
              "INSERT INTO admin_logs"
            )
          ) {
            return [
              {
                affectedRows: 1,
              },
              [],
            ];
          }

          throw new Error(
            `Unexpected SQL in group test: ${call.sql}`
          );
        },
      });
    const service = createAdminService(pool);

    const result = await service.deleteGroup({
      adminUserId: 7,
      groupId: 3,
      confirmed: true,
    });

    const deletes = state.calls.filter(
      (call) =>
        call.sql.startsWith("DELETE FROM")
    );
    const log = state.calls.find((call) =>
      call.sql.startsWith(
        "INSERT INTO admin_logs"
      )
    );

    assert.equal(deletes.length, 1);
    assert.equal(
      deletes[0].sql,
      "DELETE FROM student_groups WHERE group_id = ?"
    );
    assert.deepEqual(deletes[0].parameters, [
      3,
    ]);
    assert.deepEqual(log.parameters, [
      7,
      "delete_group",
      "group",
      3,
    ]);
    assert.deepEqual(result, {
      groupId: 3,
      groupName: "Robotics",
    });
    assert.equal(state.committed, true);
  }
);

test(
  "invalid CCA input is rejected before opening a transaction",
  async () => {
    const { pool, state } =
      createTransactionPool();
    const service = createAdminService(pool);

    await assert.rejects(
      service.createCca({
        adminUserId: 7,
        cca: {
          cca_name: "",
          category: "Unknown",
          status: "ACTIVE",
          meeting_start_time: "18:00",
        },
      }),
      (error) => {
        assert.equal(
          error.code,
          "CCA_VALIDATION_FAILED"
        );
        assert.ok(error.details.cca_name);
        assert.ok(error.details.category);
        assert.ok(
          error.details.meeting_end_time
        );
        return true;
      }
    );

    assert.equal(
      state.getConnectionCalls,
      0
    );
  }
);

test(
  "question status uses a strict allowlist before opening a transaction",
  async () => {
    const { pool, state } =
      createTransactionPool();
    const service = createAdminService(pool);

    await assert.rejects(
      service.updateQuestionStatus({
        adminUserId: 7,
        questionId: 9,
        status: "Resolved",
      }),
      rejectsWithCode(
        "INVALID_QUESTION_STATUS"
      )
    );
    await assert.rejects(
      service.updateQuestionStatus({
        adminUserId: 7,
        questionId: 9,
        status: "deleted",
      }),
      rejectsWithCode(
        "INVALID_QUESTION_STATUS"
      )
    );
    assert.equal(
      state.getConnectionCalls,
      0
    );
  }
);

test(
  "question status update checks both tables, updates once, and logs the action",
  async () => {
    const { pool, state } =
      createTransactionPool({
        execute(call) {
          if (
            call.sql.includes(
              "FROM information_schema.TABLES"
            )
          ) {
            assert.ok(
              [
                "questions",
                "question_replies",
              ].includes(call.parameters[0])
            );
            return [
              [
                {
                  table_exists: 1,
                },
              ],
              [],
            ];
          }

          if (
            call.sql.includes(
              "SELECT question_id, status FROM questions"
            )
          ) {
            return [
              [
                {
                  question_id: 9,
                  status: "open",
                },
              ],
              [],
            ];
          }

          if (
            call.sql.startsWith(
              "UPDATE questions SET status = ?"
            )
          ) {
            return [
              {
                affectedRows: 1,
              },
              [],
            ];
          }

          if (
            call.sql.startsWith(
              "INSERT INTO admin_logs"
            )
          ) {
            return [
              {
                affectedRows: 1,
              },
              [],
            ];
          }

          throw new Error(
            `Unexpected SQL in question test: ${call.sql}`
          );
        },
      });
    const service = createAdminService(pool);

    const result =
      await service.updateQuestionStatus({
        adminUserId: 7,
        questionId: 9,
        status: "resolved",
      });

    const tableChecks = state.calls.filter(
      (call) =>
        call.sql.includes(
          "FROM information_schema.TABLES"
        )
    );
    const update = state.calls.find((call) =>
      call.sql.startsWith(
        "UPDATE questions SET status = ?"
      )
    );
    const log = state.calls.find((call) =>
      call.sql.startsWith(
        "INSERT INTO admin_logs"
      )
    );

    assert.deepEqual(
      tableChecks.map(
        (call) => call.parameters[0]
      ),
      ["questions", "question_replies"]
    );
    assert.deepEqual(update.parameters, [
      "resolved",
      9,
    ]);
    assert.deepEqual(log.parameters, [
      7,
      "moderate_question_status",
      "question",
      9,
    ]);
    assert.deepEqual(result, {
      questionId: 9,
      status: "resolved",
    });
    assert.equal(state.committed, true);
  }
);

test(
  "activity history reports unavailable without querying the log table",
  async () => {
    const calls = [];
    const database = {
      async execute(sql, parameters = []) {
        const call = {
          sql: normaliseSql(sql),
          parameters,
        };
        calls.push(call);

        assert.match(
          call.sql,
          /information_schema\.TABLES/
        );
        assert.deepEqual(parameters, [
          "admin_logs",
        ]);
        return [
          [
            {
              table_exists: 0,
            },
          ],
          [],
        ];
      },
    };
    const service = createAdminService({
      promise() {
        return database;
      },
    });

    const activity =
      await service.getActivity();

    assert.equal(calls.length, 1);
    assert.deepEqual(activity, {
      available: false,
      logs: [],
      admins: [],
      actions: [],
      targetTypes: [],
    });
  }
);

test(
  "activity filters stay parameterized and return filter options",
  async () => {
    const calls = [];
    const logs = [
      {
        log_id: 4,
        action: "delete_group",
      },
    ];
    const admins = [
      {
        user_id: 7,
        username: "admin",
      },
    ];
    const database = {
      async execute(sql, parameters = []) {
        const call = {
          sql: normaliseSql(sql),
          parameters,
        };
        calls.push(call);

        if (
          call.sql.includes(
            "FROM information_schema.TABLES"
          )
        ) {
          return [
            [
              {
                table_exists: 1,
              },
            ],
            [],
          ];
        }

        if (
          call.sql.includes(
            "SELECT DISTINCT l.admin_user_id"
          )
        ) {
          return [admins, []];
        }

        if (
          call.sql.includes(
            "SELECT DISTINCT action"
          )
        ) {
          return [
            [
              {
                action: "delete_group",
              },
            ],
            [],
          ];
        }

        if (
          call.sql.includes(
            "SELECT DISTINCT target_type"
          )
        ) {
          return [
            [
              {
                target_type: "group",
              },
            ],
            [],
          ];
        }

        if (
          call.sql.includes(
            "FROM admin_logs l LEFT JOIN users"
          )
        ) {
          return [logs, []];
        }

        throw new Error(
          `Unexpected SQL in activity test: ${call.sql}`
        );
      },
    };
    const service = createAdminService({
      promise() {
        return database;
      },
    });

    const activity =
      await service.getActivity({
        adminUserId: "7",
        action: "delete_group",
        targetType: "group",
      });

    const logQuery = calls.find(
      (call) =>
        call.sql.includes(
          "ORDER BY l.created_at DESC"
        )
    );

    assert.ok(logQuery);
    assert.match(
      logQuery.sql,
      /l\.admin_user_id = \?/
    );
    assert.match(
      logQuery.sql,
      /l\.action = \?/
    );
    assert.match(
      logQuery.sql,
      /l\.target_type = \?/
    );
    assert.equal(
      logQuery.sql.includes(
        "delete_group"
      ),
      false
    );
    assert.deepEqual(logQuery.parameters, [
      7,
      "delete_group",
      "group",
    ]);
    assert.deepEqual(activity, {
      available: true,
      logs,
      admins,
      actions: ["delete_group"],
      targetTypes: ["group"],
    });
  }
);
