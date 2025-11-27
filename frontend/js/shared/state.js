(function () {
  const ns = window.AppNamespace || "HomeApp";
  const App = (window[ns] = window[ns] || {});
  if (App.disabled) return;

  const { dom, constants, runtime, utils } = App;
  const { STORAGE_INPUT, STORAGE_API } = constants;

  function readStoredState(key, fallback) {
    const base = { ...fallback };
    const raw = localStorage.getItem(key);
    if (!raw) return { state: base, hasData: false };
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const merged = { ...base, ...parsed };
        const hasData = Object.keys(parsed).length > 0;
        return { state: merged, hasData };
      }
    } catch (err) {
    }
    localStorage.removeItem(key);
    return { state: base, hasData: false };
  }

  function getDefaultState() {
    return { mode: "natal", natal: null, transit: null, relationship: null };
  }

  function getDefaultApiState() {
    return { svgs: {}, summaries: {}, reports: {} };
  }

  function saveFormState(mode, payload) {
    try {
      const { state: existing } = readStoredState(STORAGE_INPUT, getDefaultState());
      const next = { ...existing, mode };
      if (payload.birth) next.natal = payload.birth;
      if (payload.moment) next.transit = payload.moment;
      if (payload.first && payload.second) {
        next.relationship = { first: payload.first, second: payload.second };
      }

      localStorage.setItem(STORAGE_INPUT, JSON.stringify(next));
      runtime.hasLoadedState = true;
    } catch (err) {
    }
  }

  function saveApiData(mode, data) {
    try {
      const { state: existing } = readStoredState(STORAGE_API, getDefaultApiState());
      const next = { ...existing };
      next.svgs = next.svgs && typeof next.svgs === "object" ? next.svgs : {};
      next.summaries = next.summaries && typeof next.summaries === "object" ? next.summaries : {};
      next.reports = next.reports && typeof next.reports === "object" ? next.reports : {};
      if (data.svg || data.summary) {
        next.svgs[mode] = { svg: data.svg || "", summary: data.summary || "" };
      }
      if (data.report) {
        next.reports[mode] = data.report;
      }
      if (data.summary) {
        next.summaries[mode] = data.summary;
      }
      if (data.report && typeof data.report === "object" && data.report.text) {
        next.reports[mode] = { text: data.report.text, title: data.report.title || null };
      } else if (data.report) {
        next.reports[mode] = data.report;
      }
      localStorage.setItem(STORAGE_API, JSON.stringify(next));
      runtime.storedSvgs = next.svgs || {};
      runtime.storedSummaries = next.summaries || {};
      runtime.storedReports = next.reports || {};
      runtime.hasLoadedState = true;
    } catch (err) {
    }
  }

  function normalizeReport(rep) {
    if (!rep) return null;
    if (typeof rep === "string") return { text: rep, title: null };
    if (typeof rep === "object") {
      const text = rep.text || rep.body || "";
      const title = rep.title || null;
      return { text, title };
    }
    return null;
  }

  function restoreSavedReport(mode) {
    const target = dom.reportContent || dom.reportContainer;
    if (!target) return;
    const repData = normalizeReport(runtime.storedReports[mode]);
    if (repData) {
      const renderMarkdown =
        utils && typeof utils.renderReportMarkdown === "function"
          ? utils.renderReportMarkdown
          : (el, content) => {
              if (el) el.textContent = content || "";
            };
      renderMarkdown(target, repData.text);
      if (utils && typeof utils.setReportTitle === "function") {
        utils.setReportTitle(repData.title);
      }
    } else {
      utils.clearReport();
    }
  }

  function restoreSavedPreview(mode) {
    const saved = runtime.storedSvgs[mode];
    if (saved && saved.svg && dom.chartContainer) {
      dom.chartContainer.innerHTML = saved.svg;
      if (dom.summaryEl) {
        dom.summaryEl.innerHTML = saved.summary || "";
      }
      runtime.hasChart = true;
    } else {
      utils.clearSummary();
      utils.clearChart();
    }
    restoreSavedReport(mode);
    utils.updateDownloadState();
  }

  function loadSavedState() {
    try {
      const { state, hasData: hasInputState } = readStoredState(STORAGE_INPUT, getDefaultState());
      const { state: apiState, hasData: hasApiState } = readStoredState(STORAGE_API, getDefaultApiState());

      if (hasInputState && state.mode) {
        const target = dom.modeInputs.find((m) => m.value === state.mode);
        if (target) target.checked = true;
      }
      const natal = state.natal && typeof state.natal === "object" ? state.natal : null;
      if (hasInputState && natal) {
        const b = natal;
        setField("name", b.name || "");
        setField("dateInput", `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`);
        setField("timeInput", `${String(b.hour).padStart(2, "0")}:${String(b.minute).padStart(2, "0")}`);
        setField("lat", b.lat);
        setField("lng", b.lng);
        setField("tz_str", b.tz_str);
        setField("city", b.city);
        setField("nation", b.nation);
      }
      const transit = state.transit && typeof state.transit === "object" ? state.transit : null;
      if (hasInputState && transit) {
        const t = transit;
        setField("transitDateInput", `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`);
        setField("transitTimeInput", `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`);
        setField("transitLat", t.lat);
        setField("transitLng", t.lng);
        setField("transitTz", t.tz_str);
        setField("transitCity", t.city);
        setField("transitNation", t.nation);
      }
      const relationship = state.relationship && typeof state.relationship === "object" ? state.relationship : null;
      if (hasInputState && relationship) {
        const safeFirst =
          relationship.first && typeof relationship.first === "object" ? relationship.first : null;
        if (safeFirst) {
          setField("firstName", safeFirst.name || "");
          setField("firstDate", `${safeFirst.year}-${String(safeFirst.month).padStart(2, "0")}-${String(safeFirst.day).padStart(2, "0")}`);
          setField("firstTime", `${String(safeFirst.hour).padStart(2, "0")}:${String(safeFirst.minute).padStart(2, "0")}`);
          setField("firstLat", safeFirst.lat);
          setField("firstLng", safeFirst.lng);
          setField("firstTz", safeFirst.tz_str);
          setField("firstCity", safeFirst.city);
          setField("firstNation", safeFirst.nation);
        }
        const safeSecond =
          relationship.second && typeof relationship.second === "object" ? relationship.second : null;
        if (safeSecond) {
          setField("secondName", safeSecond.name || "");
          setField("secondDate", `${safeSecond.year}-${String(safeSecond.month).padStart(2, "0")}-${String(safeSecond.day).padStart(2, "0")}`);
          setField("secondTime", `${String(safeSecond.hour).padStart(2, "0")}:${String(safeSecond.minute).padStart(2, "0")}`);
          setField("secondLat", safeSecond.lat);
          setField("secondLng", safeSecond.lng);
          setField("secondTz", safeSecond.tz_str);
          setField("secondCity", safeSecond.city);
          setField("secondNation", safeSecond.nation);
        }
      }
      runtime.storedSvgs = apiState.svgs && typeof apiState.svgs === "object" ? apiState.svgs : {};
      runtime.storedSummaries = apiState.summaries && typeof apiState.summaries === "object" ? apiState.summaries : {};
      runtime.storedReports = apiState.reports && typeof apiState.reports === "object" ? apiState.reports : {};
      const hasSavedApi =
        hasApiState &&
        (Object.keys(runtime.storedSvgs).length ||
          Object.keys(runtime.storedSummaries).length ||
          Object.keys(runtime.storedReports).length);
      runtime.hasLoadedState = hasInputState || hasSavedApi;
      if (App.utils && typeof App.utils.syncLocationRuntimeFromDom === "function") {
        App.utils.syncLocationRuntimeFromDom();
      }
      if (App.utils && typeof App.utils.refreshDateTimeBadges === "function") {
        App.utils.refreshDateTimeBadges();
      }
      if (App.utils && typeof App.utils.refreshLocationBadges === "function") {
        App.utils.refreshLocationBadges();
      }
    } catch (err) {
    }
  }

  function restoreSavedModeState() {
    return;
  }

  function setField(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? "";
  }

  function updateModeVisibility() {
    const mode = utils.getSelectedMode();
    const showBirth = mode !== "transit" && mode !== "relationship";
    const showTransit = mode !== "natal" && mode !== "relationship";
    const relationshipSection = document.getElementById("relationshipSection");

    if (dom.birthSection) dom.birthSection.style.display = showBirth ? "" : "none";
    if (dom.transitSection) dom.transitSection.style.display = showTransit ? "" : "none";
    if (relationshipSection) relationshipSection.style.display = mode === "relationship" ? "" : "none";
    if (dom.nameRow) dom.nameRow.style.display = mode === "transit" ? "none" : "";

    if (showTransit && mode !== "natal") {
      utils.setTransitNow();
    }
    restoreSavedModeState(mode);
    restoreSavedPreview(mode);
    if (App.utils && typeof App.utils.refreshDateTimeBadges === "function") {
      App.utils.refreshDateTimeBadges();
    }
    if (App.utils && typeof App.utils.refreshLocationBadges === "function") {
      App.utils.refreshLocationBadges();
    }
  }

  function bindFormPersistence() {
    if (!dom.form || !utils || typeof utils.persistFormState !== "function") return;
    let persistTimer = null;
    const schedulePersist = () => {
      clearTimeout(persistTimer);
      persistTimer = setTimeout(() => {
        try {
          utils.persistFormState();
        } catch (err) {
        }
      }, 200);
    };
    dom.form.addEventListener("input", schedulePersist);
    dom.form.addEventListener("change", schedulePersist);
  }

  function clearSavedState() {
    try {
      localStorage.removeItem(STORAGE_INPUT);
      localStorage.removeItem(STORAGE_API);
      utils.clearSummary();
      utils.clearChart();
      utils.clearReport();
      runtime.storedSvgs = {};
      runtime.storedSummaries = {};
      runtime.storedReports = {};
      runtime.hasChart = false;
      runtime.hasLoadedState = false;
      if (App.runtime) {
        App.runtime.locationValues = {};
      }
      const resetInputs = {
        name: "Subject",
        dateInput: "1990-01-01",
        timeInput: "12:00",
        lat: "52.3702",
        lng: "4.8952",
        tz_str: "Europe/Amsterdam",
        city: "Amsterdam",
        nation: "NL",
        transitDateInput: "2025-01-01",
        transitTimeInput: "12:00",
        transitLat: "52.3702",
        transitLng: "4.8952",
        transitTz: "Europe/Amsterdam",
        transitCity: "Amsterdam",
        transitNation: "NL",
        firstName: "Partner A",
        firstDate: "1990-01-01",
        firstTime: "12:00",
        firstLat: "52.3702",
        firstLng: "4.8952",
        firstTz: "Europe/Amsterdam",
        firstCity: "Amsterdam",
        firstNation: "NL",
        secondName: "Partner B",
        secondDate: "1992-02-02",
        secondTime: "14:00",
        secondLat: "40.7128",
        secondLng: "-74.006",
        secondTz: "America/New_York",
        secondCity: "New York",
        secondNation: "US",
        configTheme: "dark",
        configZodiac: "Sidereal",
        configPerspective: "Topocentric",
        configSiderealMode: "KRISHNAMURTI",
        configHouse: "P",
      };
      Object.entries(resetInputs).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      });
      const natalRadio = document.querySelector('input[name="mode"][value="natal"]');
      if (natalRadio) natalRadio.checked = true;
      updateModeVisibility();
      if (App.utils && typeof App.utils.refreshDateTimeBadges === "function") {
        App.utils.refreshDateTimeBadges();
      }
      if (App.utils && typeof App.utils.refreshLocationBadges === "function") {
        App.utils.refreshLocationBadges();
      }
      if (App.utils && typeof App.utils.syncLocationRuntimeFromDom === "function") {
        App.utils.syncLocationRuntimeFromDom();
      }
      utils.setStatus("Local state cleared.");
    } catch (err) {
      utils.setStatus("Failed to clear saved state.", true);
    }
  }

  function init() {
    dom.modeInputs.forEach((input) => {
      input.addEventListener("change", updateModeVisibility);
    });
    bindFormPersistence();
    loadSavedState();
    updateModeVisibility();
  }

  window.clearSavedState = clearSavedState;

  App.state = {
    getDefaultState,
    getDefaultApiState,
    saveFormState,
    saveApiData,
    restoreSavedPreview,
    restoreSavedReport,
    loadSavedState,
    clearSavedState,
    updateModeVisibility,
    init,
  };
})();
