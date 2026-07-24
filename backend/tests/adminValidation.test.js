const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CCA_CATEGORIES,
  CCA_STATUSES,
  QUESTION_STATUSES,
  USER_ROLES,
  isSupportedQuestionStatus,
  isSupportedUserRole,
  validateCcaInput,
} = require("../services/adminValidation");

test(
  "admin allowlists contain only supported stored values",
  () => {
    assert.deepEqual(USER_ROLES, [
      "year1",
      "year2",
      "year3",
      "admin",
    ]);
    assert.deepEqual(CCA_CATEGORIES, [
      "Technology",
      "Arts",
      "Sports",
      "Student Life",
    ]);
    assert.deepEqual(CCA_STATUSES, [
      "active",
      "inactive",
    ]);
    assert.deepEqual(QUESTION_STATUSES, [
      "open",
      "resolved",
    ]);

    assert.equal(
      isSupportedUserRole("admin"),
      true
    );
    assert.equal(
      isSupportedUserRole("Admin"),
      false
    );
    assert.equal(
      isSupportedUserRole("moderator"),
      false
    );
    assert.equal(
      isSupportedQuestionStatus("resolved"),
      true
    );
    assert.equal(
      isSupportedQuestionStatus("Resolved"),
      false
    );
  }
);

test(
  "valid CCA input is trimmed and normalised for persistence",
  () => {
    const validation = validateCcaInput({
      cca_name: "  Robotics Club  ",
      category: "Technology",
      description: "  Build robots.  ",
      meeting_day:
        "  Monday & Friday  ",
      meeting_start_time: "18:00",
      meeting_end_time: "20:30:00",
      location: "  Lab E2  ",
      contact_email:
        "  ROBOTICS@EXAMPLE.COM  ",
      image_url:
        "  https://example.com/robot.png  ",
      status: " ACTIVE ",
    });

    assert.equal(validation.isValid, true);
    assert.deepEqual(validation.errors, {});
    assert.deepEqual(validation.value, {
      cca_name: "Robotics Club",
      category: "Technology",
      description: "Build robots.",
      meeting_day: "Monday & Friday",
      meeting_start_time: "18:00:00",
      meeting_end_time: "20:30:00",
      location: "Lab E2",
      contact_email:
        "robotics@example.com",
      image_url:
        "https://example.com/robot.png",
      status: "active",
    });
  }
);

test(
  "CCA validation rejects unsupported values, incomplete times, and unsafe URLs",
  () => {
    const validation = validateCcaInput({
      cca_name: "X",
      category: "Gaming",
      meeting_day: "Funday",
      meeting_start_time: "25:00",
      meeting_end_time: "",
      contact_email: "not-an-email",
      image_url: "javascript:alert(1)",
      status: "archived",
    });

    assert.equal(validation.isValid, false);
    assert.deepEqual(
      Object.keys(validation.errors).sort(),
      [
        "category",
        "cca_name",
        "contact_email",
        "image_url",
        "meeting_day",
        "meeting_end_time",
        "meeting_start_time",
        "status",
      ].sort()
    );
  }
);

test(
  "CCA validation requires the end time to be later than the start time",
  () => {
    for (const endTime of [
      "18:00",
      "17:59",
    ]) {
      const validation = validateCcaInput({
        cca_name: "Debate Club",
        category: "Arts",
        meeting_day: "Wednesday",
        meeting_start_time: "18:00",
        meeting_end_time: endTime,
        status: "inactive",
      });

      assert.equal(
        validation.isValid,
        false
      );
      assert.equal(
        validation.errors.meeting_end_time,
        "End time must be later than start time."
      );
    }
  }
);
