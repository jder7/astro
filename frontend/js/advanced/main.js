(function () {
  // Store API responses separately from the home page so only config + inputs are shared.
  const ns = "AdvancedApp";
  const app = (window[ns] = window[ns] || {});
  // Keep input/config storage shared with Home; only API cache is advanced-specific.
  app.constants = {
    ...(app.constants || {}),
    STORAGE_INPUT: "astroInputState",
    STORAGE_CONFIG: "astroConfig",
    STORAGE_API: "astroApiStateAdvanced",
  };

  const STORAGE_RANGE = "astroAdvancedRange";

  const dom = {
    rangeStart: document.getElementById("advancedRangeStart"),
    rangeEnd: document.getElementById("advancedRangeEnd"),
    rangeSummary: document.getElementById("advancedRangeSummary"),
    rangeNow: document.getElementById("advancedRangeNow"),
    summaryEl: document.getElementById("summaryContent"),
    apiCollapseBtn: document.getElementById("apiCollapseBtn"),
    apiResponseBody: document.getElementById("apiResponseBody"),
  };

  const shared = window.AppShared || {};
  const {
    SIGN_META,
    ELEMENT_ICON,
    QUALITY_ICON,
    POINTS_ICONS,
    ASPECT_ICON_MAP,
    computeAspects: computeAspectsShared,
    resolveActivePointKeys,
    normalizePointKey,
    MAJOR_ASPECT_ICON_MAP,
    MAJOR_ASPECT_PATTERNS,
    getMajorAspectIcon,
    emojiNumber,
    formatHouseLabel,
    formatHouseLabelShort,
    formatDateLabel,
    capitalise,
  } = shared;
  const flags = (app.flags = { ...(app.flags || {}), skipSvg: true });
  console.info("[advanced] main init", { ns, skipSvg: flags.skipSvg });

  const fallbackIcon = (id) => {
    if (typeof getMajorAspectIcon === "function") {
      const svg = getMajorAspectIcon(id);
      if (svg) return svg;
    }
    if (MAJOR_ASPECT_ICON_MAP && MAJOR_ASPECT_ICON_MAP[id]) return MAJOR_ASPECT_ICON_MAP[id];
    if (MAJOR_ASPECT_ICON_MAP && MAJOR_ASPECT_ICON_MAP.generic) return MAJOR_ASPECT_ICON_MAP.generic;
    return `<svg viewBox="0 0 88 88" class="adv-pattern-svg" aria-hidden="true" role="img"><circle cx="44" cy="44" r="32" fill="rgba(56,189,248,0.12)" stroke="#38bdf8" stroke-width="2.2"/></svg>`;
  };

  const pad = (v) => String(v).padStart(2, "0");
  const toDatetimeLocal = (date) => {
    if (!(date instanceof Date)) return "";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  const getDefaultRange = () => {
    const start = new Date();
    const end = new Date(start.getTime() + 6 * 60 * 60 * 1000);
    return { start: toDatetimeLocal(start), end: toDatetimeLocal(end) };
  };

  function loadRange() {
    try {
      const raw = localStorage.getItem(STORAGE_RANGE);
      if (!raw) return getDefaultRange();
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...getDefaultRange(), ...parsed };
      }
    } catch (err) {
    }
    return getDefaultRange();
  }

  function saveRange(range) {
    try {
      localStorage.setItem(STORAGE_RANGE, JSON.stringify(range));
    } catch (err) {
    }
  }

  function formatRangeSummary(range) {
    if (!dom.rangeSummary) return;
    const start = range.start || "";
    const end = range.end || "";
    if (!start && !end) {
      dom.rangeSummary.textContent = "Set start and end to see duration.";
      return;
    }
    const parseDate = (value) => {
      if (!value) return null;
      const d = new Date(value);
      return Number.isFinite(d.getTime()) ? d : null;
    };
    const startDate = parseDate(start);
    const endDate = parseDate(end);
    if (startDate && endDate && endDate > startDate) {
      const diffMs = endDate.getTime() - startDate.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      dom.rangeSummary.textContent = `${start.replace("T", " ")} → ${end.replace("T", " ")} (${hours}h ${minutes}m)`;
    } else if (startDate || endDate) {
      dom.rangeSummary.textContent = startDate ? `Starting ${start.replace("T", " ")}` : `Ending ${end.replace("T", " ")}`;
    } else {
      dom.rangeSummary.textContent = "Set start and end to see duration.";
    }
  }

  function applyRange(range) {
    if (dom.rangeStart) dom.rangeStart.value = range.start || "";
    if (dom.rangeEnd) dom.rangeEnd.value = range.end || "";
    formatRangeSummary(range);
  }

  function handleRangeChange() {
    const range = {
      start: dom.rangeStart ? dom.rangeStart.value : "",
      end: dom.rangeEnd ? dom.rangeEnd.value : "",
    };
    saveRange(range);
    formatRangeSummary(range);
  }

  function formatPointRow(point, { labelOverride } = {}) {
    if (!point) return "";
    const pointIcon = point.point_type === "House" 
    ? formatHouseLabelShort(point.name) || "🏠" 
    : POINTS_ICONS[point.name.toLowerCase()] || "✶";
    const signMeta = SIGN_META[point.sign] || { name: point.sign || "—", icon: point.emoji || "?" };
    const element = point.element || "";
    const quality = point.quality || "";
    const elementIcon = ELEMENT_ICON[element] || "";
    const qualityIcon = QUALITY_ICON[quality] || "";
    const houseLabel = point.house ? formatHouseLabel(point.house) : "";
    const pos = Number.isFinite(point.position) ? `${point.position.toFixed(2)}°` : "—";
    const signNum = Number.isFinite(point.sign_num) ? emojiNumber(point.sign_num) : "";
    const retro = point.retrograde ? " · Rx" : "";
    const name = capitalise(labelOverride || point.name || "Point");
    return `
      <div class="adv-row">
        <div class="adv-row-main">
          <span class="adv-chip">${pointIcon}</span>
          <span class="adv-label"><strong>${name}</strong> — ${signMeta.name} ${signMeta.icon || ""} — 
          <span>
          <span>${pos} </span>
          ${houseLabel ? `<span>— ${houseLabel} </span>` : ""}
          ${element ? `<span>— ${elementIcon} ${element}</span>` : ""}
          ${quality ? `<span>— ${qualityIcon} ${quality}</span>` : ""}
          ${retro ? `<span>— ${retro}</span>` : ""}
          </span>
          </span>
        </div>
        
      </div>
    `;
  }

  function collectPoints(obj) {
    return Object.entries(obj || {}).reduce(
      (acc, [key, val]) => {
        if (val && typeof val === "object" && val.point_type === "AstrologicalPoint") {
          acc.points[key] = val;
        } else if (val && typeof val === "object" && val.point_type === "House") {
          acc.houses[key] = val;
        }
        return acc;
      },
      { points: {}, houses: {} }
    );
  }

  function normalizeAspectRows(aspectList, points) {
    const rows = [];
    (aspectList || []).forEach((a) => {
      const baseKey = normalizePointKey(
        a.base_key || a.baseKey || a.left || a.first_point || a.first || a.point1 || a.planet1 || a.p1_name || a.p1
      );
      const otherKey = normalizePointKey(
        a.other_key || a.otherKey || a.right || a.second_point || a.second || a.point2 || a.planet2 || a.p2_name || a.p2
      );
      const type = (a.aspect_type || a.aspect || a.type || a.name || "").toLowerCase();
      if (!baseKey || !otherKey || !type) return;
      rows.push({
        baseKey,
        otherKey,
        aspect: {
          name: type,
          icon: ASPECT_ICON_MAP[type] || "✶",
          orb: typeof a.orb_value === "number" ? a.orb_value : Number.parseFloat(a.orb) || null,
        },
        base: points?.[baseKey],
        other: points?.[otherKey],
      });
    });
    return rows;
  }

  function extractMajorAspects(payload) {
    if (!payload) return [];
    if (Array.isArray(payload.major_aspects)) return payload.major_aspects;
    if (Array.isArray(payload.snapshot?.major_aspects)) return payload.snapshot.major_aspects;
    if (Array.isArray(payload.subject?.major_aspects)) return payload.subject.major_aspects;
    return [];
  }

  function extractNatalMajorAspects(payload) {
    if (!payload) return [];
    if (Array.isArray(payload.natal_major_aspects)) return payload.natal_major_aspects;
    if (Array.isArray(payload.snapshot?.natal_major_aspects)) return payload.snapshot.natal_major_aspects;
    return [];
  }

  function renderAspectMatrix(points, keys, aspects) {
    if (!keys.length || !aspects.length) return "";
    const norm = (a, b) => (a < b ? `${a}__${b}` : `${b}__${a}`);
    const aspectMap = new Map();
    aspects.forEach(({ baseKey, otherKey, aspect }) => {
      aspectMap.set(norm(baseKey, otherKey), {
        icon: aspect.icon || "✶",
        name: aspect.name || "",
        orb: aspect.orb,
      });
    });
    const iconFor = (key) => {
      const pt = points[key] || {};
      return POINTS_ICONS[(pt.name || "").toLowerCase()] || "✶";
    };
    const rows = keys
      .map((rowKey, rowIdx) => {
        const rowPt = points[rowKey] || {};
        const cells = keys
          .map((colKey, colIdx) => {
            if (colIdx === rowIdx) {
              return `<td class="adv-matrix-cell adv-matrix-diag" title="${rowPt.name || rowKey}">${iconFor(rowKey)}</td>`;
            }
            const pair = norm(rowKey, colKey);
            const hit = aspectMap.get(pair);
            if (!hit) return '<td class="adv-matrix-empty"></td>';
            const note = hit.name ? ` — ${capitalise(hit.name)}` : "";
            const colName = points[colKey]?.name || colKey;
            if (colIdx < rowIdx) {
              return `<td class="adv-matrix-cell" title="${rowPt.name || rowKey} × ${colName}${note}">${hit.icon || "✶"}</td>`;
            }
            const orbLabel = Number.isFinite(hit.orb) ? hit.orb.toFixed(2) : "";
            return `<td class="adv-matrix-cell adv-matrix-orb" title="${rowPt.name || rowKey} × ${colName}${note}">${orbLabel}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    return `
      <div class="adv-matrix-wrap">
        <table class="adv-aspect-matrix">
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function formatPointInline(points, key) {
    if (!key) return "";
    const pt = points[key] || {};
    const label = pt.name || capitalise(key.replace(/_/g, " "));
    const signShortName = pt.sign || "";
    const signIcon = (SIGN_META[pt.sign]?.icon || signShortName).trim();
    const pos = Number.isFinite(pt.position) ? `${pt.position.toFixed(2)}°` : "";
    const icon = POINTS_ICONS[(pt.name || key || "").toLowerCase()] || "✶";
    return `${icon} ${label}${signIcon ? ` ${signIcon}` : ""}${pos ? ` @ ${pos}` : ""}`;
  }

  function formatPointGroup(list, points) {
    return (list || []).map((key) => formatPointInline(points, key)).filter(Boolean).join(" · ");
  }

  function formatLinkLine(link, points) {
    if (!link || !Array.isArray(link.pair)) return "";
    const [leftKey, rightKey] = link.pair;
    const aspectIcon = ASPECT_ICON_MAP[link.type] || link.icon || "✶";
    const orbLabel = Number.isFinite(link.orb) ? `${link.orb.toFixed(2)}°` : "";
    const left = formatPointInline(points, leftKey);
    const right = formatPointInline(points, rightKey);
    const aspectLabel = link.type ? capitalise(link.type) : "Aspect";
    return `${left} ${aspectIcon} ${aspectLabel} ${right}${orbLabel ? ` (orb ${orbLabel})` : ""}`;
  }

  const PATTERN_RENDERERS = {
    stellium: (pattern, points) => {
      const cluster = pattern.structure?.cluster || pattern.points || [];
      const text = formatPointGroup(cluster, points);
      return text ? [`<li><strong>Cluster</strong>: ${text}</li>`] : [];
    },
    t_square: (pattern, points) => {
      const focal = pattern.structure?.focal;
      const others = (pattern.points || []).filter((k) => k !== focal);
      const lines = [];
      if (focal) lines.push(`<li><strong>Focal</strong>: ${formatPointInline(points, focal)}</li>`);
      if (others.length) lines.push(`<li><strong>Opposition base</strong>: ${formatPointGroup(others, points)}</li>`);
      return lines;
    },
    grand_trine: (pattern, points) => {
      const triple = pattern.structure?.triple || pattern.points || [];
      const text = formatPointGroup(triple, points);
      return text ? [`<li><strong>Triangle</strong>: ${text}</li>`] : [];
    },
    kite: (pattern, points) => {
      const triangle = pattern.structure?.triangle || [];
      const opposition = pattern.structure?.opposition || [];
      const lines = [];
      const triText = formatPointGroup(triangle, points);
      if (triText) lines.push(`<li><strong>Grand Trine</strong>: ${triText}</li>`);
      const oppText = formatPointGroup(opposition, points);
      if (oppText) lines.push(`<li><strong>Spine</strong>: ${oppText}</li>`);
      return lines;
    },
    grand_cross: (pattern, points) => {
      const axes = pattern.structure?.axes || [];
      const lines = axes
        .map((pair, idx) => `<li><strong>Axis ${idx + 1}</strong>: ${formatPointGroup(pair, points)}</li>`)
        .filter(Boolean);
      const pointsLine = formatPointGroup(pattern.points || [], points);
      if (!lines.length && pointsLine) lines.push(`<li><strong>Points</strong>: ${pointsLine}</li>`);
      return lines;
    },
    grand_sextile: (pattern, points) => {
      const triples = pattern.structure?.triples || [];
      const lines = triples
        .map((triple, idx) => `<li><strong>Triangle ${idx + 1}</strong>: ${formatPointGroup(triple, points)}</li>`)
        .filter(Boolean);
      if (!lines.length) {
        const pts = formatPointGroup(pattern.points || [], points);
        if (pts) lines.push(`<li><strong>Points</strong>: ${pts}</li>`);
      }
      return lines;
    },
    mystic_rectangle: (pattern, points) => {
      const oppositions = pattern.structure?.oppositions || [];
      const lines = oppositions
        .map((pair, idx) => `<li><strong>Opposition ${idx + 1}</strong>: ${formatPointGroup(pair, points)}</li>`)
        .filter(Boolean);
      const pts = formatPointGroup(pattern.points || [], points);
      if (!lines.length && pts) lines.push(`<li><strong>Points</strong>: ${pts}</li>`);
      return lines;
    },
    trapeze: (pattern, points) => {
      const chain = pattern.structure?.chain || pattern.points || [];
      const text = formatPointGroup(chain, points);
      return text ? [`<li><strong>Chain</strong>: ${text}</li>`] : [];
    },
    default: (pattern, points) => {
      const text = formatPointGroup(pattern.points || [], points);
      return text ? [`<li><strong>Points</strong>: ${text}</li>`] : [];
    },
  };

  function renderPatternLinks(pattern, points) {
    const links = Array.isArray(pattern.links) ? pattern.links : [];
    return links
      .map((link) => formatLinkLine(link, points))
      .filter(Boolean)
      .map((text) => `<li>${text}</li>`);
  }

  function renderPatternCard(pattern, points) {
    const icon = fallbackIcon(pattern.id);
    const aspectsLabel = pattern.aspects_label || pattern.aspectsLabel || (pattern.aspects || []).map(capitalise).join(", ");
    const detailRenderer = PATTERN_RENDERERS[pattern.id] || PATTERN_RENDERERS.default;
    const detailLines = detailRenderer(pattern, points || {});
    const linkLines = renderPatternLinks(pattern, points || {});
    const lines = [...detailLines, ...linkLines];
    const list =
      lines.length > 0
        ? `<ul class="adv-pattern-hit-list">${lines.join("")}</ul>`
        : `<p class="adv-pattern-none">No structural links found for this pattern.</p>`;
    const geometry = pattern.geometry ? `<p class="adv-pattern-sub">${pattern.geometry}</p>` : "";
    return `
      <article class="adv-pattern-card">
        <div class="adv-pattern-title-row">
          <div class="adv-pattern-icon" aria-hidden="true">${icon}</div>
          <div class="adv-pattern-title-stack">
            <h4>${pattern.name || capitalise(pattern.id || "Pattern")}</h4>
            <p class="adv-pattern-subtitle">${aspectsLabel}</p>
            ${geometry}
          </div>
          <span class="adv-pattern-pill">${pattern.planets || ""}</span>
        </div>
        <div class="adv-pattern-aspects">${list}</div>
      </article>
    `;
  }

  function renderPatternGroupCard(patterns, points) {
    if (!patterns || !patterns.length) return "";
    const primary = patterns[0];
    const icon = fallbackIcon(primary.id);
    const aspectsLabel =
      primary.aspects_label || primary.aspectsLabel || (primary.aspects || []).map(capitalise).join(", ");
    const geometry = primary.geometry ? `<p class="adv-pattern-sub">${primary.geometry}</p>` : "";
    const body = patterns
      .map((pattern, idx) => {
        const detailRenderer = PATTERN_RENDERERS[pattern.id] || PATTERN_RENDERERS.default;
        const detailLines = detailRenderer(pattern, points || {});
        const linkLines = renderPatternLinks(pattern, points || {});
        const lines = [...detailLines, ...linkLines];
        const list =
          lines.length > 0
            ? `<ul class="adv-pattern-hit-list">${lines.join("")}</ul>`
            : `<p class="adv-pattern-none">No structural links found for this pattern.</p>`;
        return `<div class="adv-pattern-instance-block">${list}</div>`;
      })
      .join("");
    return `
      <article class="adv-pattern-card">
        <div class="adv-pattern-title-row">
          <div class="adv-pattern-icon" aria-hidden="true">${icon}</div>
          <div class="adv-pattern-title-stack">
            <h4>${primary.name || capitalise(primary.id || "Pattern")}</h4>
            <p class="adv-pattern-subtitle">${aspectsLabel}</p>
            ${geometry}
          </div>
          <span class="adv-pattern-pill">${primary.planets || ""}</span>
        </div>
        <div class="adv-pattern-aspects">
          ${body}
        </div>
      </article>
    `;
  }

  function renderMajorAspectsList(patterns, points, title, subtitle, includeModal = true) {
    if (!Array.isArray(patterns) || patterns.length === 0) return "";
    const headerTitle = title || "Major Ptolemaic Aspect Configurations";
    const headerSubtitle = subtitle || "Geometric patterns detected in the response payload.";
    const modal = includeModal ? renderPatternModal(MAJOR_ASPECT_PATTERNS) : "";
    const infoBtn = includeModal
      ? `<button type="button" class="adv-pattern-info-btn" data-target="#advPatternModal" aria-label="Show pattern descriptions">i</button>`
      : "";

    // Group by pattern type and sort groups by max unique point count (desc).
    const grouped = patterns.reduce((acc, p) => {
      const key = p.id || p.name || "pattern";
      acc[key] = acc[key] || [];
      acc[key].push(p);
      return acc;
    }, {});
    const sortedGroups = Object.values(grouped).sort((a, b) => {
      const maxA = Math.max(...a.map((p) => (p.points || []).length || 0), 0);
      const maxB = Math.max(...b.map((p) => (p.points || []).length || 0), 0);
      return maxB - maxA;
    });

    const cards = sortedGroups
      .map((group) => {
        const label = group[0]?.name || capitalise((group[0]?.id || "Pattern").replace(/_/g, " "));
        return `<div class="adv-pattern-type"><h4>${label}</h4>${renderPatternGroupCard(group, points || {})}</div>`;
      })
      .join("");

    return `
      <div class="adv-patterns">
        <div class="adv-patterns-head">
          <div>
            <p class="adv-patterns-kicker">${headerTitle}</p>
            <h3>${headerSubtitle}</h3>
            <p class="adv-patterns-sub">Shapes derived from the returned major aspect payload.</p>
          </div>
          ${infoBtn}
        </div>
        <div class="adv-pattern-list">${cards}</div>
      </div>
      ${modal}
    `;
  }

  function renderPatternModal(patterns) {
    const items = (patterns || [])
      .map(
        (p) => `
      <article class="adv-pattern-modal-card">
        <div class="adv-pattern-icon" aria-hidden="true">${fallbackIcon(p.id)}</div>
        <div class="adv-pattern-modal-title">
          <h4>${p.name}</h4>
          <span class="adv-pattern-pill">${p.planets}</span>
        </div>
        <p class="adv-pattern-overlay-geometry">${p.geometry}</p>
        <dl class="adv-pattern-meta">
          <div>
            <dt>Orb guide</dt>
            <dd>${p.orb}</dd>
          </div>
          <div>
            <dt>Construction</dt>
            <dd>${p.construction}</dd>
          </div>
        </dl>
      </article>
    `
      )
      .join("");
    return `
      <div class="adv-pattern-modal hidden" id="advPatternModal" role="dialog" aria-modal="true" aria-label="Major aspects descriptions">
        <div class="adv-pattern-modal-backdrop" data-close-modal></div>
        <div class="adv-pattern-modal-content">
          <div class="adv-pattern-modal-header">
            <div>
              <p class="adv-patterns-kicker">Pattern guide</p>
              <h3>Major aspect configurations</h3>
            </div>
            <button type="button" class="adv-pattern-close-btn" data-close-modal aria-label="Close pattern descriptions">✕</button>
          </div>
          <div class="adv-pattern-modal-body">
            ${items}
          </div>
        </div>
      </div>
    `;
  }

  function attachPatternModalHandlers() {
    const modal = document.querySelector("#advPatternModal");
    const openBtn = document.querySelector(".adv-pattern-info-btn");
    if (!modal || !openBtn) return;
    const backdrop = modal.querySelector(".adv-pattern-modal-backdrop");
    const closeBtns = modal.querySelectorAll("[data-close-modal]");
    const open = () => modal.classList.remove("hidden");
    const close = () => modal.classList.add("hidden");
    openBtn.addEventListener("click", open);
    closeBtns.forEach((btn) => btn.addEventListener("click", close));
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
    if (backdrop) backdrop.addEventListener("click", close);
  }

  function renderAspectRow(entry) {
    const { baseKey, otherKey, aspect, base, other } = entry;
    const baseSign = SIGN_META[base.sign] || { name: base.sign || "", icon: base.emoji || "" };
    const otherSign = SIGN_META[other.sign] || { name: other.sign || "", icon: other.emoji || "" };
    const basePos = Number.isFinite(base.position) ? `${base.position.toFixed(2)}°` : "—";
    const otherPos = Number.isFinite(other.position) ? `${other.position.toFixed(2)}°` : "—";
    const orbLabel = Number.isFinite(aspect.orb) ? `${aspect.orb.toFixed(2)}°` : "—";
    const aspectName = capitalise(aspect.name || "Aspect");
    const aspectIcon = aspect.icon || "✶";
    const aspectAngle = Number.isFinite(aspect.angle) ? `${aspect.angle}°` : "";
    const baseIcon = POINTS_ICONS[(base.name || "").toLowerCase()] || "✶";
    const otherIcon = POINTS_ICONS[(other.name || "").toLowerCase()] || "✶";
    return `
      <div class="adv-row adv-row-aspect">
        <div class="adv-aspect-grid">
          <div class="adv-aspect-cell">
            <span class="adv-chip">${baseIcon}</span>
            <div class="adv-aspect-text">
              <strong>${base.name || baseKey}</strong>
              <span class="adv-aspect-note">${baseSign.icon || ""} ${baseSign.name} ${basePos}</span>
            </div>
          </div>
          <div class="adv-aspect-cell">
            <span class="adv-chip">${aspectIcon}</span>
            <div class="adv-aspect-text">
              <strong>${aspectName}</strong>
              ${aspectAngle ? `<span class="adv-aspect-note">@ ${aspectAngle}</span>` : ""}
            </div>
          </div>
          <div class="adv-aspect-cell">
            <span class="adv-chip">${otherIcon}</span>
            <div class="adv-aspect-text">
              <strong>${other.name || otherKey}</strong>
              <span class="adv-aspect-note">${otherSign.icon || ""} ${otherSign.name} ${otherPos}</span>
            </div>
          </div>
          <div class="adv-aspect-cell adv-aspect-orb">
            <span class="adv-chip">Orb</span>
            <div class="adv-aspect-text">
              <strong>${orbLabel}</strong>
              <span class="adv-aspect-note">${aspectIcon} ${aspectName}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSection(title, inner, open = true) {
    return `
      <details class="adv-accordion"${open ? " open" : ""}>
        <summary>${title}</summary>
        <div class="adv-accordion-body">${inner}</div>
      </details>
    `;
  }

  function renderMetaHeader(data) {
    if (!dom.summaryEl) return;
    const title = data.title || data.name || "Chart";
    const city = data.city ? `${data.city}${data.nation ? `, ${data.nation}` : ""}` : "";
    const dateInfo = formatDateLabel(data);
    const tz = dateInfo.tzShort || "";
    return `
      <div class="adv-meta">
        <div>
          <p class="adv-meta-title">${title}</p>
          <p class="adv-meta-sub">${city || "Unknown location"}</p>
        </div>
        <div class="adv-meta-time">
          <p>${dateInfo.weekday || ""}</p>
          <p>${dateInfo.label || ""} ${tz ? `(${tz})` : ""}</p>
        </div>
      </div>
    `;
  }

  function renderPointRowProxy(point, opts) {
    return formatPointRow(point, opts);
  }

  function renderStructured(kind, payload) {
    if (!dom.summaryEl) return;
    const source = payload?.snapshot || payload?.subject || payload?.data || payload;
    const chart = source?.subject || source;
    if (!source || typeof source !== "object") {
      dom.summaryEl.innerHTML = "<p class=\"hint\">No data returned.</p>";
      console.warn("[advanced] renderStructured payload missing", { kind, payload });
      return;
    }

    const { points, houses } = collectPoints(chart);
    const natalSource = payload?.natal_subject || payload?.snapshot?.natal_subject;
    const natalCollected = natalSource ? collectPoints(natalSource) : { points: {}, houses: {} };
    const natalPoints = natalCollected.points || {};
    const ns = "AdvancedApp";
    const cfg =
      (window[ns]?.config?.getConfigFromInputs?.() || window[ns]?.constants?.DEFAULT_CONFIG) || {};
    const sourceActive = Array.isArray(chart.active_points) ? chart.active_points : [];
    const activePoints = (Array.isArray(cfg.active_points) ? cfg.active_points : sourceActive).filter(Boolean);
    const filteredPointKeys = resolveActivePointKeys(points, activePoints);

    const pointRows = filteredPointKeys
      .map((k) => renderPointRowProxy(points[k], { labelOverride: points[k]?.name || k }))
      .join("");
    const houseRows = Object.entries(houses)
      .map(([k, v]) => renderPointRowProxy(v, { labelOverride: formatHouseLabel(v.house || k) }))
      .join("");
    let aspects = computeAspectsShared(points, filteredPointKeys);
    if (!aspects.length) {
      const payloadAspects = chart.aspects || source.aspects || payload?.aspects || [];
      aspects = normalizeAspectRows(payloadAspects, points);
    }
    const aspectKeySet = aspects.reduce((set, a) => {
      set.add(a.baseKey);
      set.add(a.otherKey);
      return set;
    }, new Set());
    const matrixKeys = filteredPointKeys.filter((k) => aspectKeySet.has(k));
    const aspectRows = aspects.map(renderAspectRow).join("");
    const aspectMatrix = renderAspectMatrix(points, matrixKeys, aspects);
    const majorAspects = extractMajorAspects(payload);
    const natalMajorAspects = extractNatalMajorAspects(payload);
    const majorBlocks = [];
    if (majorAspects.length) {
      majorBlocks.push(
        renderMajorAspectsList(
          majorAspects,
          points,
          "Major Ptolemaic Aspect Configurations",
          "Geometric patterns detected for this chart.",
          true
        )
      );
    }
    if (natalMajorAspects.length) {
      majorBlocks.push(
        renderMajorAspectsList(
          natalMajorAspects,
          natalPoints,
          "Natal major aspect configurations",
          "Patterns detected from the provided natal chart.",
          majorBlocks.length === 0
        )
      );
    }
    const majorAspectsList = majorBlocks.join("");
    const aspectContent =
      aspectMatrix + majorAspectsList + (aspectRows || "<p class=\"hint\">No aspects found for active points.</p>");

    const metaSource =
      chart.birth ||
      chart.moment ||
      source.birth ||
      source.moment ||
      source.first ||
      payload?.birth ||
      payload?.moment ||
      chart;
    const meta = renderMetaHeader(metaSource);
    const sections = [
      renderSection("Aspects", aspectContent, true),
      renderSection("Points", pointRows || "<p class=\"hint\">No points returned.</p>", false),
      renderSection("Houses", houseRows || "<p class=\"hint\">No houses returned.</p>", false),
    ].join("");

    dom.summaryEl.innerHTML = `${meta}${sections}`;
    attachPatternModalHandlers();
  }

  function registerHandleSubmit() {
    const appCtx = (window.AdvancedApp = window.AdvancedApp || {});
    appCtx.handleSubmit = async function handleSubmit(event) {
      event.preventDefault();
      const { dom: advDom, utils: advUtils, payloads: advPayloads, state: advState } = window.AdvancedApp || {};
      if (!advDom || !advUtils || !advPayloads || !advState) {
        console.warn("[advanced] missing app pieces for submit", { hasDom: !!advDom, hasUtils: !!advUtils, hasPayloads: !!advPayloads, hasState: !!advState });
        return;
      }

      advUtils.setStatus?.("");
      advUtils.clearSummary?.();
      advUtils.clearChart?.();
      advUtils.clearReport?.();

      if (advDom.generateBtn) {
        advDom.generateBtn.disabled = true;
        advDom.generateBtn.textContent = "Generating…";
      }

      const mode = advUtils.getSelectedMode ? advUtils.getSelectedMode() : "natal";

      try {
        const { payload, birthDateParts, transitDateParts } = advPayloads.buildPayloadFromForm(mode);

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
            window.AdvancedApp.render?.renderNatalSummary?.(natalJson);
          } else if (advDom.summaryEl) {
            advDom.summaryEl.innerHTML = "<p>Unexpected response from natal endpoint – subject field not found.</p>";
          }
          advUtils.setStatus?.("Natal response loaded.");
          advState.saveFormState(mode, payload);
          advState.saveApiData(mode, { summary: advDom.summaryEl ? advDom.summaryEl.innerHTML : "" });
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
            window.AdvancedApp.render?.renderTransitSummary?.(transitJson);
          } else if (advDom.summaryEl) {
            advDom.summaryEl.innerHTML = "<p>Unexpected response from transit endpoint – snapshot not found.</p>";
          }
          advUtils.setStatus?.("Transit response loaded.");
          advState.saveFormState(mode, payload);
          advState.saveApiData(mode, { summary: advDom.summaryEl ? advDom.summaryEl.innerHTML : "" });
        } else if (mode === "natal_transit") {
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
            window.AdvancedApp.render?.renderCombinedSummary?.(transitJson);
          } else if (advDom.summaryEl) {
            advDom.summaryEl.innerHTML = "<p>Unexpected response from transit endpoint – snapshot not found.</p>";
          }
          advUtils.setStatus?.("Combined response loaded.");
          advState.saveFormState(mode, payload);
          advState.saveApiData(mode, { summary: advDom.summaryEl ? advDom.summaryEl.innerHTML : "" });
        } else {
          const synPayload = advPayloads.buildRelationshipPayload();
          const jsonResp = await fetch("/api/relationship", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(synPayload),
          });
          if (!jsonResp.ok) {
            const text = await jsonResp.text();
            throw new Error(`Relationship request failed: ${jsonResp.status} ${jsonResp.statusText} - ${text}`);
          }
          const relJson = await jsonResp.json();
          window.AdvancedApp.render?.renderRelationshipSummary?.(relJson);
          advUtils.setStatus?.("Relationship response loaded.");
          advState.saveFormState(mode, { ...payload, ...synPayload });
          advState.saveApiData(mode, { summary: advDom.summaryEl ? advDom.summaryEl.innerHTML : "" });
        }
      } catch (err) {
        advUtils.setStatus?.(err.message || "An error occurred while generating the chart.", true);
        console.error("[advanced] submit failed", err);
        if (advDom.summaryEl && !advDom.summaryEl.innerHTML) {
          advDom.summaryEl.innerHTML =
            "<p>Could not generate summary due to an error. Check the console for details.</p>";
        }
      } finally {
        if (advDom.generateBtn) {
          advDom.generateBtn.disabled = false;
          advDom.generateBtn.textContent = "Generate chart";
        }
        advUtils.updateDownloadState?.();
      }
    };
  }

  function overrideRenderers() {
    const app = window.AdvancedApp || {};
    if (!app.render) return;
    app.render.renderNatalSummary = (subject) => renderStructured("natal", subject);
    app.render.renderTransitSummary = (snapshot) => renderStructured("transit", snapshot);
    app.render.renderCombinedSummary = (snapshot) => renderStructured("combined", snapshot);
    app.render.renderRelationshipSummary = (data) => renderStructured("relationship", data);
  }

  function reveal() {
    const items = document.querySelectorAll("[data-fade-in]");
    items.forEach((item, idx) => {
      setTimeout(() => item.classList.add("visible"), 90 * (idx + 1));
    });
  }

  function init() {
    const range = loadRange();
    applyRange(range);

    if (dom.rangeStart) dom.rangeStart.addEventListener("change", handleRangeChange);
    if (dom.rangeEnd) dom.rangeEnd.addEventListener("change", handleRangeChange);
    if (dom.rangeNow) {
      dom.rangeNow.addEventListener("click", () => {
        const next = getDefaultRange();
        applyRange(next);
        saveRange(next);
      });
    }

    if (dom.apiCollapseBtn && dom.apiResponseBody) {
      dom.apiCollapseBtn.addEventListener("click", () => {
        const isHidden = dom.apiResponseBody.classList.toggle("hidden");
        dom.apiCollapseBtn.setAttribute("aria-expanded", isHidden ? "false" : "true");
        dom.apiCollapseBtn.setAttribute("aria-label", isHidden ? "Expand API panel" : "Collapse API panel");
        dom.apiCollapseBtn.innerHTML = isHidden
          ? '<svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 15l-6-6-6 6"/></svg>'
          : '<svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>';
      });
    }

    reveal();
  }

  registerHandleSubmit();
  overrideRenderers();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
