(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const motionToggle = document.querySelector(".motion-toggle");
  if (motionToggle && !reducedMotion) {
    const isItalian = document.documentElement.lang === "it";
    motionToggle.hidden = false;
    motionToggle.addEventListener("click", () => {
      const paused = document.body.classList.toggle("background-is-paused");
      motionToggle.setAttribute("aria-pressed", String(paused));
      motionToggle.querySelector("span").textContent = paused
        ? (isItalian ? "Riprendi lo sfondo" : "Resume background")
        : (isItalian ? "Pausa lo sfondo" : "Pause background");
    });
  }

  if ("IntersectionObserver" in window && !reducedMotion) {
    document.documentElement.classList.add("has-scroll-reveal");

    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0,
      rootMargin: "0px 0px -24px 0px"
    });

    document.querySelectorAll("[data-reveal]").forEach((element) => {
      observer.observe(element);
    });
  }

  const header = document.querySelector(".site-header");
  if (header) {
    const updateHeaderHeight = () => {
      document.documentElement.style.setProperty("--header-height", `${header.getBoundingClientRect().height}px`);
    };
    updateHeaderHeight();
    if ("ResizeObserver" in window) new ResizeObserver(updateHeaderHeight).observe(header);
    else window.addEventListener("resize", updateHeaderHeight, { passive: true });
  }
})();
