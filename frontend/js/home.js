(function () {
  const form = document.getElementById("natalForm");
  const chartContainer = document.getElementById("chartContainer");
  const statusEl = document.getElementById("status");
  const generateBtn = document.getElementById("generateBtn");
  const summaryEl = document.getElementById("summaryContent");
  const modeInputs = Array.from(document.querySelectorAll('input[name="mode"]'));
  const nameRow = document.getElementById("nameRow");
  const birthSection = document.getElementById("birthSection");
  const transitSection = document.getElementById("transitSection");
  const transitDateInput = document.getElementById("transitDateInput");
  const transitTimeInput = document.getElementById("transitTimeInput");
  const configPanel = document.getElementById("configPanel");
  const configToggle = document.getElementById("configToggle");
  const configClose = document.getElementById("configClose");
  const downloadBtn = document.getElementById("downloadPdfBtn");
  const configInputs = {
    perspective: document.getElementById("configPerspective"),
    zodiac_type: document.getElementById("configZodiac"),
    sidereal_mode: document.getElementById("configSiderealMode"),
    house_system: document.getElementById("configHouse"),
    theme: document.getElementById("configTheme"),
  };
  const siderealRow = document.getElementById("siderealRow");
  const STORAGE_KEY = "astroFormState";
  let hasChart = false;
  let hasLoadedState = false;

  const DEFAULT_CONFIG = {
    perspective: "Topocentric",
    zodiac_type: "Sidereal",
    sidereal_mode: "KRISHNAMURTI",
    house_system: "W",
    theme: "dark",
  };

  if (!form || !chartContainer) {
    console.error("Home form or chart container missing from DOM.");
    return;
  }

  function getSelectedMode() {
    const checked = modeInputs.find((el) => el.checked);
    return checked ? checked.value : "natal";
  }

  function setTransitNow() {
    if (hasLoadedState) return;
    if (!transitDateInput || !transitTimeInput) return;
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    transitDateInput.value = dateStr;
    transitTimeInput.value = timeStr;
  }

  function updateModeVisibility() {
    const mode = getSelectedMode();
    const showBirth = mode !== "transit";
    const showTransit = mode !== "natal";

    if (birthSection) birthSection.style.display = showBirth ? "" : "none";
    if (transitSection) transitSection.style.display = showTransit ? "" : "none";
    if (nameRow) nameRow.style.display = mode === "transit" ? "none" : "";

    if (showTransit && mode !== "natal") {
      setTransitNow();
    }
  }

  function setField(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function getDefaultState() {
    return { mode: "natal", natal: null, transit: null };
  }

  function saveFormState(mode, payload) {
    try {
      let state = getDefaultState();
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state = { ...state, ...JSON.parse(raw) };

      state.mode = mode;
      if (payload.birth) state.natal = payload.birth;
      if (payload.moment) state.transit = payload.moment;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("Could not save form state", err);
    }
  }

  function loadSavedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state = { ...getDefaultState(), ...JSON.parse(raw) };

      if (state.mode) {
        const target = modeInputs.find((m) => m.value === state.mode);
        if (target) target.checked = true;
      }
      if (state.natal) {
        const b = state.natal;
        setField("name", b.name || "");
        setField("dateInput", `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`);
        setField("timeInput", `${String(b.hour).padStart(2, "0")}:${String(b.minute).padStart(2, "0")}`);
        setField("lat", b.lat);
        setField("lng", b.lng);
        setField("tz_str", b.tz_str);
        setField("city", b.city);
        setField("nation", b.nation);
      }
      if (state.transit) {
        const t = state.transit;
        setField("transitDateInput", `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`);
        setField("transitTimeInput", `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`);
        setField("transitLat", t.lat);
        setField("transitLng", t.lng);
        setField("transitTz", t.tz_str);
        setField("transitCity", t.city);
        setField("transitNation", t.nation);
      }
      hasLoadedState = true;
    } catch (err) {
      console.warn("Could not load saved form state", err);
    }
  }

  modeInputs.forEach((input) => {
    input.addEventListener("change", updateModeVisibility);
  });
  loadSavedState();
  updateModeVisibility();

  function loadConfig() {
    let stored = {};
    try {
      const raw = localStorage.getItem("astroConfig");
      if (raw) stored = JSON.parse(raw);
    } catch (err) {
      console.warn("Could not load config from localStorage", err);
    }
    const merged = { ...DEFAULT_CONFIG, ...stored };
    // Normalize legacy or invalid values
    if (merged.zodiac_type === "Tropical") {
      merged.zodiac_type = "Tropic";
    }
    if (!["Sidereal", "Tropic"].includes(merged.zodiac_type)) {
      merged.zodiac_type = DEFAULT_CONFIG.zodiac_type;
    }
    Object.entries(configInputs).forEach(([key, el]) => {
      if (el && merged[key]) {
        el.value = merged[key];
      }
    });
    toggleSiderealVisibility(merged.zodiac_type);
    return merged;
  }

  function saveConfig() {
    const cfg = getConfigFromInputs();
    try {
      localStorage.setItem("astroConfig", JSON.stringify(cfg));
    } catch (err) {
      console.warn("Could not save config to localStorage", err);
    }
    return cfg;
  }

  function getConfigFromInputs() {
    const cfg = { ...DEFAULT_CONFIG };
    Object.entries(configInputs).forEach(([key, el]) => {
      if (el && el.value) {
        cfg[key] = el.value;
      }
    });
    if (cfg.zodiac_type !== "Sidereal") {
      cfg.sidereal_mode = null;
    }
    return cfg;
  }

  function bindConfigInputs() {
    Object.values(configInputs).forEach((el) => {
      if (!el) return;
      el.addEventListener("change", saveConfig);
      el.addEventListener("blur", saveConfig);
    });
  }

  function showConfigPanel(show) {
    if (!configPanel) return;
    configPanel.classList.toggle("hidden", !show);
  }

  if (configToggle) {
    configToggle.addEventListener("click", () => showConfigPanel(true));
  }
  if (configClose) {
    configClose.addEventListener("click", () => showConfigPanel(false));
  }

  function toggleSiderealVisibility(zodiacType) {
    if (!siderealRow) return;
    siderealRow.style.display = zodiacType === "Sidereal" ? "" : "none";
  }

  loadConfig();
  if (configInputs.zodiac_type) {
    configInputs.zodiac_type.addEventListener("change", (e) => {
      toggleSiderealVisibility(e.target.value);
      saveConfig();
    });
  }
  toggleSiderealVisibility(configInputs.zodiac_type?.value);
  bindConfigInputs();

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("status-error", Boolean(isError));
  }

  function clearSummary() {
    if (summaryEl) {
      summaryEl.innerHTML = "";
    }
  }

  function clearChart() {
    chartContainer.innerHTML = "";
    hasChart = false;
    updateDownloadState();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("");
    clearSummary();
    clearChart();

    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.textContent = "Generating…";
    }

    const mode = getSelectedMode();

    try {
      const { payload, birthDateParts, transitDateParts } = buildPayloadFromForm(mode);

      if (mode === "natal") {
        const jsonResp = await fetch("/api/natal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!jsonResp.ok) {
          const text = await jsonResp.text();
          throw new Error(`Natal request failed: ${jsonResp.status} ${jsonResp.statusText} - ${text}`);
        }

        const natalJson = await jsonResp.json();
        if (natalJson && natalJson.subject) {
          renderNatalSummary(natalJson.subject, birthDateParts);
        } else if (summaryEl) {
          summaryEl.innerHTML =
            "<p>Unexpected response from natal endpoint – subject field not found.</p>";
        }

        const svgResp = await fetch("/api/svg/natal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!svgResp.ok) {
          const text = await svgResp.text();
          throw new Error(`SVG natal request failed: ${svgResp.status} ${svgResp.statusText} - ${text}`);
        }

        const svgText = await svgResp.text();
        chartContainer.innerHTML = svgText;
        hasChart = true;
        updateDownloadState();
        setStatus("Natal chart generated.");
      } else if (mode === "transit") {
        const jsonResp = await fetch("/api/transit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!jsonResp.ok) {
          const text = await jsonResp.text();
          throw new Error(`Transit request failed: ${jsonResp.status} ${jsonResp.statusText} - ${text}`);
        }

        const transitJson = await jsonResp.json();
        if (transitJson && transitJson.snapshot) {
          renderTransitSummary(transitJson.snapshot, transitDateParts);
        } else if (summaryEl) {
          summaryEl.innerHTML = "<p>Unexpected response from transit endpoint – snapshot not found.</p>";
        }

        const svgResp = await fetch("/api/svg/transit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!svgResp.ok) {
          const text = await svgResp.text();
          throw new Error(`SVG transit request failed: ${svgResp.status} ${svgResp.statusText} - ${text}`);
        }

        const svgText = await svgResp.text();
        chartContainer.innerHTML = svgText;
        hasChart = true;
        updateDownloadState();
        setStatus("Transit chart generated.");
      } else {
        const jsonResp = await fetch("/api/transit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!jsonResp.ok) {
          const text = await jsonResp.text();
          throw new Error(`Natal + transit request failed: ${jsonResp.status} ${jsonResp.statusText} - ${text}`);
        }

        const transitJson = await jsonResp.json();
        if (transitJson && transitJson.snapshot) {
          renderCombinedSummary(transitJson.snapshot, birthDateParts, transitDateParts);
        } else if (summaryEl) {
          summaryEl.innerHTML = "<p>Unexpected response from transit endpoint – snapshot not found.</p>";
        }

        const svgResp = await fetch("/api/svg/transit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!svgResp.ok) {
          const text = await svgResp.text();
          throw new Error(`SVG dual-wheel request failed: ${svgResp.status} ${svgResp.statusText} - ${text}`);
        }

        const svgText = await svgResp.text();
        chartContainer.innerHTML = svgText;
        hasChart = true;
        updateDownloadState();
        setStatus("Natal + Transit chart generated.");
      }
    } catch (err) {
      console.error(err);
      setStatus(err.message || "An error occurred while generating the chart.", true);
      if (summaryEl && !summaryEl.innerHTML) {
        summaryEl.innerHTML =
          "<p>Could not generate summary due to an error. Check the console for details.</p>";
      }
    } finally {
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.textContent = "Generate chart";
      }
      updateDownloadState();
    }
  }

  const ASPECTS = [
    { name: "conjunction", angle: 0, orb: 6 },
    { name: "sextile", angle: 60, orb: 4 },
    { name: "square", angle: 90, orb: 6 },
    { name: "trine", angle: 120, orb: 6 },
    { name: "opposition", angle: 180, orb: 6 },
  ];

  const ALLOWED_POINTS = new Set([
    "sun",
    "moon",
    "ascendant",
    "mercury",
    "venus",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
    "pluto",
  ]);

  const ICONS = {
    sun: "☀️",
    moon: "🌙",
    ascendant: "↗️",
    mercury: "☿️",
    venus: "♀️",
    mars: "♂️",
    jupiter: "♃",
    saturn: "♄",
    uranus: "⛢",
    neptune: "♆",
    pluto: "♇",
  };

  function normalizeAngleDiff(a, b) {
    let diff = Math.abs(a - b) % 360;
    if (diff > 180) diff = 360 - diff;
    return diff;
  }

  function classifyAspect(diff) {
    for (const asp of ASPECTS) {
      const delta = Math.abs(diff - asp.angle);
      if (delta <= asp.orb) {
        return { ...asp, orb: delta };
      }
    }
    return null;
  }

  function extractPoints(subject) {
    const points = {};
    for (const [key, value] of Object.entries(subject)) {
      if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "abs_pos")) {
        points[key] = value;
      }
    }
    return points;
  }

  function computeKeyAspects(subject, baseNames, allowedTargets) {
    const points = extractPoints(subject);
    const aspects = [];
    const baseSet = new Set(baseNames);
    const keys = Object.keys(points).filter((k) => !allowedTargets || allowedTargets.has(k));

    for (const base of baseNames) {
      const basePoint = points[base];
      if (!basePoint) continue;
      const baseDeg = basePoint.abs_pos;

      for (const other of keys) {
        if (other === base) continue;
        const otherPoint = points[other];
        if (!otherPoint) continue;

        if (baseSet.has(other) && base > other) continue;

        const otherDeg = otherPoint.abs_pos;
        const diff = normalizeAngleDiff(baseDeg, otherDeg);
        const asp = classifyAspect(diff);
        if (!asp) continue;

        aspects.push({
          base,
          other,
          type: asp.name,
          exact: asp.angle,
          orb: asp.orb,
        });
      }
    }

    aspects.sort((a, b) => a.orb - b.orb);
    return aspects;
  }

  function formatPointLabel(key, point, options = {}) {
    const baseNameMap = {
      sun: "Sun",
      moon: "Moon",
      ascendant: "Ascendant",
    };
    const label = baseNameMap[key] || point.name || key;
    const deg = typeof point.position === "number" ? point.position.toFixed(2) : "?";
    const sign = point.sign || "";
    const prefix = options.prefix ? `${options.prefix} ` : "";
    const icon = ICONS[key] || "✶";
    const parts = [`${icon} ${prefix}${label} ${sign} ${deg}°`];
    return parts.join(" ");
  }

  function formatAspectLabel(subject, aspect, options = {}) {
    const points = extractPoints(subject);
    const basePoint = points[aspect.base];
    const otherPoint = points[aspect.other];
    if (!basePoint || !otherPoint) return null;

    const baseLabel = formatPointLabel(aspect.base, basePoint, { prefix: options.basePrefix });
    const otherLabel = formatPointLabel(aspect.other, otherPoint, { prefix: options.otherPrefix });
    const orbText = aspect.orb.toFixed(2);

    return `${baseLabel} ${aspect.type} ${otherLabel} (orb ${orbText}°)`;
  }

  function getLunationInfo(parts) {
    if (!parts) return null;
    const { year, month, day, hour = 0, minute = 0 } = parts;
    if ([year, month, day].some((n) => !Number.isFinite(n))) return null;

    const synodic = 29.530588853; // average days in lunar cycle
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14); // reference new moon
    const target = Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);
    const daysSince = (target - knownNewMoon) / 86400000;
    const normalized = ((daysSince % synodic) + synodic) % synodic;
    const fraction = normalized / synodic;

    const phases = [
      { name: "New Moon", icon: "🌑" },
      { name: "Waxing Crescent", icon: "🌒" },
      { name: "First Quarter", icon: "🌓" },
      { name: "Waxing Gibbous", icon: "🌔" },
      { name: "Full Moon", icon: "🌕" },
      { name: "Waning Gibbous", icon: "🌖" },
      { name: "Last Quarter", icon: "🌗" },
      { name: "Waning Crescent", icon: "🌘" },
    ];

    const idx = Math.floor((fraction * 8 + 0.5)) % 8;
    const phase = phases[idx];
    const age = normalized;

    return {
      name: phase.name,
      icon: phase.icon,
      fraction,
      age,
      cycle: `${age.toFixed(1)} / 29.5 days`,
    };
  }

  function renderLunationBlock(info, title) {
    if (!info) return "";
    const percent = Math.round(info.fraction * 100);
    return `
      <div class="lunation">
        <div class="lunation-header">
          <span class="lunation-icon" aria-hidden="true">${info.icon}</span>
          <div>
            <div class="lunation-title">${title}</div>
            <div class="lunation-phase">${info.name} · ${info.cycle}</div>
          </div>
          <span class="lunation-chip">${percent}%</span>
        </div>
        <div class="lunation-bar">
          <span style="width:${percent}%;"></span>
        </div>
      </div>
    `;
  }

  function renderNatalSummary(subject, birthDateParts) {
    if (!summaryEl) {
      return;
    }

    const sun = subject.sun;
    const moon = subject.moon;
    const asc = subject.ascendant;

    if (!sun || !moon || !asc) {
      summaryEl.innerHTML =
        "<p>Could not find Sun, Moon or Ascendant in the natal response.</p>";
      return;
    }

    const baseNames = ["sun", "moon", "ascendant"];
    const aspects = computeKeyAspects(subject, baseNames, ALLOWED_POINTS);
    const topList = aspects.slice(0, 7);

    const sunText = formatPointLabel("sun", sun);
    const moonText = formatPointLabel("moon", moon);
    const ascText = formatPointLabel("ascendant", asc);

    const aspectItems = topList
      .map((asp) => formatAspectLabel(subject, asp))
      .filter(Boolean)
      .map((text) => `<li>${text}</li>`)
      .join("");

    summaryEl.innerHTML = `
      <div class="summary-card">
        <div class="summary-heading">Natal highlights</div>
        <div class="summary-points">
          <p><strong>Sun:</strong> ${sunText}</p>
          <p><strong>Moon:</strong> ${moonText}</p>
          <p><strong>Ascendant:</strong> ${ascText}</p>
        </div>
        <div class="summary-aspects">
          <h4>Top aspects (Sun, Moon, Asc)</h4>
          ${
            aspectItems
              ? `<ul>${aspectItems}</ul>`
              : "<p>No major aspects found within the configured orbs.</p>"
          }
        </div>
        ${renderLunationBlock(getLunationInfo(birthDateParts), "Moon cycle at birth")}
      </div>
    `;
  }

  function renderTransitSummary(snapshot, transitDateParts) {
    if (!summaryEl) return;
    const subject = snapshot?.subject;
    if (!subject) {
      summaryEl.innerHTML = "<p>Transit data missing from response.</p>";
      return;
    }

    const sun = subject.sun;
    const moon = subject.moon;
    const asc = subject.ascendant;
    const baseNames = ["sun", "moon", "ascendant"];
    const aspects = computeKeyAspects(subject, baseNames, ALLOWED_POINTS).slice(0, 7);

    const aspectItems = aspects
      .map((asp) => formatAspectLabel(subject, asp, { basePrefix: "T", otherPrefix: "T" }))
      .filter(Boolean)
      .map((text) => `<li>${text}</li>`)
      .join("");

    summaryEl.innerHTML = `
      <div class="summary-card">
        <div class="summary-heading">Transit snapshot</div>
        <div class="summary-points">
          <p><strong>Transit Sun:</strong> ${formatPointLabel("sun", sun, { prefix: "T" })}</p>
          <p><strong>Transit Moon:</strong> ${formatPointLabel("moon", moon, { prefix: "T" })}</p>
          <p><strong>Transit Ascendant:</strong> ${formatPointLabel("ascendant", asc, { prefix: "T" })}</p>
        </div>
        <div class="summary-aspects">
          <h4>Transit aspects (Sun, Moon, Asc)</h4>
          ${
            aspectItems
              ? `<ul>${aspectItems}</ul>`
              : "<p>No major aspects found within the configured orbs.</p>"
          }
        </div>
        ${renderLunationBlock(getLunationInfo(transitDateParts), "Moon cycle at moment")}
      </div>
    `;
  }

  function computeTransitNatalAspects(natalSubject, transitSubject, baseNames) {
    const natalPoints = extractPoints(natalSubject || {});
    const transitPoints = extractPoints(transitSubject || {});
    const natalKeys = Object.keys(natalPoints).filter((k) => ALLOWED_POINTS.has(k));
    const aspects = [];

    for (const base of baseNames) {
      const transitPoint = transitPoints[base];
      if (!transitPoint) continue;
      const baseDeg = transitPoint.abs_pos;

      for (const target of natalKeys) {
        const natalPoint = natalPoints[target];
        if (!natalPoint) continue;
        const targetDeg = natalPoint.abs_pos;
        const diff = normalizeAngleDiff(baseDeg, targetDeg);
        const asp = classifyAspect(diff);
        if (!asp) continue;

        aspects.push({
          base,
          other: target,
          type: asp.name,
          orb: asp.orb,
          baseSource: "transit",
          otherSource: "natal",
        });
      }
    }

    aspects.sort((a, b) => a.orb - b.orb);
    return aspects;
  }

  function formatCrossAspectLabel(natalSubject, transitSubject, aspect) {
    const transitPoints = extractPoints(transitSubject || {});
    const natalPoints = extractPoints(natalSubject || {});
    const basePoint = transitPoints[aspect.base];
    const otherPoint = natalPoints[aspect.other];
    if (!basePoint || !otherPoint) return null;

    const baseLabel = formatPointLabel(aspect.base, basePoint, { prefix: "T" });
    const otherLabel = formatPointLabel(aspect.other, otherPoint, { prefix: "N" });
    const orbText = aspect.orb.toFixed(2);
    return `${baseLabel} ${aspect.type} ${otherLabel} (orb ${orbText}°)`;
  }

  function renderCombinedSummary(snapshot, birthDateParts, transitDateParts) {
    if (!summaryEl) return;
    const transitSubject = snapshot?.subject;
    const natalSubject = snapshot?.natal_subject;
    if (!transitSubject || !natalSubject) {
      summaryEl.innerHTML =
        "<p>Missing natal or transit subjects in the combined response.</p>";
      return;
    }

    const baseNames = ["sun", "moon", "ascendant"];
    const natalBlock = (() => {
      const aspects = computeKeyAspects(natalSubject, baseNames, ALLOWED_POINTS).slice(0, 7);
      const aspectItems = aspects
        .map((asp) => formatAspectLabel(natalSubject, asp))
        .filter(Boolean)
        .map((text) => `<li>${text}</li>`)
        .join("");
      return `
        <div class="summary-card">
          <div class="summary-heading">Natal</div>
          <div class="summary-points">
            <p><strong>Sun:</strong> ${formatPointLabel("sun", natalSubject.sun)}</p>
            <p><strong>Moon:</strong> ${formatPointLabel("moon", natalSubject.moon)}</p>
            <p><strong>Ascendant:</strong> ${formatPointLabel("ascendant", natalSubject.ascendant)}</p>
          </div>
          <div class="summary-aspects">
            <h4>Top aspects (Sun, Moon, Asc)</h4>
            ${aspectItems ? `<ul>${aspectItems}</ul>` : "<p>No major aspects found.</p>"}
          </div>
          ${renderLunationBlock(getLunationInfo(birthDateParts), "Moon cycle at birth")}
        </div>
      `;
    })();

    const transitBlock = (() => {
      const aspects = computeKeyAspects(transitSubject, baseNames, ALLOWED_POINTS).slice(0, 7);
      const aspectItems = aspects
        .map((asp) => formatAspectLabel(transitSubject, asp, { basePrefix: "T", otherPrefix: "T" }))
        .filter(Boolean)
        .map((text) => `<li>${text}</li>`)
        .join("");
      return `
        <div class="summary-card">
          <div class="summary-heading">Transit</div>
          <div class="summary-points">
            <p><strong>Transit Sun:</strong> ${formatPointLabel("sun", transitSubject.sun, { prefix: "T" })}</p>
            <p><strong>Transit Moon:</strong> ${formatPointLabel("moon", transitSubject.moon, { prefix: "T" })}</p>
            <p><strong>Transit Ascendant:</strong> ${formatPointLabel("ascendant", transitSubject.ascendant, { prefix: "T" })}</p>
          </div>
          <div class="summary-aspects">
            <h4>Transit aspects (Sun, Moon, Asc)</h4>
            ${aspectItems ? `<ul>${aspectItems}</ul>` : "<p>No major aspects found.</p>"}
          </div>
          ${renderLunationBlock(getLunationInfo(transitDateParts), "Moon cycle at moment")}
        </div>
      `;
    })();

    const crossBlock = (() => {
      const dualAspects = computeTransitNatalAspects(natalSubject, transitSubject, baseNames).slice(0, 7);
      const items = dualAspects
        .map((asp) => formatCrossAspectLabel(natalSubject, transitSubject, asp))
        .filter(Boolean)
        .map((text) => `<li>${text}</li>`)
        .join("");
      return `
        <div class="summary-card">
          <div class="summary-heading">Transit to natal</div>
          <div class="summary-aspects">
            <h4>Key inter-chart aspects</h4>
            ${items ? `<ul>${items}</ul>` : "<p>No inter-chart aspects within the orbs.</p>"}
          </div>
        </div>
      `;
    })();

    summaryEl.innerHTML = `
      <div class="summary-grid">
        ${natalBlock}
        ${transitBlock}
      </div>
      ${crossBlock}
    `;
  }

  function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
  }

  function toFloat(id, fallback) {
    const v = parseFloat(getValue(id));
    return Number.isFinite(v) ? v : fallback;
  }

  function getDateTimeParts(dateId, timeId, defaults) {
    const datePart = (getValue(dateId) || "").trim();
    const timePart = (getValue(timeId) || "").trim();
    const [year, month, day] = datePart.split("-").map((n) => parseInt(n, 10));
    const [hourRaw = `${defaults.hour}`, minuteRaw = `${defaults.minute}`] = timePart.split(":");
    const hour = parseInt(hourRaw, 10);
    const minute = parseInt(minuteRaw, 10);
    return {
      year: Number.isFinite(year) ? year : defaults.year,
      month: Number.isFinite(month) ? month : defaults.month,
      day: Number.isFinite(day) ? day : defaults.day,
      hour: Number.isFinite(hour) ? hour : defaults.hour,
      minute: Number.isFinite(minute) ? minute : defaults.minute,
    };
  }

  function buildPayloadFromForm(mode) {
    const birthDateParts = getDateTimeParts("dateInput", "timeInput", {
      year: 1990,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
    });

    const transitDateParts = getDateTimeParts("transitDateInput", "transitTimeInput", {
      year: 2025,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
    });

    const config = getConfigFromInputs();

    const birth = {
      name: getValue("name") || "Subject",
      ...birthDateParts,
      lat: toFloat("lat", 52.3702),
      lng: toFloat("lng", 4.8952),
      tz_str: getValue("tz_str") || "Europe/Amsterdam",
      city: getValue("city") || "Amsterdam",
      nation: getValue("nation") || "NL",
    };

    const moment = {
      ...transitDateParts,
      lat: toFloat("transitLat", 52.3702),
      lng: toFloat("transitLng", 4.8952),
      tz_str: getValue("transitTz") || "Europe/Amsterdam",
      city: getValue("transitCity") || "Amsterdam",
      nation: getValue("transitNation") || "NL",
    };

    const normalizedConfig = {
      ...config,
      sidereal_mode: config.zodiac_type === "Sidereal" ? config.sidereal_mode : null,
    };

    if (mode === "natal") {
      return {
        payload: {
          birth,
          config: normalizedConfig,
        },
        birthDateParts,
        transitDateParts: null,
        config: normalizedConfig,
      };
    }

    if (mode === "transit") {
      return {
        payload: {
          moment,
          birth: null,
          config: normalizedConfig,
        },
        birthDateParts: null,
        transitDateParts,
        config: normalizedConfig,
      };
    }

    // natal_transit dual wheel
    return {
      payload: {
        moment,
        birth,
        config: normalizedConfig,
      },
      birthDateParts,
      transitDateParts,
      config: normalizedConfig,
    };
  }

  form.addEventListener("submit", handleSubmit);

  if (downloadBtn) {
    downloadBtn.addEventListener("click", handleDownloadPdf);
    updateDownloadState();
  }

  async function handleDownloadPdf() {
    setStatus("");
    const mode = getSelectedMode();
    const { payload, config, transitDateParts } = buildPayloadFromForm(mode);

    if (!hasChart) {
      setStatus("Generate a chart first to download PDF.", true);
      return;
    }

    let birthForReport = payload.birth;
    if (!birthForReport && payload.moment) {
      // Build a BirthData-like structure from the transit moment for reporting.
      birthForReport = {
        name: "Transit snapshot",
        ...payload.moment,
      };
    }

    const momentForReport =
      mode === "natal"
        ? null
        : payload.moment || {
            ...transitDateParts,
            lat: toFloat("transitLat", 52.3702),
            lng: toFloat("transitLng", 4.8952),
            tz_str: getValue("transitTz") || "Europe/Amsterdam",
            city: getValue("transitCity") || "Amsterdam",
            nation: getValue("transitNation") || "NL",
          };

    if (!birthForReport) {
      setStatus("PDF download needs birth data or a transit moment.", true);
      return;
    }

    try {
      downloadBtn.disabled = true;
      const requestBody = {
        kind: "NATAL",
        birth: birthForReport,
        config: { ...config, theme: "classic" },
        include_aspects: true,
        max_aspects: 50,
        moment: momentForReport,
      };

      const resp = await fetch(`/api/report/pdf?mode=${encodeURIComponent(mode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`PDF request failed: ${resp.status} ${resp.statusText} - ${text}`);
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${mode}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("PDF downloaded.");
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Could not download PDF.", true);
    } finally {
      updateDownloadState();
    }
  }

  function updateDownloadState() {
    if (!downloadBtn) return;
    downloadBtn.disabled = !hasChart;
    downloadBtn.classList.toggle("opacity-60", !hasChart);
    downloadBtn.classList.toggle("cursor-not-allowed", !hasChart);
  }
})();
