(function () {
  const HomeApp = window.HomeApp || {};
  if (HomeApp.disabled) return;

  const { dom } = HomeApp;

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

    dom.summaryEl.innerHTML = `
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
    if (!dom.summaryEl) return;
    const subject = snapshot?.subject;
    if (!subject) {
      dom.summaryEl.innerHTML = "<p>Transit data missing from response.</p>";
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

    dom.summaryEl.innerHTML = `
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
    if (!dom.summaryEl) return;
    const transitSubject = snapshot?.subject;
    const natalSubject = snapshot?.natal_subject;
    if (!transitSubject || !natalSubject) {
      dom.summaryEl.innerHTML = "<p>Missing natal or transit subjects in the combined response.</p>";
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
    const aspects =
      (relJson && relJson.aspects && relJson.aspects.aspects) || relJson.aspects || [];
    const filtered = (aspects || []).filter(
      (a) =>
        ALLOWED_POINTS.has((a.planet1 || "").toLowerCase()) &&
        ALLOWED_POINTS.has((a.planet2 || "").toLowerCase())
    );
    filtered.sort((a, b) => (a.orb || 999) - (b.orb || 999));
    const top = filtered.slice(0, 7);
    const items = top
      .map((a) => {
        const baseKey = (a.planet1 || "").toLowerCase();
        const otherKey = (a.planet2 || "").toLowerCase();
        const baseLabel = formatPointLabel(baseKey, { position: a.position1 || 0, sign: a.sign1 || "" });
        const otherLabel = formatPointLabel(otherKey, { position: a.position2 || 0, sign: a.sign2 || "" });
        const typeIcon = ASPECT_ICON[a.aspect_type] || "✦";
        const orb = typeof a.orb === "number" ? a.orb.toFixed(2) : "?";
        return `<li>${typeIcon} ${baseLabel} ${a.aspect_type || ""} ${otherLabel} (orb ${orb}°)</li>`;
      })
      .join("");

    dom.summaryEl.innerHTML = `
      <div class="summary-card">
        <div class="summary-heading">Relationship aspects</div>
        ${
          items
            ? `<ul>${items}</ul>`
            : "<p>No major aspects found for the selected partners.</p>"
        }
      </div>
    `;
  }

  HomeApp.render = {
    renderNatalSummary,
    renderTransitSummary,
    renderCombinedSummary,
    renderRelationshipSummary,
    renderLunationBlock,
    getLunationInfo,
  };
})();
