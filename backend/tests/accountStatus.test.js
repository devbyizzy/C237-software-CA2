const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ACCOUNT_STATUS_ACTIVE,
  accountIsSuspended,
  accountStatusAllowsAccess,
  getAccountStatusByUserId,
} = require("../utils/accountStatus");

test(
  "getAccountStatusByUserId returns the normalised stored status",
  async () => {
    const calls = [];
    const database = {
      async execute(sql, parameters) {
        calls.push({
          sql: sql.replace(/\s+/g, " ").trim(),
          parameters,
        });

        return [
          [
            {
              account_status: " SUSPENDED ",
            },
          ],
          [],
        ];
      },
    };

    const result =
      await getAccountStatusByUserId(
        database,
        14
      );

    assert.deepEqual(result, {
      available: true,
      status: "suspended",
    });
    assert.deepEqual(calls[0].parameters, [
      14,
    ]);
    assert.match(
      calls[0].sql,
      /WHERE user_id = \?/
    );
    assert.equal(
      accountIsSuspended(result),
      true
    );
  }
);

test(
  "a missing account_status column falls back to active without masking other migrations",
  async () => {
    const missingColumn = new Error(
      "Unknown column 'account_status' in 'field list'"
    );
    missingColumn.code = "ER_BAD_FIELD_ERROR";

    const result =
      await getAccountStatusByUserId(
        {
          async execute(sql) {
            if (
              sql.includes(
                "SELECT account_status"
              )
            ) {
              throw missingColumn;
            }

            return [
              [
                {
                  user_id: 9,
                },
              ],
              [],
            ];
          },
        },
        9
      );

    assert.deepEqual(result, {
      available: false,
      status: ACCOUNT_STATUS_ACTIVE,
    });
    assert.equal(
      accountStatusAllowsAccess(result),
      true
    );

    const deletedResult =
      await getAccountStatusByUserId(
        {
          async execute(sql) {
            if (
              sql.includes(
                "SELECT account_status"
              )
            ) {
              throw missingColumn;
            }

            return [[], []];
          },
        },
        9
      );

    assert.deepEqual(deletedResult, {
      available: false,
      status: null,
    });
    assert.equal(
      accountStatusAllowsAccess(
        deletedResult
      ),
      false
    );

    const unrelatedColumn = new Error(
      "Unknown column 'role_name' in 'field list'"
    );
    unrelatedColumn.code =
      "ER_BAD_FIELD_ERROR";

    await assert.rejects(
      getAccountStatusByUserId(
        {
          async execute() {
            throw unrelatedColumn;
          },
        },
        9
      ),
      (error) => error === unrelatedColumn
    );

    const ambiguousBadField =
      new Error();
    ambiguousBadField.code =
      "ER_BAD_FIELD_ERROR";

    await assert.rejects(
      getAccountStatusByUserId(
        {
          async execute() {
            throw ambiguousBadField;
          },
        },
        9
      ),
      (error) =>
        error === ambiguousBadField
    );
  }
);

test(
  "accountStatusAllowsAccess fails closed for missing or non-active status data",
  () => {
    assert.equal(
      accountStatusAllowsAccess(null),
      false
    );
    assert.equal(
      accountStatusAllowsAccess({
        available: true,
        status: "suspended",
      }),
      false
    );
    assert.equal(
      accountStatusAllowsAccess({
        available: true,
        status: "active",
      }),
      true
    );
  }
);
