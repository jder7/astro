(function () {
  const ns = window.AppNamespace || "HomeApp";
  const App = (window[ns] = window[ns] || {});
  if (App.disabled) return;

  const { dom, constants, config } = App;

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

  function getAspectBasePoints() {
    const fallback =
      (constants && constants.DEFAULT_CONFIG && constants.DEFAULT_CONFIG.active_points) || [];
    const allowedPool = fallback;
    try {
      const cfg =
        config && typeof config.getConfigFromInputs === "function"
          ? config.getConfigFromInputs()
          : null;
      const vals = cfg && Array.isArray(cfg.active_points) ? cfg.active_points : null;
      const result = (vals && vals.length ? vals : fallback).filter((p) => p);
      const filtered = allowedPool.length
        ? result.filter((p) => allowedPool.some((ap) => ap.toLowerCase() === p.toLowerCase()))
        : result;
      return filtered.length ? filtered : fallback;
    } catch (err) {
      return fallback;
    }
  }

  const ASPECT_ICON = {
    conjunction: "◎",
    sextile: "✺",
    square: "□",
    trine: "△",
    opposition: "☍",
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
    for (const [key, value] of Object.entries(subject || {})) {
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
    const typeIcon = ASPECT_ICON[aspect.type] || "✦";

    const [baseIcon, ...baseRest] = baseLabel.split(" ");
    const [otherIcon, ...otherRest] = otherLabel.split(" ");
    const baseText = baseRest.join(" ") || baseLabel;
    const otherText = otherRest.join(" ") || otherLabel;

    return `${baseIcon} ${baseText} in ${typeIcon} ${aspect.type} with ${otherIcon} ${otherText} - Orb ${orbText}°`;
  }

  function getLunationInfo(parts) {
    if (!parts) return null;
    const { year, month, day, hour = 0, minute = 0 } = parts;
    if ([year, month, day].some((n) => !Number.isFinite(n))) return null;

    const synodic = 29.530588853;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
    const target = Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);
    const daysSince = (target - knownNewMoon) / 86400000;
    const normalized = ((daysSince % synodic) + synodic) % synodic;
    const fraction = normalized / synodic;
    const illumination = 0.5 * (1 - Math.cos((normalized / 29.53) * 2 * Math.PI));

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
      illumination,
      age,
      cycle: `${age.toFixed(1)} / 29.5 days`,
    };
  }

  function renderLunationBlock(info, title) {
    if (!info) return "";
    const percent = Math.round((info.illumination ?? info.fraction) * 100);
    const isWaning = info.fraction > 0.5;
    const barColor = isWaning ? "linear-gradient(90deg, #f472b6, #f87171)" : "linear-gradient(90deg, #38bdf8, #6366f1)";
    return `
      <div class="lunation">
        <div class="lunation-header">
          <span class="lunation-icon" aria-hidden="true">${info.icon}</span>
          <div>
            <div class="lunation-title">${title}</div>
            <div class="lunation-phase">${info.name} · ${info.cycle} · ${percent}% illumination</div>
          </div>
          <span class="lunation-chip">${percent}%</span>
        </div>
        <div class="lunation-bar">
          <span style="width:${percent}%;background:${barColor};"></span>
        </div>
      </div>
    `;
  }

  function renderNatalSummary(subject, birthDateParts) {
    if (!dom.summaryEl) {
      return;
    }

    const sun = subject.sun;
    const moon = subject.moon;
    const asc = subject.ascendant;

    if (!sun || !moon || !asc) {
      dom.summaryEl.innerHTML = "<p>Could not find Sun, Moon or Ascendant in the natal response.</p>";
      return;
    }

    const baseNames = getAspectBasePoints();
    const allowed = new Set(baseNames);
    const aspects = computeKeyAspects(subject, baseNames, allowed);
    const topList = aspects.slice(0, 7);

    const birthLabel = birthDateParts
      ? `${birthDateParts.year}-${String(birthDateParts.month).padStart(2, "0")}-${String(
          birthDateParts.day
        ).padStart(2, "0")} ${String(birthDateParts.hour).padStart(2, "0")}:${String(
          birthDateParts.minute
        ).padStart(2, "0")}`
      : "";

    const sunText = formatPointLabel("sun", sun);
    const moonText = formatPointLabel("moon", moon);
    const ascText = formatPointLabel("ascendant", asc);

    const aspectItems = topList
      .map((asp) => formatAspectLabel(subject, asp))
      .filter(Boolean)
      .map((text) => `<li>${text}</li>`)
      .join("");

    dom.summaryEl.innerHTML = `
      <div class="summary-card">
        <div class="summary-heading">Natal highlights ${birthLabel ? `· ${birthLabel}` : ""}</div>
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
    if (!dom.summaryEl) return;
    const subject = snapshot?.subject;
    if (!subject) {
      dom.summaryEl.innerHTML = "<p>Transit data missing from response.</p>";
      return;
    }

    const sun = subject.sun;
    const moon = subject.moon;
    const asc = subject.ascendant;
    const baseNames = getAspectBasePoints();
    const allowed = new Set(baseNames);
    const aspects = computeKeyAspects(subject, baseNames, allowed).slice(0, 7);

    const transitLabel = transitDateParts
      ? `${transitDateParts.year}-${String(transitDateParts.month).padStart(2, "0")}-${String(
          transitDateParts.day
        ).padStart(2, "0")} ${String(transitDateParts.hour).padStart(2, "0")}:${String(
          transitDateParts.minute
        ).padStart(2, "0")}`
      : "";

    const aspectItems = aspects
      .map((asp) => formatAspectLabel(subject, asp))
      .filter(Boolean)
      .map((text) => `<li>${text}</li>`)
      .join("");

    dom.summaryEl.innerHTML = `
      <div class="summary-card">
        <div class="summary-heading">Transit snapshot ${transitLabel ? `· ${transitLabel}` : ""}</div>
        <div class="summary-points">
          <p><strong>Transit Sun:</strong> ${formatPointLabel("sun", sun)}</p>
          <p><strong>Transit Moon:</strong> ${formatPointLabel("moon", moon)}</p>
          <p><strong>Transit Ascendant:</strong> ${formatPointLabel("ascendant", asc)}</p>
        </div>
        <div class="summary-aspects">
          <h4>Transit aspects</h4>
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

  function computeTransitNatalAspects(natalSubject, transitSubject, baseNames, allowedSet) {
    const natalPoints = extractPoints(natalSubject || {});
    const transitPoints = extractPoints(transitSubject || {});
    const allowed = allowedSet || ALLOWED_POINTS;
    const natalKeys = Object.keys(natalPoints).filter((k) => allowed.has(k));
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

    const baseLabel = formatPointLabel(aspect.base, basePoint, { prefix: "Transit" });
    const otherLabel = formatPointLabel(aspect.other, otherPoint, { prefix: "Natal" });
    const orbText = aspect.orb.toFixed(2);
    return `${baseLabel} ${aspect.type} ${otherLabel} (orb ${orbText}°)`;
  }

  function renderCombinedSummary(snapshot, birthDateParts, transitDateParts) {
    if (!dom.summaryEl) return;
    const transitSubject = snapshot?.subject;
    const natalSubject = snapshot?.natal_subject;
    if (!transitSubject || !natalSubject) {
      dom.summaryEl.innerHTML = "<p>Missing natal or transit subjects in the combined response.</p>";
      return;
    }

    const baseNames = getAspectBasePoints();
    const natalBlock = (() => {
      const allowed = new Set(baseNames);
      const aspects = computeKeyAspects(natalSubject, baseNames, allowed).slice(0, 7);
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
      const allowed = new Set(baseNames);
      const aspects = computeKeyAspects(transitSubject, baseNames, allowed).slice(0, 7);
      const aspectItems = aspects
        .map((asp) => formatAspectLabel(transitSubject, asp, { basePrefix: "Transit", otherPrefix: "Transit" }))
        .filter(Boolean)
        .map((text) => `<li>${text}</li>`)
        .join("");
      return `
        <div class="summary-card">
          <div class="summary-heading">Transit</div>
          <div class="summary-points">
            <p><strong>Transit Sun:</strong> ${formatPointLabel("sun", transitSubject.sun)}</p>
            <p><strong>Transit Moon:</strong> ${formatPointLabel("moon", transitSubject.moon)}</p>
            <p><strong>Transit Ascendant:</strong> ${formatPointLabel("ascendant", transitSubject.ascendant)}</p>
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
      const allowed = new Set(baseNames);
      const dualAspects = computeTransitNatalAspects(natalSubject, transitSubject, baseNames, allowed).slice(0, 7);
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

    dom.summaryEl.innerHTML = `
      <div class="summary-grid">
        ${natalBlock}
        ${transitBlock}
      </div>
      ${crossBlock}
    `;
  }

  function renderRelationshipSummary(relJson) {
    if (!dom.summaryEl) return;
    const firstName =
      relJson?.first_subject?.meta?.name ||
      relJson?.first_subject?.name ||
      "Partner A";
    const secondName =
      relJson?.second_subject?.meta?.name ||
      relJson?.second_subject?.name ||
      "Partner B";

    const extractAspects = (payload) => {
      const source = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.aspects)
        ? payload.aspects
        : Array.isArray(payload?.active_aspects)
        ? payload.active_aspects
        : [];
      return source
        .map((a) => {
          const baseKey =
            (a.planet1 || a.p1_name || a.left || a.body1 || a.source || a.p1 || "").toLowerCase();
          const otherKey =
            (a.planet2 || a.p2_name || a.right || a.body2 || a.target || a.p2 || "").toLowerCase();
          const type = a.aspect_type || a.aspect || a.type || a.name || "";
          const orbRaw = a.orb ?? a.orbit ?? a.diff ?? a.orb_value ?? a.aspect_orb;
          const orb = typeof orbRaw === "number" ? orbRaw : parseFloat(orbRaw || "9999");
          const position1 = a.position1 ?? a.p1_abs_pos ?? a.abs_pos1 ?? a.left_abs_pos;
          const position2 = a.position2 ?? a.p2_abs_pos ?? a.abs_pos2 ?? a.right_abs_pos;
          const sign1 = a.sign1 || a.p1_sign || "";
          const sign2 = a.sign2 || a.p2_sign || "";
          return { baseKey, otherKey, type, orb, position1, position2, sign1, sign2 };
        })
        .filter(
          (a) => ALLOWED_POINTS.has(a.baseKey) && ALLOWED_POINTS.has(a.otherKey) && Number.isFinite(a.orb)
        );
    };

    const normalized = extractAspects(relJson?.aspects || relJson);
    normalized.sort((a, b) => (a.orb || 999) - (b.orb || 999));
    const totalAspects = normalized.length;
    const top = normalized.slice(0, 7);
    const items = top
      .map((a) => {
        const baseLabel = formatPointLabel(a.baseKey, { position: a.position1 || 0, sign: a.sign1 || "" });
        const otherLabel = formatPointLabel(a.otherKey, { position: a.position2 || 0, sign: a.sign2 || "" });
        const typeIcon = ASPECT_ICON[a.type] || "✦";
        const orbText = Number.isFinite(a.orb) ? a.orb.toFixed(2) : "?";
        return `<li>${typeIcon} ${baseLabel} ${a.type || ""} ${otherLabel} (orb ${orbText}°)</li>`;
      })
      .join("");

    dom.summaryEl.innerHTML = `
      <div class="summary-card">
        <div class="summary-heading">Synastry highlights</div>
        <p class="summary-subheading">${firstName} &amp; ${secondName}</p>
        <div class="summary-stats">
          <div><span class="summary-stat-number">${totalAspects || 0}</span><span class="summary-stat-label">aspects</span></div>
          <div><span class="summary-stat-number">${top.length || 0}</span><span class="summary-stat-label">key ties</span></div>
        </div>
        ${
          items
            ? `<ul>${items}</ul>`
            : "<p>No major aspects found for the selected partners.</p>"
        }
      </div>
    `;
  }

  App.render = {
    renderNatalSummary,
    renderTransitSummary,
    renderCombinedSummary,
    renderRelationshipSummary,
    renderLunationBlock,
    getLunationInfo,
  };
})();
