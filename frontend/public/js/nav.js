document.addEventListener("DOMContentLoaded", function () {
  initNavInteractivity();
});

function initNavInteractivity() {
  const hamburgerBtn =
    document.getElementById("hamburgerBtn");

  const sidebar =
    document.getElementById("sidebar");

  if (hamburgerBtn && sidebar) {
    hamburgerBtn.addEventListener(
      "click",
      function () {
        sidebar.classList.toggle("open");
      }
    );
  }

  document
    .querySelectorAll(".create-btn")
    .forEach(function (button) {
      button.addEventListener(
        "click",
        function () {
          alert(
            "Create post/question flow coming soon!"
          );
        }
      );
    });

  const profileMenuBtn =
    document.getElementById(
      "profileMenuBtn"
    );

  const profileMenu =
    document.getElementById(
      "profileMenu"
    );

  if (profileMenuBtn && profileMenu) {
    profileMenuBtn.addEventListener(
      "click",
      function (event) {
        event.stopPropagation();

        profileMenu.classList.toggle(
          "open"
        );
      }
    );

    profileMenu.addEventListener(
      "click",
      function (event) {
        event.stopPropagation();
      }
    );

    document.addEventListener(
      "click",
      function () {
        profileMenu.classList.remove(
          "open"
        );
      }
    );
  }

  document
    .querySelectorAll(".notif-btn")
    .forEach(function (button) {
      button.addEventListener(
        "click",
        function () {
          alert(
            "You have no new notifications."
          );
        }
      );
    });

  document
    .querySelectorAll(".sidebar-link-soon")
    .forEach(function (link) {
      link.addEventListener(
        "click",
        function (event) {
          event.preventDefault();

          const label = link.textContent
            .trim()
            .replace(/\s+/g, " ");

          alert(label + " coming soon!");
        }
      );
    });
}