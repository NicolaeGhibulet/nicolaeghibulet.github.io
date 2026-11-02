(() => {
  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const storageKey = "portfolio-theme";
  const isItalian = root.lang === "it";
  let choice = null;
  let toggle = null;

  const validChoice = (value) => value === "dark" || value === "light" ? value : null;

  try {
    choice = validChoice(window.localStorage.getItem(storageKey));
  } catch (_) {
    // The theme switch also works when the browser disables local storage.
  }

  const applyTheme = () => {
    const theme = choice || (systemTheme.matches ? "dark" : "light");
    root.dataset.theme = theme;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0c1811" : "#f5f7f1");

    if (toggle) {
      const label = theme === "dark"
        ? (isItalian ? "Passa al tema chiaro" : "Switch to light theme")
        : (isItalian ? "Passa al tema scuro" : "Switch to dark theme");
      toggle.setAttribute("aria-label", label);
      toggle.setAttribute("title", label);
      toggle.setAttribute("aria-pressed", String(theme === "dark"));
    }

    // Paint real paths so SVG reference inheritance cannot turn leaves gray.
    document.querySelectorAll(".wind-leaf").forEach((leaf) => {
      const color = theme === "light"
        ? leaf.dataset.leafGreen
        : getComputedStyle(leaf).color;
      leaf.querySelectorAll("path").forEach((path) => {
        const outline = path.classList.contains("leaf-outline");
        const fill = outline ? color : "none";
        path.setAttribute("fill", fill);
        path.setAttribute("stroke", color);
        path.style.fill = fill;
        path.style.stroke = color;
        path.style.fillOpacity = outline ? "0.15" : "0";
        path.style.strokeOpacity = outline ? "0.45" : "0.4";
      });
    });
  };

  // This script runs before the stylesheet to select the first painted theme.
  applyTheme();

  const connectToggle = () => {
    toggle = document.querySelector(".theme-toggle");
    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener("click", () => {
        choice = root.dataset.theme === "dark" ? "light" : "dark";
        try {
          window.localStorage.setItem(storageKey, choice);
        } catch (_) {
          // Keep the explicit choice for the current page.
        }
        applyTheme();
      });
    }
    applyTheme();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", connectToggle, { once: true });
  } else {
    connectToggle();
  }

  const followSystem = () => {
    if (!choice) applyTheme();
  };
  if (systemTheme.addEventListener) systemTheme.addEventListener("change", followSystem);
  else systemTheme.addListener(followSystem);

  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    choice = event.key === null ? null : validChoice(event.newValue);
    applyTheme();
  });
})();
