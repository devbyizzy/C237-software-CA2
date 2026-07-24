const USER_ROLES = Object.freeze([
  "year1",
  "year2",
  "year3",
  "admin",
]);

const CCA_CATEGORIES = Object.freeze([
  "Technology",
  "Arts",
  "Sports",
  "Student Life",
]);

const CCA_STATUSES = Object.freeze([
  "active",
  "inactive",
]);

const QUESTION_STATUSES = Object.freeze([
  "open",
  "resolved",
]);

const WEEKDAYS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

const cleanText = (
  value,
  maximumLength = null
) => {
  const text =
    typeof value === "string"
      ? value.trim()
      : "";

  return maximumLength === null
    ? text
    : text.slice(0, maximumLength);
};

const isSupportedUserRole = (role) => {
  return USER_ROLES.includes(role);
};

const isSupportedQuestionStatus = (
  status
) => {
  return QUESTION_STATUSES.includes(status);
};

const normaliseTime = (value) => {
  const text = cleanText(value);
  const match = text.match(
    /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/
  );

  return match
    ? `${match[1]}:${match[2]}:00`
    : null;
};

const timeToMinutes = (time) => {
  const [hours, minutes] = time
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
};

const meetingDayIsValid = (value) => {
  if (!value) {
    return true;
  }

  const days = value
    .toLowerCase()
    .split(/\s*(?:&|,|\/|\band\b)\s*/)
    .filter(Boolean);

  return (
    days.length > 0 &&
    days.every((day) => WEEKDAYS.has(day))
  );
};

const contactEmailIsValid = (value) => {
  return (
    !value ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      value
    )
  );
};

const imageUrlIsValid = (value) => {
  if (!value) {
    return true;
  }

  try {
    const parsedUrl = new URL(value);

    return (
      parsedUrl.protocol === "http:" ||
      parsedUrl.protocol === "https:"
    );
  } catch (error) {
    return false;
  }
};

const validateCcaInput = (
  input = {}
) => {
  const value = {
    cca_name: cleanText(input.cca_name),
    category: cleanText(input.category),
    description: cleanText(
      input.description
    ),
    meeting_day: cleanText(
      input.meeting_day
    ),
    meeting_start_time: cleanText(
      input.meeting_start_time
    ),
    meeting_end_time: cleanText(
      input.meeting_end_time
    ),
    location: cleanText(input.location),
    contact_email: cleanText(
      input.contact_email
    ).toLowerCase(),
    image_url: cleanText(input.image_url),
    status: cleanText(
      input.status
    ).toLowerCase(),
  };

  const errors = {};

  if (value.cca_name.length < 2) {
    errors.cca_name =
      "CCA name must contain at least 2 characters.";
  } else if (value.cca_name.length > 150) {
    errors.cca_name =
      "CCA name must not exceed 150 characters.";
  }

  if (
    !CCA_CATEGORIES.includes(
      value.category
    )
  ) {
    errors.category =
      "Select a supported CCA category.";
  }

  if (
    value.description.length > 5000
  ) {
    errors.description =
      "Description must not exceed 5,000 characters.";
  }

  if (
    value.meeting_day.length > 30 ||
    !meetingDayIsValid(
      value.meeting_day
    )
  ) {
    errors.meeting_day =
      "Use weekday names, such as Monday or Monday & Friday.";
  }

  const hasStartTime = Boolean(
    value.meeting_start_time
  );
  const hasEndTime = Boolean(
    value.meeting_end_time
  );

  if (hasStartTime !== hasEndTime) {
    errors.meeting_end_time =
      "Provide both a start time and an end time.";
  }

  const startTime = hasStartTime
    ? normaliseTime(
        value.meeting_start_time
      )
    : null;
  const endTime = hasEndTime
    ? normaliseTime(
        value.meeting_end_time
      )
    : null;

  if (hasStartTime && !startTime) {
    errors.meeting_start_time =
      "Enter a valid 24-hour start time.";
  }

  if (hasEndTime && !endTime) {
    errors.meeting_end_time =
      "Enter a valid 24-hour end time.";
  }

  if (
    startTime &&
    endTime &&
    timeToMinutes(endTime) <=
      timeToMinutes(startTime)
  ) {
    errors.meeting_end_time =
      "End time must be later than start time.";
  }

  if (
    value.location.length > 150
  ) {
    errors.location =
      "Location must not exceed 150 characters.";
  }

  if (
    value.contact_email.length > 150 ||
    !contactEmailIsValid(
      value.contact_email
    )
  ) {
    errors.contact_email =
      "Enter a valid contact email address.";
  }

  if (
    value.image_url.length > 255 ||
    !imageUrlIsValid(value.image_url)
  ) {
    errors.image_url =
      "Image URL must start with http:// or https://.";
  }

  if (
    !CCA_STATUSES.includes(value.status)
  ) {
    errors.status =
      "Select a valid CCA status.";
  }

  return {
    isValid:
      Object.keys(errors).length === 0,
    errors,
    value: {
      ...value,
      meeting_start_time: startTime,
      meeting_end_time: endTime,
    },
  };
};

module.exports = {
  CCA_CATEGORIES,
  CCA_STATUSES,
  QUESTION_STATUSES,
  USER_ROLES,
  cleanText,
  isSupportedQuestionStatus,
  isSupportedUserRole,
  validateCcaInput,
};
