(function () {
  const ns = window.AppNamespace || "EsotericApp";
  const app = (window[ns] = window[ns] || {});
  if (app.disabled) return;

  app.constants = {
    ...(app.constants || {}),
    STORAGE_INPUT: (app.constants && app.constants.STORAGE_INPUT) || "astroInputState",
    STORAGE_CONFIG: (app.constants && app.constants.STORAGE_CONFIG) || "astroConfig",
    STORAGE_API: "astroApiStateEsoteric",
  };

  const dom = (app.dom = app.dom || {});
  dom.summaryEl = dom.summaryEl || document.getElementById("summaryContent");
  dom.skyMapContent = document.getElementById("skyMapContent");
  dom.futureVisionContent = document.getElementById("futureVisionContent");

  const { utils = {}, payloads = {}, state = {} } = app;
  const shared = window.AppShared || {};
  const {
    SIGN_META = {},
    ELEMENT_ICON = {},
    QUALITY_ICON = {},
    POINTS_ICONS = {},
    CHALDEAN_DAY_RULERS = {},
    buildElementPentagram,
    capitalise = (v) => v,
  } = shared;

  const QUALITY_MAP = {
    Cardinal: { label: "Motion", className: "eso-quality-motion" },
    Fixed: { label: "Consciousness", className: "eso-quality-consciousness" },
    Mutable: { label: "Matter", className: "eso-quality-matter" },
  };
  const ELEMENT_NUMBERS = { Air: 46, Fire: 47, Water: 48, Earth: 49 };
  const DECAN_META = {
    1: { label: "Physical", className: "eso-decan eso-decan-physical" },
    2: { label: "Emotional", className: "eso-decan eso-decan-emotional" },
    3: { label: "Mental", className: "eso-decan eso-decan-mental" },
  };

  const pad = (v) => String(v || 0).padStart(2, "0");
  const safeDate = (value) => {
    if (value instanceof Date && Number.isFinite(value.getTime())) return value;
    if (typeof value === "string" || typeof value === "number") {
      const d = new Date(value);
      if (Number.isFinite(d.getTime())) return d;
    }
    return null;
  };

  const toDatePartsFromSubject = (subject) => {
    if (!subject || typeof subject !== "object") return null;
    const keys = ["year", "month", "day", "hour", "minute"];
    const hasDirect = keys.every((k) => Number.isFinite(Number(subject[k])));
    if (hasDirect) {
      return {
        year: Number(subject.year),
        month: Number(subject.month),
        day: Number(subject.day),
        hour: Number(subject.hour) || 0,
        minute: Number(subject.minute) || 0,
      };
    }
    const iso = subject.iso_formatted_local_datetime || subject.iso_formatted_utc_datetime || subject.timestamp;
    const parsed = safeDate(iso);
    if (parsed) {
      return {
        year: parsed.getFullYear(),
        month: parsed.getMonth() + 1,
        day: parsed.getDate(),
        hour: parsed.getHours(),
        minute: parsed.getMinutes(),
      };
    }
    return null;
  };

  const getDayRulerFromParts = (parts) => {
    if (!parts) return null;
    const { year, month, day, hour = 12, minute = 0 } = parts;
    if (![year, month, day].every((n) => Number.isFinite(Number(n)))) return null;
    try {
      const date = new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);
      return CHALDEAN_DAY_RULERS ? CHALDEAN_DAY_RULERS[date.getDay()] || null : null;
    } catch (err) {
      return null;
    }
  };

  const computeDecan = (position) => {
    if (!Number.isFinite(position)) return null;
    return Math.max(1, Math.min(3, Math.floor(position / 10) + 1));
  };

  const pickPoint = (points, key) => {
    if (!points || !key) return null;
    if (points[key]) return points[key];
    const lowerKey = String(key).toLowerCase();
    const entry = Object.entries(points).find(([k]) => String(k).toLowerCase() === lowerKey);
    return entry ? entry[1] : null;
  };

  const summarizePoint = (point) => {
    if (!point || typeof point !== "object") return null;
    const pos =
      typeof point.position === "number"
        ? point.position
        : typeof point.orb === "number"
          ? point.orb
          : typeof point.abs_pos === "number"
            ? point.abs_pos % 30
            : null;
    return {
      sign: point.sign || null,
      quality: point.quality || null,
      element: point.element || null,
      orb: pos,
      decan: computeDecan(pos),
      emoji: point.emoji,
    };
  };

  const formatDateLabel = (parts, subject) => {
    if (parts && [parts.year, parts.month, parts.day].every((n) => Number.isFinite(Number(n)))) {
      const label = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
      const time = `${pad(parts.hour)}:${pad(parts.minute)}`;
      return `${label} ${time}`.trim();
    }
    const fallback = safeDate(subject?.iso_formatted_local_datetime || subject?.timestamp);
    if (fallback) {
      return `${fallback.getFullYear()}-${pad(fallback.getMonth() + 1)}-${pad(fallback.getDate())} ${pad(fallback.getHours())}:${pad(fallback.getMinutes())}`;
    }
    return "Requested datetime";
  };

  const renderSigil = (points, dayKey) => {
    if (typeof buildElementPentagram !== "function") return "";
    const dayPoint = dayKey ? pickPoint(points, dayKey) : null;
    return buildElementPentagram({
      sunElement: points?.sun?.element || null,
      moonElement: points?.moon?.element || null,
      ascElement: points?.ascendant?.element || null,
      dayElement: dayPoint?.element || null,
      dayRulerKey: dayKey || null,
      size: 108,
      label: "Elementals",
      compact: true,
      className: "adv-summary-sigil",
    });
  };

  const formatSummaryRow = (label, icon, data, extras = "") => {
    const signMeta = SIGN_META[data.sign] || { name: data.sign || "—", icon: data.emoji || "" };
    const decanMeta = DECAN_META[data.decan] || null;
    const orbText = Number.isFinite(data.orb) ? `${Math.round(data.orb)}°` : "";
    const qualityMeta = QUALITY_MAP[data.quality] || {};
    const qualityText = data.quality ? qualityMeta.label || data.quality : "—";
    const qualityClass = qualityMeta.className || "eso-quality-muted";
    const elementNumber = ELEMENT_NUMBERS[data.element] || null;
    const elementIcon = ELEMENT_ICON[data.element] || "";
    const qualityIcon = QUALITY_ICON[data.quality] || "";
    const elementText = data.element
      ? `${elementIcon ? `${elementIcon} ` : ""}${data.element}${elementNumber ? ` (${elementNumber})` : ""}`
      : "—";
    const decanText = decanMeta
      ? `<span class="${decanMeta.className}">${decanMeta.label}</span>${orbText ? ` (${orbText})` : ""}`
      : "—";
    return `
      <div class="adv-summary-row eso-summary-row">
        <div class="adv-summary-label">${icon || ""}<span>${label}</span></div>
        <div class="adv-summary-values">
          <span>${signMeta.icon ? `${signMeta.icon} ` : ""}${signMeta.name || "—"}</span>
          <span>${decanText}</span>
          <span class="${qualityClass}">${qualityIcon ? `${qualityIcon} ` : ""}${qualityText}</span>
          <span>${elementText}</span>
          ${extras ? `<span class="adv-summary-extra">${extras}</span>` : ""}
        </div>
      </div>
    `;
  };

  const buildSummaryCard = (subject, label, contextParts) => {
    if (!subject || typeof subject !== "object") return "";
    const sunData = subject.sun ? summarizePoint(subject.sun) : null;
    const moonData = subject.moon ? summarizePoint(subject.moon) : null;
    const ascData = subject.ascendant ? summarizePoint(subject.ascendant) : null;
    const parts = contextParts || toDatePartsFromSubject(subject) || {};
    const dayKey = getDayRulerFromParts(parts);
    const dayPoint = dayKey ? pickPoint(subject, dayKey) : null;
    const dayData = dayPoint ? summarizePoint(dayPoint) : null;
    const cardLabel = label || subject.name || "Chart";
    const dateLabel = formatDateLabel(parts, subject);
    const rows = [
      sunData ? formatSummaryRow("Sun", POINTS_ICONS.sun || "☉", sunData) : "",
      moonData ? formatSummaryRow("Moon", POINTS_ICONS.moon || "☾", moonData) : "",
      dayData
        ? formatSummaryRow(capitalise(dayKey || "Day"), POINTS_ICONS[dayKey] || "☉", dayData)
        : "",
      ascData ? formatSummaryRow("Asc", POINTS_ICONS.ascendant || "↗", ascData) : "",
    ]
      .filter(Boolean)
      .join("");
    if (!rows) return "";
    const sigil = renderSigil(subject, dayKey);
    const slug = (cardLabel || 'card').toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `
      <div class="adv-summary-card" id="eso-summary-${slug}">
        <div class="adv-summary-head">
          <div>
            <p class="adv-asc-kicker">Day Ruler · ${dayKey ? capitalise(dayKey) : "—"}</p>
            <p class="adv-asc-sub">${dateLabel}</p>
          </div>
          <div class="adv-summary-head-meta">
            <span class="adv-asc-pill">${cardLabel}</span>
            ${sigil ? `<div class="adv-summary-figure">${sigil}</div>` : ""}
          </div>
        </div>
        <div class="adv-summary-grid">
          ${rows}
        </div>
      </div>
    `;
  };

  const collectSubjects = (payload, mode, context = {}) => {
    const cards = [];
    const pushSubject = (subject, label, dateParts) => {
      if (!subject) return;
      const html = buildSummaryCard(subject, label, dateParts);
      if (html) cards.push(html);
    };

    if (payload?.subject) pushSubject(payload.subject, payload.subject.name || "Natal", context.birthDateParts);
    if (payload?.snapshot?.subject)
      pushSubject(payload.snapshot.subject, payload.snapshot.subject.name || "Transit", context.transitDateParts);
    if (payload?.snapshot?.natal_subject)
      pushSubject(payload.snapshot.natal_subject, payload.snapshot.natal_subject.name || "Natal", context.birthDateParts);
    if (payload?.first_subject)
      pushSubject(payload.first_subject, payload.first_subject.name || "Partner A", context.firstDateParts);
    if (payload?.second_subject)
      pushSubject(payload.second_subject, payload.second_subject.name || "Partner B", context.secondDateParts);

    // Fallback for unknown payloads
    if (!cards.length && payload && typeof payload === "object") {
      pushSubject(payload, payload.name || capitalise(mode || "Chart"), context.birthDateParts || context.transitDateParts);
    }

    return cards;
  };

  const ensurePlaceholders = () => {
    if (dom.summaryEl && !dom.summaryEl.innerHTML.trim()) {
      dom.summaryEl.innerHTML = '<p class="hint">Generate any mode to view the esoteric summary.</p>';
    }
    if (dom.skyMapContent && !dom.skyMapContent.innerHTML.trim()) {
      dom.skyMapContent.innerHTML = '<p class="hint">Sky map placeholder. It refreshes with each mode and clears with the clean button.</p>';
    }
    if (dom.futureVisionContent && !dom.futureVisionContent.innerHTML.trim()) {
      dom.futureVisionContent.innerHTML = '<p class="hint">Future vision map placeholder. Responses are still cached per mode.</p>';
    }
  };

  const renderSummary = (mode, payload, context = {}) => {
    const cards = collectSubjects(payload, mode, context);
    if (dom.summaryEl) {
      dom.summaryEl.innerHTML = cards.length
        ? `<div class="adv-summary-wrap">${cards.join("")}</div>`
        : '<p class="hint">No summary available for this mode.</p>';
    }
    if (dom.skyMapContent) {
      dom.skyMapContent.innerHTML =
        '<p class="hint">Sky map placeholder. It refreshes with each mode and clears with the clean button.</p>';
    }
    if (dom.futureVisionContent) {
      dom.futureVisionContent.innerHTML =
        '<p class="hint">Future vision map placeholder. Responses are still cached per mode.</p>';
    }
    ensurePlaceholders();
  };

  const persistApiState = (mode, payload, context = {}) => {
    if (!state || typeof state.saveApiData !== "function") return;
    const summaryHtml = dom.summaryEl ? dom.summaryEl.innerHTML : "";
    state.saveApiData(mode, { summary: summaryHtml, response: { data: payload, context } });
  };

  const renderStoredResponse = (mode, stored) => {
    const payload = stored?.data || stored;
    const ctx = stored?.context || {};
    if (!payload) {
      ensurePlaceholders();
      return;
    }
    renderSummary(mode, payload, ctx);
    utils.setStatus?.("Restored last saved esoteric response.");
  };

  app.render = {
    renderNatalSummary: (resp, ctx = {}) => renderSummary("natal", resp, ctx),
    renderTransitSummary: (resp, ctx = {}) => renderSummary("transit", resp, ctx),
    renderCombinedSummary: (resp, ctx = {}) => renderSummary("natal_transit", resp, ctx),
    renderRelationshipSummary: (resp, ctx = {}) => renderSummary("relationship", resp, ctx),
    renderStoredResponse,
  };

  app.registerHandleSubmit = function registerHandleSubmit() {
    app.handleSubmit = async function handleSubmit(event) {
      event.preventDefault();
      utils.setStatus?.("");
      utils.clearSummary?.();
      utils.clearChart?.();
      utils.clearReport?.();

      if (dom.generateBtn) {
        dom.generateBtn.disabled = true;
        dom.generateBtn.textContent = "Generating…";
      }

      const mode = utils.getSelectedMode ? utils.getSelectedMode() : "natal";

      try {
        const { payload, birthDateParts, transitDateParts } = payloads.buildPayloadFromForm(mode);
        const context = { birthDateParts, transitDateParts };
        if (mode === "natal") {
          const resp = await fetch("/api/natal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!resp.ok) {
            const text = await resp.text();
            throw new Error(text || resp.statusText);
          }
          const natalJson = await resp.json();
          renderSummary(mode, natalJson, context);
          utils.setStatus?.("Natal response loaded.");
          state.saveFormState?.(mode, payload);
          persistApiState(mode, natalJson, context);
          utils.hideInputPanelOnMobile?.();
        } else if (mode === "transit") {
          const resp = await fetch("/api/transit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!resp.ok) {
            const text = await resp.text();
            throw new Error(text || resp.statusText);
          }
          const transitJson = await resp.json();
          renderSummary(mode, transitJson, context);
          utils.setStatus?.("Transit response loaded.");
          state.saveFormState?.(mode, payload);
          persistApiState(mode, transitJson, context);
          utils.hideInputPanelOnMobile?.();
        } else if (mode === "natal_transit") {
          const resp = await fetch("/api/transit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!resp.ok) {
            const text = await resp.text();
            throw new Error(text || resp.statusText);
          }
          const dualJson = await resp.json();
          renderSummary(mode, dualJson, context);
          utils.setStatus?.("Dual-wheel response loaded.");
          state.saveFormState?.(mode, payload);
          persistApiState(mode, dualJson, context);
          utils.hideInputPanelOnMobile?.();
        } else {
          const synPayload = payloads.buildRelationshipPayload();
          const resp = await fetch("/api/relationship", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(synPayload),
          });
          if (!resp.ok) {
            const text = await resp.text();
            throw new Error(text || resp.statusText);
          }
          const relJson = await resp.json();
          const relContext = {
            firstDateParts: synPayload.first,
            secondDateParts: synPayload.second,
          };
          renderSummary(mode, relJson, relContext);
          utils.setStatus?.("Relationship response loaded.");
          state.saveFormState?.(mode, { ...payload, ...synPayload });
          persistApiState(mode, relJson, relContext);
          utils.hideInputPanelOnMobile?.();
        }
      } catch (err) {
        utils.setStatus?.(err.message || "An error occurred while generating the chart.", true);
        if (dom.summaryEl && !dom.summaryEl.innerHTML) {
          dom.summaryEl.innerHTML = "<p>Could not generate summary due to an error.</p>";
        }
      } finally {
        if (dom.generateBtn) {
          dom.generateBtn.disabled = false;
          dom.generateBtn.textContent = "Generate chart";
        }
        utils.updateDownloadState?.();
        ensurePlaceholders();
      }
    };
  };

  const reveal = () => {
    const items = document.querySelectorAll("[data-fade-in]");
    items.forEach((item, idx) => {
      setTimeout(() => item.classList.add("visible"), 90 * (idx + 1));
    });
  };

  const bindPlaceholderRefresh = () => {
    if (Array.isArray(dom.modeInputs)) {
      dom.modeInputs.forEach((input) => {
        input.addEventListener("change", () => setTimeout(ensurePlaceholders, 0));
      });
    }
    if (dom.clearStateBtn) {
      dom.clearStateBtn.addEventListener("click", () => setTimeout(ensurePlaceholders, 0));
    }
  };

  ensurePlaceholders();
  bindPlaceholderRefresh();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ensurePlaceholders();
      reveal();
    });
  } else {
    ensurePlaceholders();
    reveal();
  }
})();
