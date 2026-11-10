// Apply the theme before CSS loads to avoid a light flash on launch.
(() => {
  const key = "bp-tracker-theme";
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = null;
  try { preference = localStorage.getItem(key); } catch { /* Storage may be disabled. */ }
  if (preference !== "light" && preference !== "dark") preference = null;

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#101C16" : "#EAF4EC";
    const button = document.getElementById("themeToggle");
    if (button) {
      const dark = theme === "dark";
      button.setAttribute("aria-pressed", String(dark));
      button.textContent = dark ? "☀ Light mode" : "☾ Dark mode";
    }
  }

  applyTheme(preference || (system.matches ? "dark" : "light"));
  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(document.documentElement.dataset.theme);
    document.getElementById("themeToggle").addEventListener("click", () => {
      preference = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem(key, preference); } catch { /* Still works for this session. */ }
      applyTheme(preference);
    });
  });
  system.addEventListener("change", event => {
    if (!preference) applyTheme(event.matches ? "dark" : "light");
  });
})();
