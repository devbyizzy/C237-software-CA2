const crypto = require("crypto");
const express = require("express");

const adminService = require(
  "../../backend/services/adminService"
);

const {
  CCA_CATEGORIES,
  CCA_STATUSES,
  QUESTION_STATUSES,
  USER_ROLES,
} = adminService;

const router = express.Router();

const parsePositiveId = (value) => {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value)
  ) {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isSafeInteger(parsedValue)
    ? parsedValue
    : null;
};

const normaliseQueryText = (
  value,
  maximumLength
) => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .slice(0, maximumLength);
};

const getAdminCsrfToken = (req) => {
  if (!req.session.adminCsrfToken) {
    req.session.adminCsrfToken =
      crypto.randomBytes(32).toString("hex");
  }

  return req.session.adminCsrfToken;
};

const csrfTokenIsValid = (req) => {
  const body = req.body || {};
  const submittedToken =
    typeof body._csrf === "string"
      ? body._csrf
      : "";
  const expectedToken =
    req.session &&
    req.session.adminCsrfToken;

  if (
    !submittedToken ||
    !expectedToken
  ) {
    return false;
  }

  const submittedBuffer = Buffer.from(
    submittedToken,
    "utf8"
  );
  const expectedBuffer = Buffer.from(
    expectedToken,
    "utf8"
  );

  return (
    submittedBuffer.length ===
      expectedBuffer.length &&
    crypto.timingSafeEqual(
      submittedBuffer,
      expectedBuffer
    )
  );
};

const getAdminUserId = (req) => {
  const sessionUser =
    req.session && req.session.user;
  const userId = Number(
    sessionUser &&
      (sessionUser.userId ??
        sessionUser.user_id)
  );

  return Number.isSafeInteger(userId) &&
    userId > 0
    ? userId
    : null;
};

const adminPromotionIsConfirmed = (
  body = {}
) => {
  return (
    body.confirmAdminPromotion === "yes"
  );
};

const renderAdminError = (
  req,
  res,
  {
    statusCode,
    title,
    message,
    backHref = "/admin",
    activePage,
  }
) => {
  return res.status(statusCode).render(
    "admin/error",
    {
      user: req.session.user,
      csrfToken:
        getAdminCsrfToken(req),
      statusCode,
      title,
      message,
      backHref,
      activePage,
    }
  );
};

const serviceErrorDetails = (
  error,
  fallback
) => {
  const knownErrors = {
    ADMIN_FORBIDDEN: {
      statusCode: 403,
      title: "Access denied",
      message:
        "Administrator access is required.",
    },
    USER_NOT_FOUND: {
      statusCode: 404,
      title: "User not found",
      message:
        "The requested user account does not exist.",
    },
    GROUP_NOT_FOUND: {
      statusCode: 404,
      title: "RP Circle not found",
      message:
        "The requested RP Circle does not exist.",
    },
    CCA_NOT_FOUND: {
      statusCode: 404,
      title: "CCA not found",
      message:
        "The requested CCA does not exist.",
    },
    QUESTION_NOT_FOUND: {
      statusCode: 404,
      title: "Question not found",
      message:
        "The requested question does not exist.",
    },
    QUESTION_REPLY_NOT_FOUND: {
      statusCode: 404,
      title: "Reply not found",
      message:
        "The requested question reply does not exist.",
    },
    SELF_ACTION_NOT_ALLOWED: {
      statusCode: 409,
      title: "Action not allowed",
      message: error.message,
    },
    LAST_ACTIVE_ADMIN: {
      statusCode: 409,
      title: "Administrator required",
      message:
        "This action would remove the last active administrator. Keep at least one active admin account.",
    },
    INVALID_ROLE: {
      statusCode: 400,
      title: "Invalid role",
      message:
        "Select one of the supported RPConnect roles.",
    },
    ROLE_UNCHANGED: {
      statusCode: 409,
      title: "Role unchanged",
      message:
        "The selected user already has that role.",
    },
    ADMIN_PROMOTION_CONFIRMATION_REQUIRED:
      {
        statusCode: 400,
        title:
          "Promotion confirmation required",
        message:
          "Confirm that this account should receive full administrator access.",
      },
    ACCOUNT_STATUS_UNCHANGED: {
      statusCode: 409,
      title: "Status unchanged",
      message: error.message,
    },
    TWO_FACTOR_ALREADY_RESET: {
      statusCode: 409,
      title: "Setup already required",
      message:
        "This user is already required to configure two-factor authentication at their next login.",
    },
    CONFIRMATION_REQUIRED: {
      statusCode: 400,
      title: "Confirmation required",
      message:
        "Confirm this permanent action before continuing.",
    },
    INVALID_QUESTION_STATUS: {
      statusCode: 400,
      title: "Invalid status",
      message:
        "Select a supported question status.",
    },
    QUESTION_STATUS_UNCHANGED: {
      statusCode: 409,
      title: "Status unchanged",
      message:
        "The question already has that status.",
    },
    ACCOUNT_STATUS_MISSING: {
      statusCode: 503,
      title:
        "Account suspension unavailable",
      message:
        "Run the provided account-status migration before suspending or restoring accounts.",
    },
    QUESTION_TABLES_MISSING: {
      statusCode: 503,
      title:
        "Question moderation unavailable",
      message:
        "Run the provided question-moderation migration before using this action.",
    },
    ADMIN_LOGS_MISSING: {
      statusCode: 503,
      title:
        "Activity logging unavailable",
      message:
        "Run the provided admin_logs migration before performing logged admin actions.",
    },
    DEPENDENT_RECORDS: {
      statusCode: 409,
      title:
        "Dependent records remain",
      message:
        "This record still has related data that the database will not remove automatically.",
    },
  };

  return (
    knownErrors[error && error.code] ||
    fallback
  );
};

const renderServiceError = (
  req,
  res,
  error,
  {
    backHref,
    activePage,
    fallbackTitle,
    fallbackMessage,
  }
) => {
  const details = serviceErrorDetails(
    error,
    {
      statusCode: 500,
      title: fallbackTitle,
      message: fallbackMessage,
    }
  );

  return renderAdminError(req, res, {
    ...details,
    backHref,
    activePage,
  });
};

const validatePostContext = (
  req,
  res,
  {
    id,
    invalidTitle,
    invalidMessage,
    backHref,
    activePage,
  }
) => {
  if (!id) {
    renderAdminError(req, res, {
      statusCode: 400,
      title: invalidTitle,
      message: invalidMessage,
      backHref,
      activePage,
    });
    return null;
  }

  if (!csrfTokenIsValid(req)) {
    renderAdminError(req, res, {
      statusCode: 403,
      title: "Request expired",
      message:
        "This admin request could not be verified. Return to the previous page and try again.",
      backHref,
      activePage,
    });
    return null;
  }

  const adminUserId =
    getAdminUserId(req);

  if (!adminUserId) {
    renderAdminError(req, res, {
      statusCode: 403,
      title: "Access denied",
      message:
        "Administrator access is required.",
      backHref: "/admin",
      activePage,
    });
    return null;
  }

  return {
    adminUserId,
    id,
  };
};

const getNotice = (
  section,
  query
) => {
  const notices = {
    users: {
      deleted:
        "The user account and its dependent records were deleted.",
    },
    groups: {
      deleted:
        "The RP Circle and its dependent content were deleted.",
    },
    ccas: {
      created:
        "The CCA was created.",
      updated:
        "The CCA was updated.",
      status:
        "The CCA status was changed.",
      deleted:
        "The CCA was deleted.",
    },
    questions: {
      deleted:
        "The question and its replies were deleted.",
    },
  };
  const sectionNotices =
    notices[section] || {};
  const code =
    normaliseQueryText(
      query && query.notice,
      30
    );

  return sectionNotices[code]
    ? {
        type: "success",
        message: sectionNotices[code],
      }
    : null;
};

const getUserNotice = (query) => {
  if (query.reset === "success") {
    return {
      type: "success",
      message:
        "Two-factor authentication was reset. The user must set it up again at their next login.",
    };
  }

  if (
    query.suspension === "suspended"
  ) {
    return {
      type: "success",
      message:
        "The account was suspended and can no longer sign in.",
    };
  }

  if (
    query.suspension === "active"
  ) {
    return {
      type: "success",
      message:
        "The account was restored and can sign in again.",
    };
  }

  if (query.role === "changed") {
    return {
      type: "success",
      message:
        "The account role was updated.",
    };
  }

  return null;
};

const getCcaFormData = (
  body = {}
) => {
  return {
    cca_name:
      typeof body.cca_name === "string"
        ? body.cca_name
        : "",
    category:
      typeof body.category === "string"
        ? body.category
        : "",
    description:
      typeof body.description === "string"
        ? body.description
        : "",
    meeting_day:
      typeof body.meeting_day === "string"
        ? body.meeting_day
        : "",
    meeting_start_time:
      typeof body.meeting_start_time ===
      "string"
        ? body.meeting_start_time
        : "",
    meeting_end_time:
      typeof body.meeting_end_time ===
      "string"
        ? body.meeting_end_time
        : "",
    location:
      typeof body.location === "string"
        ? body.location
        : "",
    contact_email:
      typeof body.contact_email === "string"
        ? body.contact_email
        : "",
    image_url:
      typeof body.image_url === "string"
        ? body.image_url
        : "",
    status:
      typeof body.status === "string"
        ? body.status
        : "",
  };
};

router.get("/", async (req, res) => {
  try {
    const dashboardData =
      await adminService.getDashboardData();

    return res.render(
      "admin/dashboard",
      {
        user: req.session.user,
        csrfToken:
          getAdminCsrfToken(req),
        stats: dashboardData.stats,
        recentUsers:
          dashboardData.recentUsers,
      }
    );
  } catch (error) {
    console.error(
      "Admin dashboard error:",
      error
    );

    return renderAdminError(req, res, {
      statusCode: 500,
      title: "Dashboard unavailable",
      message:
        "The dashboard data could not be loaded. Please try again later.",
      activePage: "dashboard",
    });
  }
});

router.get("/users", async (req, res) => {
  const filters = {
    username: normaliseQueryText(
      req.query.username,
      30
    ),
    email: normaliseQueryText(
      req.query.email,
      150
    ),
    role: normaliseQueryText(
      req.query.role,
      20
    ),
    status: normaliseQueryText(
      req.query.status,
      20
    ),
  };

  try {
    const result =
      await adminService.getUsers(filters);

    return res.render("admin/users", {
      user: req.session.user,
      csrfToken:
        getAdminCsrfToken(req),
      users: result.users,
      filters,
      roles: result.roles,
      suspensionAvailable:
        result.suspensionAvailable,
      notice: getNotice(
        "users",
        req.query
      ),
    });
  } catch (error) {
    console.error(
      "Admin users error:",
      error
    );

    return renderAdminError(req, res, {
      statusCode: 500,
      title: "Users unavailable",
      message:
        "User accounts could not be loaded. Please try again later.",
      activePage: "users",
    });
  }
});

router.get(
  "/users/:id",
  async (req, res) => {
    const userId = parsePositiveId(
      req.params.id
    );

    if (!userId) {
      return renderAdminError(req, res, {
        statusCode: 400,
        title: "Invalid user",
        message:
          "A valid user account ID is required.",
        backHref: "/admin/users",
        activePage: "users",
      });
    }

    try {
      const targetUser =
        await adminService.getUserById(
          userId
        );

      if (!targetUser) {
        return renderAdminError(req, res, {
          statusCode: 404,
          title: "User not found",
          message:
            "The requested user account does not exist.",
          backHref: "/admin/users",
          activePage: "users",
        });
      }

      const impact =
        targetUser.deletionImpact || {};

      return res.render(
        "admin/user-details",
        {
          user: req.session.user,
          targetUser,
          csrfToken:
            getAdminCsrfToken(req),
          notice: getUserNotice(
            req.query
          ),
          allowedRoles: USER_ROLES,
          isSelf:
            getAdminUserId(req) ===
            userId,
          suspensionAvailable:
            targetUser
              .suspension_available ===
            true,
          deletionImpact: {
            ...impact,
            groupsCreated:
              impact.ownedGroups,
            questionCount:
              impact.questions,
          },
        }
      );
    } catch (error) {
      console.error(
        "Admin user details error:",
        error
      );

      return renderAdminError(req, res, {
        statusCode: 500,
        title: "User unavailable",
        message:
          "The user account could not be loaded. Please try again later.",
        backHref: "/admin/users",
        activePage: "users",
      });
    }
  }
);

const handleUserAction = async (
  req,
  res,
  {
    action,
    confirmationField,
    confirmationMessage,
    successQuery,
    failureTitle,
  }
) => {
  const targetUserId = parsePositiveId(
    req.params.id
  );
  const backHref = targetUserId
    ? `/admin/users/${targetUserId}`
    : "/admin/users";
  const context = validatePostContext(
    req,
    res,
    {
      id: targetUserId,
      invalidTitle: "Invalid user",
      invalidMessage:
        "A valid user account ID is required.",
      backHref,
      activePage: "users",
    }
  );

  if (!context) {
    return;
  }

  if (
    confirmationField &&
    req.body[confirmationField] !== "yes"
  ) {
    return renderAdminError(req, res, {
      statusCode: 400,
      title: "Confirmation required",
      message: confirmationMessage,
      backHref,
      activePage: "users",
    });
  }

  try {
    await action({
      adminUserId:
        context.adminUserId,
      targetUserId:
        context.id,
    });

    return res.redirect(
      successQuery.startsWith(
        "/admin/"
      )
        ? successQuery
        : `${backHref}?${successQuery}`
    );
  } catch (error) {
    console.error(
      `Admin user action error (${failureTitle}):`,
      error
    );

    return renderServiceError(
      req,
      res,
      error,
      {
        backHref,
        activePage: "users",
        fallbackTitle: failureTitle,
        fallbackMessage:
          "The account could not be updated. No changes were saved.",
      }
    );
  }
};

router.post(
  "/users/:id/reset-2fa",
  (req, res) => {
    return handleUserAction(req, res, {
      confirmationField:
        "confirmReset",
      confirmationMessage:
        "Confirm that the selected user's two-factor authentication should be reset.",
      successQuery: "reset=success",
      failureTitle:
        "2FA reset unsuccessful",
      action: (input) =>
        adminService.resetUserTwoFactor(
          input
        ),
    });
  }
);

router.post(
  "/users/:id/suspend",
  (req, res) => {
    return handleUserAction(req, res, {
      confirmationField:
        "confirmSuspend",
      confirmationMessage:
        "Confirm that this account should be suspended.",
      successQuery:
        "suspension=suspended",
      failureTitle:
        "Suspension unsuccessful",
      action: (input) =>
        adminService.setUserSuspension({
          ...input,
          suspended: true,
        }),
    });
  }
);

router.post(
  "/users/:id/unsuspend",
  (req, res) => {
    return handleUserAction(req, res, {
      confirmationField:
        "confirmUnsuspend",
      confirmationMessage:
        "Confirm that this account should be restored.",
      successQuery:
        "suspension=active",
      failureTitle:
        "Account restoration unsuccessful",
      action: (input) =>
        adminService.setUserSuspension({
          ...input,
          suspended: false,
        }),
    });
  }
);

router.post(
  "/users/:id/change-role",
  (req, res) => {
    return handleUserAction(req, res, {
      confirmationField:
        "confirmRoleChange",
      confirmationMessage:
        "Confirm that this account's role should be changed.",
      successQuery: "role=changed",
      failureTitle:
        "Role change unsuccessful",
      action: (input) =>
        adminService.changeUserRole({
          ...input,
          newRole:
            typeof req.body.role ===
            "string"
              ? req.body.role
              : "",
          confirmAdminPromotion:
            adminPromotionIsConfirmed(
              req.body
            ),
        }),
    });
  }
);

router.post(
  "/users/:id/delete",
  (req, res) => {
    return handleUserAction(req, res, {
      confirmationField:
        "confirmDelete",
      confirmationMessage:
        "Confirm that this user and dependent records should be permanently deleted.",
      successQuery:
        "/admin/users?notice=deleted",
      failureTitle:
        "User deletion unsuccessful",
      action: (input) =>
        adminService.deleteUser({
          ...input,
          confirmed: true,
        }),
    });
  }
);

router.get("/groups", async (req, res) => {
  const filters = {
    search: normaliseQueryText(
      req.query.search,
      150
    ),
  };

  try {
    const result =
      await adminService.getGroups(filters);

    return res.render("admin/groups", {
      user: req.session.user,
      groups: result.groups,
      filters,
      csrfToken:
        getAdminCsrfToken(req),
      notice: getNotice(
        "groups",
        req.query
      ),
    });
  } catch (error) {
    console.error(
      "Admin groups error:",
      error
    );

    return renderAdminError(req, res, {
      statusCode: 500,
      title:
        "RP Circles unavailable",
      message:
        "RP Circles could not be loaded. Please try again later.",
      backHref: "/admin",
      activePage: "groups",
    });
  }
});

router.get(
  "/groups/:id",
  async (req, res) => {
    const groupId = parsePositiveId(
      req.params.id
    );

    if (!groupId) {
      return renderAdminError(req, res, {
        statusCode: 400,
        title: "Invalid RP Circle",
        message:
          "A valid RP Circle ID is required.",
        backHref: "/admin/groups",
        activePage: "groups",
      });
    }

    try {
      const group =
        await adminService.getGroupById(
          groupId
        );

      if (!group) {
        return renderAdminError(req, res, {
          statusCode: 404,
          title:
            "RP Circle not found",
          message:
            "The requested RP Circle does not exist.",
          backHref: "/admin/groups",
          activePage: "groups",
        });
      }

      return res.render(
        "admin/group-details",
        {
          user: req.session.user,
          group,
          csrfToken:
            getAdminCsrfToken(req),
          notice: null,
        }
      );
    } catch (error) {
      console.error(
        "Admin group details error:",
        error
      );

      return renderAdminError(req, res, {
        statusCode: 500,
        title:
          "RP Circle unavailable",
        message:
          "The RP Circle could not be loaded. Please try again later.",
        backHref: "/admin/groups",
        activePage: "groups",
      });
    }
  }
);

router.post(
  "/groups/:id/delete",
  async (req, res) => {
    const groupId = parsePositiveId(
      req.params.id
    );
    const backHref = groupId
      ? `/admin/groups/${groupId}`
      : "/admin/groups";
    const context = validatePostContext(
      req,
      res,
      {
        id: groupId,
        invalidTitle:
          "Invalid RP Circle",
        invalidMessage:
          "A valid RP Circle ID is required.",
        backHref,
        activePage: "groups",
      }
    );

    if (!context) {
      return;
    }

    if (
      req.body.confirmDelete !== "yes"
    ) {
      return renderAdminError(req, res, {
        statusCode: 400,
        title: "Confirmation required",
        message:
          "Confirm that this RP Circle and its dependent content should be deleted.",
        backHref,
        activePage: "groups",
      });
    }

    try {
      await adminService.deleteGroup({
        adminUserId:
          context.adminUserId,
        groupId: context.id,
        confirmed: true,
      });

      return res.redirect(
        "/admin/groups?notice=deleted"
      );
    } catch (error) {
      console.error(
        "Admin group delete error:",
        error
      );

      return renderServiceError(
        req,
        res,
        error,
        {
          backHref,
          activePage: "groups",
          fallbackTitle:
            "RP Circle deletion unsuccessful",
          fallbackMessage:
            "The RP Circle could not be deleted. No changes were saved.",
        }
      );
    }
  }
);

router.get("/ccas", async (req, res) => {
  const filters = {
    search: normaliseQueryText(
      req.query.search,
      150
    ),
    status: normaliseQueryText(
      req.query.status,
      30
    ),
  };

  try {
    const result =
      await adminService.getCcas(filters);

    return res.render("admin/ccas", {
      user: req.session.user,
      ccas: result.ccas,
      filters,
      statuses: CCA_STATUSES,
      csrfToken:
        getAdminCsrfToken(req),
      notice: getNotice(
        "ccas",
        req.query
      ),
    });
  } catch (error) {
    console.error(
      "Admin CCAs error:",
      error
    );

    return renderAdminError(req, res, {
      statusCode: 500,
      title: "CCAs unavailable",
      message:
        "CCA records could not be loaded. Please try again later.",
      backHref: "/admin",
      activePage: "ccas",
    });
  }
});

router.get("/ccas/new", (req, res) => {
  return res.render(
    "admin/cca-form",
    {
      user: req.session.user,
      mode: "create",
      cca: null,
      formData: {
        status: "active",
      },
      fieldErrors: {},
      csrfToken:
        getAdminCsrfToken(req),
      categories: CCA_CATEGORIES,
      statuses: CCA_STATUSES,
      notice: null,
    }
  );
});

router.get("/ccas/add", (req, res) => {
  return res.redirect(
    "/admin/ccas/new"
  );
});

router.post("/ccas", async (req, res) => {
  if (!csrfTokenIsValid(req)) {
    return renderAdminError(req, res, {
      statusCode: 403,
      title: "Request expired",
      message:
        "This CCA request could not be verified. Return to the form and try again.",
      backHref: "/admin/ccas/new",
      activePage: "ccas",
    });
  }

  const adminUserId =
    getAdminUserId(req);

  if (!adminUserId) {
    return renderAdminError(req, res, {
      statusCode: 403,
      title: "Access denied",
      message:
        "Administrator access is required.",
      activePage: "ccas",
    });
  }

  const formData = getCcaFormData(
    req.body
  );

  try {
    const result =
      await adminService.createCca({
        adminUserId,
        cca: formData,
      });

    return res.redirect(
      `/admin/ccas/${result.ccaId}/edit?notice=created`
    );
  } catch (error) {
    console.error(
      "Admin create CCA error:",
      error
    );

    if (
      error.code ===
      "CCA_VALIDATION_FAILED"
    ) {
      return res.status(400).render(
        "admin/cca-form",
        {
          user: req.session.user,
          mode: "create",
          cca: null,
          formData,
          fieldErrors:
            error.details || {},
          csrfToken:
            getAdminCsrfToken(req),
          categories:
            CCA_CATEGORIES,
          statuses: CCA_STATUSES,
          notice: {
            type: "error",
            message:
              "Correct the highlighted fields and try again.",
          },
        }
      );
    }

    return renderServiceError(
      req,
      res,
      error,
      {
        backHref: "/admin/ccas/new",
        activePage: "ccas",
        fallbackTitle:
          "CCA creation unsuccessful",
        fallbackMessage:
          "The CCA could not be created. No changes were saved.",
      }
    );
  }
});

router.get(
  "/ccas/:id/edit",
  async (req, res) => {
    const ccaId = parsePositiveId(
      req.params.id
    );

    if (!ccaId) {
      return renderAdminError(req, res, {
        statusCode: 400,
        title: "Invalid CCA",
        message:
          "A valid CCA ID is required.",
        backHref: "/admin/ccas",
        activePage: "ccas",
      });
    }

    try {
      const cca =
        await adminService.getCcaById(
          ccaId
        );

      if (!cca) {
        return renderAdminError(req, res, {
          statusCode: 404,
          title: "CCA not found",
          message:
            "The requested CCA does not exist.",
          backHref: "/admin/ccas",
          activePage: "ccas",
        });
      }

      const notice =
        getNotice("ccas", req.query);

      return res.render(
        "admin/cca-form",
        {
          user: req.session.user,
          mode: "edit",
          cca,
          formData: {},
          fieldErrors: {},
          csrfToken:
            getAdminCsrfToken(req),
          categories:
            CCA_CATEGORIES,
          statuses: CCA_STATUSES,
          notice,
        }
      );
    } catch (error) {
      console.error(
        "Admin CCA edit page error:",
        error
      );

      return renderAdminError(req, res, {
        statusCode: 500,
        title: "CCA unavailable",
        message:
          "The CCA could not be loaded. Please try again later.",
        backHref: "/admin/ccas",
        activePage: "ccas",
      });
    }
  }
);

router.post(
  "/ccas/:id/edit",
  async (req, res) => {
    const ccaId = parsePositiveId(
      req.params.id
    );
    const backHref = ccaId
      ? `/admin/ccas/${ccaId}/edit`
      : "/admin/ccas";
    const context = validatePostContext(
      req,
      res,
      {
        id: ccaId,
        invalidTitle: "Invalid CCA",
        invalidMessage:
          "A valid CCA ID is required.",
        backHref,
        activePage: "ccas",
      }
    );

    if (!context) {
      return;
    }

    const formData = {
      ...getCcaFormData(req.body),
      cca_id: ccaId,
    };

    try {
      await adminService.updateCca({
        adminUserId:
          context.adminUserId,
        ccaId,
        cca: formData,
      });

      return res.redirect(
        `${backHref}?notice=updated`
      );
    } catch (error) {
      console.error(
        "Admin update CCA error:",
        error
      );

      if (
        error.code ===
        "CCA_VALIDATION_FAILED"
      ) {
        return res.status(400).render(
          "admin/cca-form",
          {
            user: req.session.user,
            mode: "edit",
            cca: {
              cca_id: ccaId,
            },
            formData,
            fieldErrors:
              error.details || {},
            csrfToken:
              getAdminCsrfToken(req),
            categories:
              CCA_CATEGORIES,
            statuses:
              CCA_STATUSES,
            notice: {
              type: "error",
              message:
                "Correct the highlighted fields and try again.",
            },
          }
        );
      }

      return renderServiceError(
        req,
        res,
        error,
        {
          backHref,
          activePage: "ccas",
          fallbackTitle:
            "CCA update unsuccessful",
          fallbackMessage:
            "The CCA could not be updated. No changes were saved.",
        }
      );
    }
  }
);

const handleCcaMutation = async (
  req,
  res,
  {
    confirmationField,
    action,
    successLocation,
    fallbackTitle,
  }
) => {
  const ccaId = parsePositiveId(
    req.params.id
  );
  const backHref = ccaId
    ? `/admin/ccas/${ccaId}/edit`
    : "/admin/ccas";
  const context = validatePostContext(
    req,
    res,
    {
      id: ccaId,
      invalidTitle: "Invalid CCA",
      invalidMessage:
        "A valid CCA ID is required.",
      backHref,
      activePage: "ccas",
    }
  );

  if (!context) {
    return;
  }

  if (
    req.body[confirmationField] !== "yes"
  ) {
    return renderAdminError(req, res, {
      statusCode: 400,
      title: "Confirmation required",
      message:
        "Confirm this CCA action before continuing.",
      backHref,
      activePage: "ccas",
    });
  }

  try {
    await action({
      adminUserId:
        context.adminUserId,
      ccaId,
    });

    return res.redirect(
      successLocation(ccaId)
    );
  } catch (error) {
    console.error(
      "Admin CCA mutation error:",
      error
    );

    return renderServiceError(
      req,
      res,
      error,
      {
        backHref,
        activePage: "ccas",
        fallbackTitle,
        fallbackMessage:
          "The CCA could not be changed. No changes were saved.",
      }
    );
  }
};

router.post(
  "/ccas/:id/toggle-status",
  (req, res) => {
    return handleCcaMutation(req, res, {
      confirmationField:
        "confirmStatusChange",
      action: (input) =>
        adminService.toggleCcaStatus(
          input
        ),
      successLocation: (ccaId) =>
        `/admin/ccas/${ccaId}/edit?notice=status`,
      fallbackTitle:
        "CCA status change unsuccessful",
    });
  }
);

router.post(
  "/ccas/:id/delete",
  (req, res) => {
    return handleCcaMutation(req, res, {
      confirmationField:
        "confirmDelete",
      action: (input) =>
        adminService.deleteCca({
          ...input,
          confirmed: true,
        }),
      successLocation: () =>
        "/admin/ccas?notice=deleted",
      fallbackTitle:
        "CCA deletion unsuccessful",
    });
  }
);

router.get(
  "/questions",
  async (req, res) => {
    const filters = {
      search: normaliseQueryText(
        req.query.search,
        200
      ),
      status: normaliseQueryText(
        req.query.status,
        20
      ),
    };

    try {
      const result =
        await adminService.getQuestions(
          filters
        );

      return res.render(
        "admin/questions",
        {
          user: req.session.user,
          questions:
            result.questions,
          filters,
          statuses:
            QUESTION_STATUSES,
          available:
            result.available,
          csrfToken:
            getAdminCsrfToken(req),
          notice: getNotice(
            "questions",
            req.query
          ),
        }
      );
    } catch (error) {
      console.error(
        "Admin questions error:",
        error
      );

      return renderServiceError(
        req,
        res,
        error,
        {
          backHref:
            "/admin/questions",
          activePage: "questions",
          fallbackTitle:
            "Questions unavailable",
          fallbackMessage:
            "Questions could not be loaded. Please try again later.",
        }
      );
    }
  }
);

router.get(
  "/questions/:id",
  async (req, res) => {
    const questionId = parsePositiveId(
      req.params.id
    );

    if (!questionId) {
      return renderAdminError(req, res, {
        statusCode: 400,
        title: "Invalid question",
        message:
          "A valid question ID is required.",
        backHref:
          "/admin/questions",
        activePage: "questions",
      });
    }

    try {
      const result =
        await adminService.getQuestionById(
          questionId
        );

      if (!result) {
        return renderAdminError(req, res, {
          statusCode: 404,
          title:
            "Question not found",
          message:
            "The requested question does not exist.",
          backHref:
            "/admin/questions",
          activePage: "questions",
        });
      }

      return res.render(
        "admin/question-details",
        {
          user: req.session.user,
          question:
            result.question,
          replies: result.replies,
          csrfToken:
            getAdminCsrfToken(req),
          statuses:
            QUESTION_STATUSES,
          notice:
            req.query.notice ===
            "status"
              ? {
                  type: "success",
                  message:
                    "The question status was updated.",
                }
              : req.query.notice ===
                  "reply-deleted"
                ? {
                    type: "success",
                    message:
                      "The reply was deleted.",
                  }
                : null,
        }
      );
    } catch (error) {
      console.error(
        "Admin question details error:",
        error
      );

      return renderServiceError(
        req,
        res,
        error,
        {
          backHref:
            "/admin/questions",
          activePage: "questions",
          fallbackTitle:
            "Question unavailable",
          fallbackMessage:
            "The question could not be loaded. Please try again later.",
        }
      );
    }
  }
);

const handleQuestionMutation = async (
  req,
  res,
  {
    confirmationField,
    action,
    successLocation,
    fallbackTitle,
  }
) => {
  const questionId = parsePositiveId(
    req.params.id
  );
  const backHref = questionId
    ? `/admin/questions/${questionId}`
    : "/admin/questions";
  const context = validatePostContext(
    req,
    res,
    {
      id: questionId,
      invalidTitle:
        "Invalid question",
      invalidMessage:
        "A valid question ID is required.",
      backHref,
      activePage: "questions",
    }
  );

  if (!context) {
    return;
  }

  if (
    req.body[confirmationField] !== "yes"
  ) {
    return renderAdminError(req, res, {
      statusCode: 400,
      title: "Confirmation required",
      message:
        "Confirm this moderation action before continuing.",
      backHref,
      activePage: "questions",
    });
  }

  try {
    const result = await action({
      adminUserId:
        context.adminUserId,
      questionId,
    });

    return res.redirect(
      successLocation(result)
    );
  } catch (error) {
    console.error(
      "Admin question mutation error:",
      error
    );

    return renderServiceError(
      req,
      res,
      error,
      {
        backHref,
        activePage: "questions",
        fallbackTitle,
        fallbackMessage:
          "The moderation action could not be completed. No changes were saved.",
      }
    );
  }
};

router.post(
  "/questions/:id/status",
  (req, res) => {
    return handleQuestionMutation(
      req,
      res,
      {
        confirmationField:
          "confirmStatusChange",
        action: (input) =>
          adminService.updateQuestionStatus(
            {
              ...input,
              status:
                typeof req.body
                  .status === "string"
                  ? req.body.status
                  : "",
            }
          ),
        successLocation: (result) =>
          `/admin/questions/${result.questionId}?notice=status`,
        fallbackTitle:
          "Status update unsuccessful",
      }
    );
  }
);

router.post(
  "/questions/:id/delete",
  (req, res) => {
    return handleQuestionMutation(
      req,
      res,
      {
        confirmationField:
          "confirmDelete",
        action: (input) =>
          adminService.deleteQuestion({
            ...input,
            confirmed: true,
          }),
        successLocation: () =>
          "/admin/questions?notice=deleted",
        fallbackTitle:
          "Question deletion unsuccessful",
      }
    );
  }
);

router.post(
  "/question-replies/:id/delete",
  async (req, res) => {
    const replyId = parsePositiveId(
      req.params.id
    );
    const fallbackQuestionId =
      parsePositiveId(
        String(
          (req.body &&
            req.body.questionId) ||
            ""
        )
      );
    const backHref =
      fallbackQuestionId
        ? `/admin/questions/${fallbackQuestionId}`
        : "/admin/questions";
    const context = validatePostContext(
      req,
      res,
      {
        id: replyId,
        invalidTitle:
          "Invalid reply",
        invalidMessage:
          "A valid reply ID is required.",
        backHref,
        activePage: "questions",
      }
    );

    if (!context) {
      return;
    }

    if (
      req.body.confirmDelete !== "yes"
    ) {
      return renderAdminError(req, res, {
        statusCode: 400,
        title: "Confirmation required",
        message:
          "Confirm that this reply should be deleted.",
        backHref,
        activePage: "questions",
      });
    }

    try {
      const result =
        await adminService.deleteQuestionReply(
          {
            adminUserId:
              context.adminUserId,
            replyId,
            confirmed: true,
          }
        );

      return res.redirect(
        `/admin/questions/${result.questionId}?notice=reply-deleted`
      );
    } catch (error) {
      console.error(
        "Admin reply delete error:",
        error
      );

      return renderServiceError(
        req,
        res,
        error,
        {
          backHref,
          activePage: "questions",
          fallbackTitle:
            "Reply deletion unsuccessful",
          fallbackMessage:
            "The reply could not be deleted. No changes were saved.",
        }
      );
    }
  }
);

router.get(
  "/activity",
  async (req, res) => {
    const filters = {
      admin: normaliseQueryText(
        req.query.admin,
        30
      ),
      action: normaliseQueryText(
        req.query.action,
        100
      ),
      targetType: normaliseQueryText(
        req.query.targetType,
        50
      ),
    };

    try {
      const result =
        await adminService.getActivity({
          adminUserId:
            filters.admin,
          action: filters.action,
          targetType:
            filters.targetType,
        });

      return res.render(
        "admin/activity",
        {
          user: req.session.user,
          logs: result.logs,
          filters,
          admins: result.admins,
          actions: result.actions,
          targetTypes:
            result.targetTypes,
          available:
            result.available,
          csrfToken:
            getAdminCsrfToken(req),
        }
      );
    } catch (error) {
      console.error(
        "Admin activity error:",
        error
      );

      return renderAdminError(req, res, {
        statusCode: 500,
        title:
          "Activity logs unavailable",
        message:
          "The admin activity log could not be loaded. Please try again later.",
        backHref: "/admin",
        activePage: "activity",
      });
    }
  }
);

module.exports = router;
module.exports.csrfTokenIsValid =
  csrfTokenIsValid;
module.exports.adminPromotionIsConfirmed =
  adminPromotionIsConfirmed;
module.exports.getAdminUserId =
  getAdminUserId;
module.exports.normaliseQueryText =
  normaliseQueryText;
module.exports.parsePositiveId =
  parsePositiveId;
