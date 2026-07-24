const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createRequireLogin,
  getSessionUserId,
} = require("../middleware/requireLogin");

const createResponse = () => {
  const state = {
    statusCode: 200,
    redirectPath: null,
    body: null,
    clearedCookies: [],
  };

  const response = {
    clearCookie(name) {
      state.clearedCookies.push(name);
      return response;
    },

    redirect(path) {
      state.redirectPath = path;
      return response;
    },

    status(statusCode) {
      state.statusCode = statusCode;
      return response;
    },

    send(body) {
      state.body = body;
      return response;
    },
  };

  return {
    response,
    state,
  };
};

const createSession = (user) => {
  const state = {
    destroyCalls: 0,
  };

  return {
    session: {
      user,
      pendingUser: {
        userId: 99,
      },
      pendingTwoFactorSecret:
        "temporary-secret",
      pendingTwoFactorQrCode:
        "temporary-qr-code",

      destroy(callback) {
        state.destroyCalls += 1;
        callback(null);
      },
    },
    state,
  };
};

test(
  "requireLogin redirects an unauthenticated request without a lookup",
  async () => {
    let lookupCalls = 0;
    const middleware =
      createRequireLogin({
        async loadAccountStatus() {
          lookupCalls += 1;
          return {
            available: true,
            status: "active",
          };
        },
      });
    const { response, state } =
      createResponse();
    let nextCalls = 0;

    await middleware(
      {
        session: {},
      },
      response,
      () => {
        nextCalls += 1;
      }
    );

    assert.equal(
      state.redirectPath,
      "/login"
    );
    assert.equal(lookupCalls, 0);
    assert.equal(nextCalls, 0);
  }
);

test(
  "requireLogin allows active accounts and passes the exact valid user ID",
  async () => {
    const lookedUpUserIds = [];
    const middleware =
      createRequireLogin({
        database: {
          name: "injected database",
        },
        async loadAccountStatus(
          database,
          userId
        ) {
          assert.equal(
            database.name,
            "injected database"
          );
          lookedUpUserIds.push(userId);

          return {
            available: true,
            status: "active",
          };
        },
      });
    const { response, state } =
      createResponse();
    let nextCalls = 0;

    await middleware(
      {
        session: {
          user: {
            userId: 17,
          },
        },
      },
      response,
      () => {
        nextCalls += 1;
      }
    );

    assert.deepEqual(
      lookedUpUserIds,
      [17]
    );
    assert.equal(nextCalls, 1);
    assert.equal(
      state.redirectPath,
      null
    );
  }
);

test(
  "requireLogin remains compatible before the account status migration",
  async () => {
    let databaseCalls = 0;
    const middleware =
      createRequireLogin({
        database: {
          async execute(sql) {
            databaseCalls += 1;

            if (
              sql.includes(
                "SELECT user_id"
              )
            ) {
              return [
                [
                  {
                    user_id: 17,
                  },
                ],
                [],
              ];
            }

            const error = new Error(
              "Unknown column 'account_status' in 'field list'"
            );
            error.code =
              "ER_BAD_FIELD_ERROR";
            throw error;
          },
        },
      });
    const { response } =
      createResponse();
    let nextCalls = 0;

    await middleware(
      {
        session: {
          user: {
            userId: 17,
          },
        },
      },
      response,
      () => {
        nextCalls += 1;
      }
    );

    assert.equal(nextCalls, 1);
    assert.equal(databaseCalls, 2);
  }
);

test(
  "requireLogin denies suspended, deleted, and invalid account statuses and clears their sessions",
  async () => {
    const cases = [
      {
        name: "suspended",
        accountStatus: {
          available: true,
          status: "suspended",
        },
      },
      {
        name: "deleted",
        accountStatus: {
          available: true,
          status: null,
        },
      },
      {
        name: "invalid status",
        accountStatus: {
          available: true,
          status: "locked",
        },
      },
    ];

    for (const testCase of cases) {
      const middleware =
        createRequireLogin({
          async loadAccountStatus() {
            return testCase.accountStatus;
          },
        });
      const {
        session,
        state: sessionState,
      } = createSession({
        userId: 17,
      });
      const { response, state } =
        createResponse();
      let nextCalls = 0;

      await middleware(
        {
          session,
        },
        response,
        () => {
          nextCalls += 1;
        }
      );

      assert.equal(
        state.redirectPath,
        "/login",
        testCase.name
      );
      assert.deepEqual(
        state.clearedCookies,
        ["connect.sid"],
        testCase.name
      );
      assert.equal(
        sessionState.destroyCalls,
        1,
        testCase.name
      );
      assert.equal(
        session.user,
        undefined,
        testCase.name
      );
      assert.equal(
        session.pendingUser,
        undefined,
        testCase.name
      );
      assert.equal(
        session.pendingTwoFactorSecret,
        undefined,
        testCase.name
      );
      assert.equal(
        session.pendingTwoFactorQrCode,
        undefined,
        testCase.name
      );
      assert.equal(
        nextCalls,
        0,
        testCase.name
      );
    }
  }
);

test(
  "requireLogin rejects invalid session user IDs before querying and clears the session",
  async () => {
    for (const invalidUserId of [
      0,
      -1,
      1.5,
      " 17",
      "017",
      "17x",
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      let lookupCalls = 0;
      const middleware =
        createRequireLogin({
          async loadAccountStatus() {
            lookupCalls += 1;
          },
        });
      const {
        session,
        state: sessionState,
      } = createSession({
        userId: invalidUserId,
      });
      const { response, state } =
        createResponse();

      await middleware(
        {
          session,
        },
        response,
        () => {
          assert.fail(
            "next must not be called"
          );
        }
      );

      assert.equal(lookupCalls, 0);
      assert.equal(
        sessionState.destroyCalls,
        1
      );
      assert.equal(
        state.redirectPath,
        "/login"
      );
    }

    assert.equal(
      getSessionUserId({
        userId: "17",
      }),
      17
    );
  }
);

test(
  "requireLogin fails closed with a generic 503 when the database lookup fails",
  async () => {
    const databaseError = new Error(
      "sensitive database detail"
    );
    const logged = [];
    const middleware =
      createRequireLogin({
        async loadAccountStatus() {
          throw databaseError;
        },
        logger: {
          error(...values) {
            logged.push(values);
          },
        },
      });
    const { response, state } =
      createResponse();
    let nextCalls = 0;

    await middleware(
      {
        session: {
          user: {
            userId: 17,
          },
        },
      },
      response,
      () => {
        nextCalls += 1;
      }
    );

    assert.equal(state.statusCode, 503);
    assert.equal(
      state.body,
      "Account access is temporarily unavailable."
    );
    assert.equal(
      state.body.includes(
        databaseError.message
      ),
      false
    );
    assert.equal(nextCalls, 0);
    assert.equal(logged.length, 1);
  }
);
