document.addEventListener("DOMContentLoaded", () => {
  const rpEmailPattern = /^[0-9]{8}@myrp\.edu\.sg$/;
  const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/;

  const forms = document.querySelectorAll("[data-auth-form]");

  const getErrorElement = (inputName) => {
    return document.querySelector(
      `[data-error-for="${inputName}"]`
    );
  };

  const showError = (input, message) => {
    const errorElement = getErrorElement(input.name);

    input.classList.remove("auth-input-valid");
    input.classList.add("auth-input-invalid");
    input.setAttribute("aria-invalid", "true");

    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add("auth-message-visible");
    }
  };

  const clearError = (input) => {
    const errorElement = getErrorElement(input.name);

    input.classList.remove("auth-input-invalid");
    input.removeAttribute("aria-invalid");

    if (errorElement) {
      errorElement.textContent = "";
      errorElement.classList.remove("auth-message-visible");
    }
  };

  const markValid = (input) => {
    clearError(input);

    if (input.value.trim()) {
      input.classList.add("auth-input-valid");
    } else {
      input.classList.remove("auth-input-valid");
    }
  };

  const validateName = (input) => {
    const name = input.value.trim();

    if (!name) {
      showError(input, "Please enter your full name.");
      return false;
    }

    if (name.length < 2) {
      showError(
        input,
        "Your name must contain at least 2 characters."
      );

      return false;
    }

    if (name.length > 100) {
      showError(
        input,
        "Your name must not exceed 100 characters."
      );

      return false;
    }

    markValid(input);
    return true;
  };

  const validateUsername = (input) => {
    const username = input.value.trim();

    if (!username) {
      showError(input, "Please enter a username.");
      return false;
    }

    if (!usernamePattern.test(username)) {
      showError(
        input,
        "Username must contain 3 to 20 letters, numbers or underscores."
      );

      return false;
    }

    input.value = username.toLowerCase();
    markValid(input);
    return true;
  };

  const validateEmail = (input) => {
    const email = input.value.trim().toLowerCase();

    if (!email) {
      showError(input, "Please enter your RP email address.");
      return false;
    }

    if (!rpEmailPattern.test(email)) {
      showError(
        input,
        "Use an RP email containing 8 digits followed by @myrp.edu.sg."
      );

      return false;
    }

    input.value = email;
    markValid(input);
    return true;
  };

  const validateLoginId = (input) => {
    const loginId = input.value.trim();

    if (!loginId) {
      showError(
        input,
        "Please enter your username or RP email."
      );

      return false;
    }

    const isEmail = loginId.includes("@");

    if (isEmail) {
      const normalisedEmail = loginId.toLowerCase();

      if (!rpEmailPattern.test(normalisedEmail)) {
        showError(
          input,
          "Enter a valid RP email or your username."
        );

        return false;
      }

      input.value = normalisedEmail;
      markValid(input);
      return true;
    }

    if (!usernamePattern.test(loginId)) {
      showError(
        input,
        "Enter a valid username or RP email."
      );

      return false;
    }

    input.value = loginId.toLowerCase();
    markValid(input);
    return true;
  };

  const passwordRules = {
    length: (password) => password.length >= 8,
    uppercase: (password) => /[A-Z]/.test(password),
    lowercase: (password) => /[a-z]/.test(password),
    number: (password) => /[0-9]/.test(password),
  };

  const updatePasswordRequirements = (password) => {
    Object.entries(passwordRules).forEach(
      ([ruleName, validator]) => {
        const ruleElement = document.querySelector(
          `[data-password-rule="${ruleName}"]`
        );

        if (!ruleElement) {
          return;
        }

        const indicator = ruleElement.querySelector("span");
        const isValid = validator(password);

        ruleElement.classList.toggle(
          "auth-requirement-valid",
          isValid
        );

        if (indicator) {
          indicator.textContent = isValid ? "✓" : "○";
        }
      }
    );
  };

  const isStrongPassword = (password) => {
    return Object.values(passwordRules).every(
      (validator) => validator(password)
    );
  };

  const validatePassword = (input, isRegistration) => {
    const password = input.value;

    if (!password) {
      showError(input, "Please enter your password.");
      return false;
    }

    if (isRegistration && !isStrongPassword(password)) {
      showError(
        input,
        "Your password must meet all the listed requirements."
      );

      return false;
    }

    markValid(input);
    return true;
  };

  const validateConfirmPassword = (
    confirmPasswordInput,
    passwordInput
  ) => {
    if (!confirmPasswordInput.value) {
      showError(
        confirmPasswordInput,
        "Please confirm your password."
      );

      return false;
    }

    if (
      confirmPasswordInput.value !==
      passwordInput.value
    ) {
      showError(
        confirmPasswordInput,
        "The passwords do not match."
      );

      return false;
    }

    markValid(confirmPasswordInput);
    return true;
  };

  const validateAgreement = (checkbox) => {
    const errorElement = getErrorElement("agreement");

    if (!checkbox.checked) {
      if (errorElement) {
        errorElement.textContent =
          "You must agree to the community guidelines.";

        errorElement.classList.add(
          "auth-message-visible"
        );
      }

      return false;
    }

    if (errorElement) {
      errorElement.textContent = "";
      errorElement.classList.remove(
        "auth-message-visible"
      );
    }

    return true;
  };

  document
    .querySelectorAll("[data-password-toggle]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const inputId = button.dataset.passwordToggle;
        const passwordInput =
          document.getElementById(inputId);

        if (!passwordInput) {
          return;
        }

        const passwordIsVisible =
          passwordInput.type === "text";

        passwordInput.type = passwordIsVisible
          ? "password"
          : "text";

        button.classList.toggle(
          "auth-password-visible",
          !passwordIsVisible
        );

        button.setAttribute(
          "aria-pressed",
          String(!passwordIsVisible)
        );

        button.setAttribute(
          "aria-label",
          passwordIsVisible
            ? "Show password"
            : "Hide password"
        );
      });
    });

  forms.forEach((form) => {
    const formType = form.dataset.authForm;
    const isRegistration = formType === "register";

    const nameInput =
      form.querySelector('input[name="name"]');

    const usernameInput =
      form.querySelector('input[name="username"]');

    const emailInput =
      form.querySelector('input[name="email"]');

    const loginIdInput =
      form.querySelector('input[name="loginId"]');

    const passwordInput =
      form.querySelector('input[name="password"]');

    const confirmPasswordInput =
      form.querySelector(
        'input[name="confirmPassword"]'
      );

    const agreementInput =
      form.querySelector('input[name="agreement"]');

    if (nameInput) {
      nameInput.addEventListener("blur", () => {
        validateName(nameInput);
      });

      nameInput.addEventListener("input", () => {
        nameInput.classList.remove(
          "auth-input-valid"
        );

        if (
          nameInput.classList.contains(
            "auth-input-invalid"
          )
        ) {
          validateName(nameInput);
        }
      });
    }

    if (usernameInput) {
      usernameInput.addEventListener("blur", () => {
        validateUsername(usernameInput);
      });

      usernameInput.addEventListener("input", () => {
        usernameInput.classList.remove(
          "auth-input-valid"
        );

        if (
          usernameInput.classList.contains(
            "auth-input-invalid"
          )
        ) {
          validateUsername(usernameInput);
        }
      });
    }

    if (emailInput) {
      emailInput.addEventListener("blur", () => {
        validateEmail(emailInput);
      });

      emailInput.addEventListener("input", () => {
        emailInput.classList.remove(
          "auth-input-valid"
        );

        if (
          emailInput.classList.contains(
            "auth-input-invalid"
          )
        ) {
          validateEmail(emailInput);
        }
      });
    }

    if (loginIdInput) {
      loginIdInput.addEventListener("blur", () => {
        validateLoginId(loginIdInput);
      });

      loginIdInput.addEventListener("input", () => {
        loginIdInput.classList.remove(
          "auth-input-valid"
        );

        if (
          loginIdInput.classList.contains(
            "auth-input-invalid"
          )
        ) {
          validateLoginId(loginIdInput);
        }
      });
    }

    if (passwordInput) {
      passwordInput.addEventListener("input", () => {
        if (isRegistration) {
          updatePasswordRequirements(
            passwordInput.value
          );
        }

        passwordInput.classList.remove(
          "auth-input-valid"
        );

        if (
          passwordInput.classList.contains(
            "auth-input-invalid"
          )
        ) {
          validatePassword(
            passwordInput,
            isRegistration
          );
        }

        if (
          confirmPasswordInput &&
          confirmPasswordInput.value
        ) {
          validateConfirmPassword(
            confirmPasswordInput,
            passwordInput
          );
        }
      });

      passwordInput.addEventListener("blur", () => {
        validatePassword(
          passwordInput,
          isRegistration
        );
      });
    }

    if (confirmPasswordInput && passwordInput) {
      confirmPasswordInput.addEventListener(
        "input",
        () => {
          confirmPasswordInput.classList.remove(
            "auth-input-valid"
          );

          if (
            confirmPasswordInput.classList.contains(
              "auth-input-invalid"
            )
          ) {
            validateConfirmPassword(
              confirmPasswordInput,
              passwordInput
            );
          }
        }
      );

      confirmPasswordInput.addEventListener(
        "blur",
        () => {
          validateConfirmPassword(
            confirmPasswordInput,
            passwordInput
          );
        }
      );
    }

    if (agreementInput) {
      agreementInput.addEventListener(
        "change",
        () => {
          validateAgreement(agreementInput);
        }
      );
    }

    form.addEventListener("submit", (event) => {
      let formIsValid = true;

      if (nameInput) {
        formIsValid =
          validateName(nameInput) &&
          formIsValid;
      }

      if (usernameInput) {
        formIsValid =
          validateUsername(usernameInput) &&
          formIsValid;
      }

      if (emailInput) {
        formIsValid =
          validateEmail(emailInput) &&
          formIsValid;
      }

      if (loginIdInput) {
        formIsValid =
          validateLoginId(loginIdInput) &&
          formIsValid;
      }

      if (passwordInput) {
        formIsValid =
          validatePassword(
            passwordInput,
            isRegistration
          ) && formIsValid;
      }

      if (
        confirmPasswordInput &&
        passwordInput
      ) {
        formIsValid =
          validateConfirmPassword(
            confirmPasswordInput,
            passwordInput
          ) && formIsValid;
      }

      if (agreementInput) {
        formIsValid =
          validateAgreement(agreementInput) &&
          formIsValid;
      }

      if (!formIsValid) {
        event.preventDefault();

        const firstInvalidField =
          form.querySelector(
            ".auth-input-invalid"
          );

        if (firstInvalidField) {
          firstInvalidField.focus();
        }
      }
    });
  });
});