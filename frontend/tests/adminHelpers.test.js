const assert = require("node:assert/strict");
const test = require("node:test");

const {
  adminPromotionIsConfirmed,
  csrfTokenIsValid,
  normaliseQueryText,
  parsePositiveId,
} = require("../routes/admin");

test(
  "parsePositiveId accepts only canonical positive safe-integer strings",
  () => {
    assert.equal(parsePositiveId("1"), 1);
    assert.equal(
      parsePositiveId("9007199254740991"),
      Number.MAX_SAFE_INTEGER
    );

    for (const invalidValue of [
      "",
      "0",
      "-1",
      "1.5",
      "1e2",
      " 12 ",
      "01",
      "9007199254740992",
      12,
      null,
      undefined,
    ]) {
      assert.equal(
        parsePositiveId(invalidValue),
        null,
        `expected ${String(
          invalidValue
        )} to be rejected`
      );
    }
  }
);

test(
  "normaliseQueryText trims, truncates, and rejects non-string query values",
  () => {
    assert.equal(
      normaliseQueryText(
        "  student_name  ",
        30
      ),
      "student_name"
    );
    assert.equal(
      normaliseQueryText("  abcdef  ", 5),
      "abcde"
    );
    assert.equal(
      normaliseQueryText(["admin"], 20),
      ""
    );
    assert.equal(
      normaliseQueryText(undefined, 20),
      ""
    );
  }
);

test(
  "admin promotion requires its dedicated acknowledgement",
  () => {
    assert.equal(
      adminPromotionIsConfirmed({
        confirmRoleChange: "yes",
      }),
      false
    );
    assert.equal(
      adminPromotionIsConfirmed({
        confirmRoleChange: "yes",
        confirmAdminPromotion: "yes",
      }),
      true
    );
    assert.equal(
      adminPromotionIsConfirmed({
        confirmAdminPromotion: true,
      }),
      false
    );
  }
);

test(
  "admin CSRF verification requires an exact session token",
  () => {
    assert.equal(
      csrfTokenIsValid({
        body: {
          _csrf: "known-token",
        },
        session: {
          adminCsrfToken:
            "known-token",
        },
      }),
      true
    );

    for (const request of [
      {
        body: {
          _csrf: "wrong-token",
        },
        session: {
          adminCsrfToken:
            "known-token",
        },
      },
      {
        body: {},
        session: {
          adminCsrfToken:
            "known-token",
        },
      },
      {
        body: {
          _csrf: "known-token",
        },
        session: {},
      },
    ]) {
      assert.equal(
        csrfTokenIsValid(request),
        false
      );
    }
  }
);
