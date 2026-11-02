(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      threshold: 0.12,
      rootMargin: "0px 0px -32px 0px"
    });

    document.querySelectorAll("[data-reveal]").forEach((element) => {
      observer.observe(element);
    });
  }

  const map = document.getElementById("trail-map");
  if (!map) return;

  const backdrop = document.querySelector(".trail-map-backdrop");
  const header = document.querySelector(".site-header");
  const footer = document.querySelector(".site-footer");
  const guide = document.getElementById("trail-guide");
  const progress = document.getElementById("trail-progress");
  const progressGlow = document.getElementById("trail-progress-glow");
  const revealRect = document.getElementById("trail-reveal-rect");
  const liveMarker = document.getElementById("trail-live-marker");
  const stopsLayer = document.getElementById("trail-stops");
  const signOverlay = document.getElementById("trail-sign-overlay");
  const signsLayer = document.getElementById("trail-signs");
  const sceneryLayer = document.getElementById("map-scenery");
  const mapHeightLayers = [
    document.getElementById("map-paper"),
    document.getElementById("map-contours")
  ];
  const svgNamespace = "http://www.w3.org/2000/svg";
  const isItalian = document.documentElement.lang === "it";
  const stopSpecs = [
    { id: "top", label: isItalian ? "INIZIO" : "START", offset: 32 },
    { id: "work", label: isItalian ? "RICERCA" : "RESEARCH", offset: 8 },
    { id: "interests", label: isItalian ? "INTERESSI" : "INTERESTS", offset: 44 },
    { id: "about", label: "ABOUT", offset: 44 },
    { id: "contact", label: isItalian ? "CONTATTI" : "CONTACT", offset: 44 }
  ];
  let routeLength = 0;
  let routeStops = [];
  let signBoards = [];
  let frame = null;

  const readableSelector = "p,h1,h2,h3,h4,h5,h6,a,button,input,select,textarea,label,li,dt,dd,td,th,figcaption,.site-header,.about-callout,.portrait-caption,.tag,.project-status,.project-index,.project-fact,.next-step,.interest-number";
  const mediaSelector = "img,picture,video,canvas,.portrait-frame,svg[role='img']";

  const updateMarkerAppearance = (x, y) => {
    const radius = window.innerWidth <= 480 ? 9 : 11;
    const samples = [[0, 0], [-radius, 0], [radius, 0], [0, -radius], [0, radius]];
    let overContent = false;
    let overMedia = false;
    samples.forEach(([offsetX, offsetY]) => {
      const element = document.elementFromPoint(x + offsetX, y + offsetY);
      if (!element) return;
      overMedia ||= Boolean(element.closest(mediaSelector));
      overContent ||= Boolean(element.closest(readableSelector));
    });
    const overSign = signBoards.some((board) => {
      const rect = board.getBoundingClientRect();
      return x + radius >= rect.left && x - radius <= rect.right &&
        y + radius >= rect.top && y - radius <= rect.bottom;
    });
    liveMarker.classList.toggle("is-over-content", overContent || overMedia || overSign);
    liveMarker.classList.toggle("is-over-media", overMedia);
  };

  const createSvgNode = (name, attributes = {}) => {
    const node = document.createElementNS(svgNamespace, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };

  const getStopY = (id, offset) => {
    const section = document.getElementById(id);
    if (!section) return 0;
    return section.getBoundingClientRect().top + window.scrollY + offset;
  };

  const getStopX = (index) => {
    return [910, 90, 910, 90, 910][index];
  };

  const makeRoute = (points) => {
    const wiggles = window.innerWidth <= 760
      ? [
          [790, 510, 640, 240],
          [170, 410, 320, 700],
          [820, 570, 690, 260],
          [160, 430, 340, 730]
        ]
      : [
          [800, 520, 650, 230],
          [170, 410, 320, 720],
          [830, 580, 690, 250],
          [160, 430, 340, 750]
        ];
    const nodes = points.flatMap((point, index) => {
      if (index === points.length - 1) return [point];
      const next = points[index + 1];
      const distance = next.y - point.y;
      const bends = wiggles[index] || [910, 982, 925, 990];
      return [
        point,
        ...bends.map((x, bendIndex) => ({
          x,
          y: point.y + distance * (0.18 + bendIndex * 0.21)
        }))
      ];
    });

    return nodes.slice(0, -1).reduce((path, point, index) => {
      const previous = nodes[Math.max(0, index - 1)];
      const next = nodes[index + 1];
      const after = nodes[Math.min(nodes.length - 1, index + 2)];
      const firstControlX = point.x + (next.x - previous.x) / 6;
      const firstControlY = point.y + (next.y - previous.y) / 6;
      const secondControlX = next.x - (after.x - point.x) / 6;
      const secondControlY = next.y - (after.y - point.y) / 6;
      const segment = `C ${firstControlX} ${firstControlY}, ${secondControlX} ${secondControlY}, ${next.x} ${next.y}`;
      return index === 0 ? `M ${point.x} ${point.y} ${segment}` : `${path} ${segment}`;
    }, "");
  };

  const addTreeCluster = (x, y, scale = 1) => {
    const group = createSvgNode("g", {
      class: "map-tree-cluster",
      transform: `translate(${x} ${y}) scale(${scale})`
    });
    const trees = [
      { x: -36, y: 2, width: 28, height: 38 },
      { x: -10, y: -12, width: 34, height: 46 },
      { x: 20, y: 2, width: 27, height: 37 }
    ];
    trees.forEach((tree) => {
      group.append(createSvgNode("use", {
        href: "#map-pine",
        x: tree.x,
        y: tree.y,
        width: tree.width,
        height: tree.height
      }));
    });
    sceneryLayer.append(group);
  };

  const addForestPatch = (x, y, rx, ry) => {
    sceneryLayer.append(createSvgNode("ellipse", {
      class: "map-forest-patch",
      cx: x,
      cy: y,
      rx,
      ry
    }));
  };

  const addLake = (x, y, scale = 1) => {
    const group = createSvgNode("g", { transform: `translate(${x} ${y}) scale(${scale})` });
    group.append(createSvgNode("path", {
      class: "map-lake",
      d: "M-92 2C-75-25-42-29-16-21 8-14 31-31 57-20 83-9 103 12 86 30 68 48 36 38 15 44-12 51-42 37-65 34-93 30-109 19-92 2Z"
    }));
    group.append(createSvgNode("path", {
      class: "map-lake-line",
      d: "M-60 3C-35-6-14 10 7 5s39-8 63 1M-42 20c19-6 37 6 57 1"
    }));
    sceneryLayer.append(group);
  };

  const addHut = (x, y, scale = 1) => {
    sceneryLayer.append(createSvgNode("use", {
      class: "map-hut-icon",
      href: "#map-hut",
      x: x - 33 * scale,
      y: y - 27 * scale,
      width: 66 * scale,
      height: 54 * scale
    }));
  };

  const addPeak = (x, y, scale = 1) => {
    sceneryLayer.append(createSvgNode("use", {
      class: "map-peak-icon",
      href: "#map-peak",
      x: x - 48 * scale,
      y: y - 38 * scale,
      width: 96 * scale,
      height: 76 * scale
    }));
  };

  const addSignpost = (x, y, scale = 1) => {
    sceneryLayer.append(createSvgNode("use", {
      class: "map-signpost-icon",
      href: "#map-signpost",
      x: x - 44 * scale,
      y: y - 44 * scale,
      width: 88 * scale,
      height: 88 * scale
    }));
  };

  const addStop = (stop, index) => {
    const pixelScaleX = 1000 / signOverlay.getBoundingClientRect().width;
    const group = createSvgNode("g", {
      class: "trail-stop",
      transform: `translate(${stop.x} ${stop.y}) scale(${pixelScaleX} 1)`
    });
    group.append(createSvgNode("circle", { class: "trail-stop-ring", r: 12 }));
    const number = createSvgNode("text", {
      class: "trail-stop-number",
      x: 0,
      y: 3,
      "text-anchor": "middle"
    });
    number.textContent = String(index + 1);
    group.append(number);
    stopsLayer.append(group);

    const boardWidth = Math.max(92, stop.label.length * 9 + 20);
    const boardY = ["interests", "contact"].includes(stop.id) ? -40 : -15;
    const signOnRight = stop.x < 500;
    const signX = signOnRight ? 990 : 10;
    const boardX = signOnRight ? -boardWidth : 0;
    const postX = signOnRight ? -8 : 8;
    const sign = createSvgNode("g", {
      class: "trail-waypoint-sign",
      transform: `translate(${signX} ${stop.y}) scale(${pixelScaleX} 1)`
    });
    sign.append(createSvgNode("path", {
      class: "trail-stop-post",
      d: `M ${postX} ${boardY + 22} L ${postX} ${boardY + 48}`
    }));
    sign.append(createSvgNode("rect", {
      class: "trail-stop-board",
      x: boardX,
      y: boardY,
      width: boardWidth,
      height: 22,
      rx: 4
    }));
    const label = createSvgNode("text", {
      class: "trail-stop-label",
      x: boardX + boardWidth / 2,
      y: boardY + 11,
      "text-anchor": "middle"
    });
    label.textContent = stop.label;
    sign.append(label);
    signsLayer.append(sign);
  };

  const renderScenery = (height, points) => {
    sceneryLayer.replaceChildren();

    let row = 0;
    for (let y = 210; y < height - 80; y += 360) {
      const leftX = row % 2 === 0 ? 72 : 118;
      const rightX = row % 2 === 0 ? 928 : 882;
      addForestPatch(leftX, y + 28, 78, 60);
      addForestPatch(rightX, y + 92, 82, 64);
      addTreeCluster(leftX, y + 12, row % 3 === 0 ? 0.78 : 0.68);
      addTreeCluster(rightX, y + 78, row % 2 === 0 ? 0.74 : 0.64);
      row += 1;
    }

    if (points.length >= 5) {
      const midpoints = points.slice(0, -1).map((point, index) => ({
        x: (point.x + points[index + 1].x) / 2,
        y: (point.y + points[index + 1].y) / 2
      }));
      addPeak(735, midpoints[0].y - 100, 0.62);
      addHut(255, midpoints[0].y + 36, 0.68);
      addLake(590, midpoints[0].y + 180, 0.36);
      addSignpost(910, midpoints[0].y + 330, 0.62);
      addLake(245, midpoints[1].y - 180, 0.34);
      addPeak(745, midpoints[1].y - 30, 0.64);
      addHut(485, midpoints[1].y + 130, 0.66);
      addSignpost(100, midpoints[1].y + 320, 0.58);
      addHut(765, midpoints[2].y - 150, 0.64);
      addPeak(250, midpoints[2].y + 10, 0.62);
      addLake(545, midpoints[2].y + 200, 0.35);
      addSignpost(900, midpoints[2].y + 360, 0.6);
      addLake(285, midpoints[3].y - 160, 0.34);
      addSignpost(735, midpoints[3].y + 25, 0.6);
      addPeak(465, midpoints[3].y + 180, 0.64);
      addHut(930, midpoints[3].y + 330, 0.66);
    }
  };

  const updateProgress = () => {
    frame = null;
    if (!routeLength || routeStops.length < 2) return;

    const startY = routeStops[0].y;
    const endY = routeStops[routeStops.length - 1].y;
    const focusY = window.scrollY + window.innerHeight * 0.3;
    const fraction = Math.max(0, Math.min(1, (focusY - startY) / Math.max(1, endY - startY)));
    map.classList.toggle("is-contact", fraction >= 0.78);

    if (reducedMotion) {
      revealRect.setAttribute("height", map.viewBox.baseVal.height);
    }

    const targetY = Math.max(startY, Math.min(endY, focusY));
    let low = 0;
    let high = routeLength;
    for (let step = 0; step < 18; step += 1) {
      const middle = (low + high) / 2;
      if (guide.getPointAtLength(middle).y < targetY) low = middle;
      else high = middle;
    }
    const drawnLength = (low + high) / 2;
    const position = guide.getPointAtLength(drawnLength);
    if (!reducedMotion) revealRect.setAttribute("height", position.y);
    const mapRect = map.getBoundingClientRect();
    const markerX = mapRect.left + (position.x / 1000) * mapRect.width;
    const markerY = mapRect.top + (position.y / map.viewBox.baseVal.height) * mapRect.height;
    updateMarkerAppearance(markerX, markerY);
    liveMarker.style.left = `${markerX}px`;
    liveMarker.style.top = `${markerY}px`;
    liveMarker.classList.add("is-visible");
  };

  const scheduleProgress = () => {
    if (frame === null) frame = window.requestAnimationFrame(updateProgress);
  };

  const layoutMap = () => {
    document.documentElement.style.setProperty("--header-height", `${header.getBoundingClientRect().height}px`);
    const height = Math.ceil(Math.max(footer.getBoundingClientRect().bottom + window.scrollY, window.innerHeight));
    map.setAttribute("viewBox", `0 0 1000 ${height}`);
    map.style.height = `${height}px`;
    backdrop.style.height = `${height}px`;
    signOverlay.setAttribute("viewBox", `0 0 1000 ${height}`);
    signOverlay.style.height = `${height}px`;
    mapHeightLayers.forEach((layer) => layer.setAttribute("height", height));

    routeStops = stopSpecs.map((stop, index) => ({
      ...stop,
      x: getStopX(index),
      y: getStopY(stop.id, stop.offset)
    }));
    const route = makeRoute(routeStops);
    [guide, progress, progressGlow].forEach((path) => path.setAttribute("d", route));

    stopsLayer.replaceChildren();
    signsLayer.replaceChildren();
    routeStops.forEach(addStop);
    signBoards = Array.from(signsLayer.querySelectorAll(".trail-stop-board"));
    renderScenery(height, routeStops);
    routeLength = guide.getTotalLength();
    scheduleProgress();
  };

  let layoutFrame = null;
  const scheduleLayout = () => {
    if (layoutFrame !== null) return;
    layoutFrame = window.requestAnimationFrame(() => {
      layoutFrame = null;
      layoutMap();
    });
  };

  window.addEventListener("scroll", scheduleProgress, { passive: true });
  window.addEventListener("resize", scheduleLayout, { passive: true });
  window.addEventListener("load", scheduleLayout, { once: true });
  if ("ResizeObserver" in window) {
    const layoutObserver = new ResizeObserver(scheduleLayout);
    [header, document.querySelector("main"), footer].forEach((element) => layoutObserver.observe(element));
  }
  layoutMap();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleLayout);
})();
