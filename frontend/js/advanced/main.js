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
  const { SIGN_META, ELEMENT_ICON, QUALITY_ICON, POINTS_ICONS, ASPECTS,  emojiNumber, formatHouseLabel, formatHouseLabelShort, formatDateLabel, capitalise } = shared;
  const flags = (app.flags = { ...(app.flags || {}), skipSvg: true });
  console.info("[advanced] main init", { ns, skipSvg: flags.skipSvg });

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

  function classifyAspect(diff) {
    for (const asp of ASPECTS) {
      const delta = Math.abs(diff - asp.angle);
      if (delta <= asp.orb) return { ...asp, orb: delta };
    }
    return null;
  }

  function computeAspects(points, activeKeys) {
    const keys = activeKeys.length ? activeKeys : Object.keys(points);
    const list = [];
    const keySet = new Set(keys);
    keys.forEach((baseKey, idx) => {
      const base = points[baseKey];
      if (!base || !Number.isFinite(base.abs_pos)) return;
      for (let j = idx + 1; j < keys.length; j++) {
        const otherKey = keys[j];
        const other = points[otherKey];
        if (!other || !Number.isFinite(other.abs_pos)) continue;
        const diff = Math.abs(base.abs_pos - other.abs_pos) % 360;
        const aspect = classifyAspect(diff > 180 ? 360 - diff : diff);
        if (aspect) {
          list.push({ baseKey, otherKey, aspect, base, other });
        }
      }
    });
    return list.sort((a, b) => a.aspect.orb - b.aspect.orb);
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
    const title = data.title || "Chart";
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
    const source = payload?.subject || payload?.snapshot || payload?.data || payload;
    if (!source || typeof source !== "object") {
      dom.summaryEl.innerHTML = "<p class=\"hint\">No data returned.</p>";
      console.warn("[advanced] renderStructured payload missing", { kind, payload });
      return;
    }

    const { points, houses } = collectPoints(source);
    const ns = "AdvancedApp";
    const cfg =
      (window[ns]?.config?.getConfigFromInputs?.() || window[ns]?.constants?.DEFAULT_CONFIG) || {};
    const sourceActive = Array.isArray(source.active_points) ? source.active_points : [];
    const activePoints = (Array.isArray(cfg.active_points) ? cfg.active_points : sourceActive).filter(Boolean);
    const filteredPointKeys = activePoints.length
      ? Object.keys(points).filter((k) => activePoints.includes(k))
      : Object.keys(points);

    const pointRows = filteredPointKeys
      .map((k) => renderPointRowProxy(points[k], { labelOverride: points[k]?.name || k }))
      .join("");
    const houseRows = Object.entries(houses)
      .map(([k, v]) => renderPointRowProxy(v, { labelOverride: formatHouseLabel(v.house || k) }))
      .join("");
    const aspects = computeAspects(points, filteredPointKeys);
    const aspectKeySet = aspects.reduce((set, a) => {
      set.add(a.baseKey);
      set.add(a.otherKey);
      return set;
    }, new Set());
    const matrixKeys = filteredPointKeys.filter((k) => aspectKeySet.has(k));
    const aspectRows = aspects.map(renderAspectRow).join("");
    const aspectMatrix = renderAspectMatrix(points, matrixKeys, aspects);
    const aspectContent =
      aspectMatrix + (aspectRows || "<p class=\"hint\">No aspects found for active points.</p>");

    const metaSource = source.birth || source.moment || source.first || source;
    const meta = renderMetaHeader(metaSource);
    const sections = [
      renderSection("Aspects", aspectContent, true),
      renderSection("Points", pointRows || "<p class=\"hint\">No points returned.</p>", false),
      renderSection("Houses", houseRows || "<p class=\"hint\">No houses returned.</p>", false),
    ].join("");

    dom.summaryEl.innerHTML = `${meta}${sections}`;
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
            window.AdvancedApp.render?.renderNatalSummary?.(natalJson.subject, birthDateParts);
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
            window.AdvancedApp.render?.renderTransitSummary?.(transitJson.snapshot, transitDateParts);
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
            window.AdvancedApp.render?.renderCombinedSummary?.(transitJson.snapshot, birthDateParts, transitDateParts);
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
