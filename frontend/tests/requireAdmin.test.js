const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createRequireAdmin,
} = require("../middleware/requireAdmin");

const createResponse = () => {
  const state = {
    statusCode: 200,
    redirectPath: null,
    body: null,
  };

  const response = {
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

const createRoleDatabase = (
  role = "admin"
) => {
  const calls = [];

  return {
    calls,
    database: {
      async execute(sql, parameters) {
        calls.push({
          sql: sql
            .replace(/\s+/g, " ")
            .trim(),
          parameters,
        });

        return [
          role
            ? [
                {
                  user_id: 7,
                  role,
                },
              ]
            : [],
          [],
        ];
      },
    },
  };
};

test(
  "requireAdmin redirects an unauthenticated request without querying the database",
  async () => {
    const { database, calls } =
      createRoleDatabase();
    const middleware =
      createRequireAdmin({
        database,
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
    assert.equal(nextCalls, 0);
    assert.equal(calls.length, 0);
  }
);

test(
  "requireAdmin accepts only an exact lowercase admin role in the session",
  async () => {
    for (const role of [
      "year1",
      "Admin",
      "ADMIN",
      "",
    ]) {
      const { database, calls } =
        createRoleDatabase();
      const middleware =
        createRequireAdmin({
          database,
        });
      const { response, state } =
        createResponse();
      let nextCalls = 0;

      await middleware(
        {
          session: {
            user: {
              userId: 7,
              role,
            },
          },
        },
        response,
        () => {
          nextCalls += 1;
        }
      );

      assert.equal(
        state.statusCode,
        403,
        role
      );
      assert.equal(
        state.body,
        "Access denied.",
        role
      );
      assert.equal(nextCalls, 0, role);
      assert.equal(
        calls.length,
        0,
        role
      );
    }
  }
);

test(
  "requireAdmin allows a current active database admin",
  async () => {
    const { database, calls } =
      createRoleDatabase();
    const middleware =
      createRequireAdmin({
        database,
        async loadAccountStatus() {
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
            userId: 7,
            role: "admin",
          },
        },
      },
      response,
      () => {
        nextCalls += 1;
      }
    );

    assert.equal(nextCalls, 1);
    assert.equal(state.statusCode, 200);
    assert.equal(state.body, null);
    assert.deepEqual(
      calls[0].parameters,
      [7]
    );
  }
);

test(
  "requireAdmin denies a deleted, demoted, or suspended live account",
  async () => {
    const cases = [
      {
        liveRole: null,
        status: "active",
      },
      {
        liveRole: "year3",
        status: "active",
      },
      {
        liveRole: "admin",
        status: "suspended",
      },
    ];

    for (const testCase of cases) {
      const { database } =
        createRoleDatabase(
          testCase.liveRole
        );
      const middleware =
        createRequireAdmin({
          database,
          async loadAccountStatus() {
            return {
              available: true,
              status: testCase.status,
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
              userId: 7,
              role: "admin",
            },
          },
        },
        response,
        () => {
          nextCalls += 1;
        }
      );

      assert.equal(
        state.statusCode,
        403
      );
      assert.equal(
        state.body,
        "Access denied."
      );
      assert.equal(nextCalls, 0);
    }
  }
);

test(
  "requireAdmin remains compatible before the account status migration",
  async () => {
    let callNumber = 0;
    const database = {
      async execute() {
        callNumber += 1;

        if (callNumber === 1) {
          return [
            [
              {
                user_id: 7,
                role: "admin",
              },
            ],
            [],
          ];
        }

        if (callNumber === 3) {
          return [
            [
              {
                user_id: 7,
              },
            ],
            [],
          ];
        }

        const error = new Error(
          "Unknown column 'account_status' in 'field list'"
        );
        error.code = "ER_BAD_FIELD_ERROR";
        throw error;
      },
    };
    const middleware =
      createRequireAdmin({
        database,
      });
    const { response } = createResponse();
    let nextCalls = 0;

    await middleware(
      {
        session: {
          user: {
            userId: 7,
            role: "admin",
          },
        },
      },
      response,
      () => {
        nextCalls += 1;
      }
    );

    assert.equal(nextCalls, 1);
    assert.equal(callNumber, 3);
  }
);

test(
  "requireAdmin fails closed without exposing database errors",
  async () => {
    const databaseError = new Error(
      "sensitive database detail"
    );
    const logged = [];
    const middleware =
      createRequireAdmin({
        database: {
          async execute() {
            throw databaseError;
          },
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
            userId: 7,
            role: "admin",
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
      "Administrator access is temporarily unavailable."
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
