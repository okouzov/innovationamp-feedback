/* Светла / тъмна тема. Зарежда се в <head>, за да няма примигване.
   По подразбиране е тъмна; изборът се помни в браузъра. */
(function () {
  var KEY = "innovationamp_theme";
  var DEFAULT = "dark";
  var theme;
  try { theme = localStorage.getItem(KEY); } catch (e) { /* без достъп до хранилището */ }
  if (theme !== "dark" && theme !== "light") theme = DEFAULT;

  function apply() {
    document.documentElement.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#080c20" : "#f3f4fb");
    var btn = document.getElementById("themeBtn");
    if (!btn) return;
    var toDark = theme === "light";
    btn.querySelector("span").textContent = toDark ? "Тъмен екран" : "Светъл екран";
    btn.setAttribute("aria-label", toDark ? "Превключи на тъмен екран" : "Превключи на светъл екран");
  }

  apply();
  document.addEventListener("DOMContentLoaded", function () {
    apply();
    var btn = document.getElementById("themeBtn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      theme = theme === "light" ? "dark" : "light";
      try { localStorage.setItem(KEY, theme); } catch (e) { /* изборът важи само за тази страница */ }
      apply();
    });
  });
})();
