// Loaded blocking in <head> (the CSP allows no inline script): applies the saved theme before
// first paint, then wires the footer's System / Light / Dark switch. "System" stores nothing.
(function () {
  var KEY = "theme";
  var root = document.documentElement;
  var dark = matchMedia("(prefers-color-scheme: dark)");
  function read() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "light" || v === "dark" ? v : "system";
    } catch (e) {
      return "system";
    }
  }
  function apply(v) {
    if (v === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", v);
    var isDark = v === "dark" || (v === "system" && dark.matches);
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++)
      metas[i].setAttribute("content", isDark ? "#171717" : "#ffffff");
  }
  apply(read());
  dark.addEventListener("change", function () {
    if (read() === "system") apply("system");
  });

  document.addEventListener("DOMContentLoaded", function () {
    var group = document.querySelector("[data-theme-switch]");
    if (!group) return;
    var radios = Array.prototype.slice.call(
      group.querySelectorAll('[role="radio"]'),
    );
    function show(v) {
      radios.forEach(function (r) {
        var on = r.getAttribute("data-value") === v;
        r.setAttribute("aria-checked", on ? "true" : "false");
        r.tabIndex = on ? 0 : -1;
      });
    }
    function choose(v, focus) {
      try {
        if (v === "system") localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, v);
      } catch (e) {}
      apply(v);
      show(v);
      if (focus)
        radios
          .filter(function (r) {
            return r.tabIndex === 0;
          })[0]
          .focus();
    }
    group.addEventListener("click", function (e) {
      var r = e.target.closest('[role="radio"]');
      if (r) choose(r.getAttribute("data-value"), false);
    });
    group.addEventListener("keydown", function (e) {
      var i = radios.indexOf(document.activeElement);
      if (i < 0) return;
      var n = radios.length;
      var next =
        e.key === "ArrowRight" || e.key === "ArrowDown"
          ? (i + 1) % n
          : e.key === "ArrowLeft" || e.key === "ArrowUp"
            ? (i + n - 1) % n
            : e.key === "Home"
              ? 0
              : e.key === "End"
                ? n - 1
                : -1;
      if (next < 0) return;
      e.preventDefault();
      choose(radios[next].getAttribute("data-value"), true);
    });
    addEventListener("storage", function (e) {
      if (e.key === KEY) {
        apply(read());
        show(read());
      }
    });
    show(read());
    group.hidden = false;
  });
})();
