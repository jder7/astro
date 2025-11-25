(function () {
  const HomeApp = window.HomeApp || {};
  if (HomeApp.disabled) return;

  const { dom, constants, runtime, utils } = HomeApp;
  const { STORAGE_INPUT, STORAGE_API } = constants;

  function getDefaultState() {
    return { mode: "natal", natal: null, transit: null, relationship: null };
  }

  function getDefaultApiState() {
    return { svgs: {}, summaries: {}, reports: {} };
  }

  function saveFormState(mode, payload) {
    try {
      let state = getDefaultState();
      const raw = localStorage.getItem(STORAGE_INPUT);
      if (raw) state = { ...state, ...JSON.parse(raw) };

      state.mode = mode;
      if (payload.birth) state.natal = payload.birth;
      if (payload.moment) state.transit = payload.moment;
      if (payload.first && payload.second) {
        state.relationship = { first: payload.first, second: payload.second };
      }

      localStorage.setItem(STORAGE_INPUT, JSON.stringify(state));
    } catch (err) {
      console.warn("Could not save form state", err);
    }
  }

  function saveApiData(mode, data) {
    try {
      let state = getDefaultApiState();
      const raw = localStorage.getItem(STORAGE_API);
      if (raw) state = { ...state, ...JSON.parse(raw) };
      if (data.svg || data.summary) {
        state.svgs[mode] = { svg: data.svg || "", summary: data.summary || "" };
      }
      if (data.report) {
        state.reports[mode] = data.report;
      }
      if (data.summary) {
        state.summaries[mode] = data.summary;
      }
      localStorage.setItem(STORAGE_API, JSON.stringify(state));
      runtime.storedSvgs = state.svgs || {};
      runtime.storedSummaries = state.summaries || {};
      runtime.storedReports = state.reports || {};
    } catch (err) {
      console.warn("Could not save API state", err);
    }
  }

  function restoreSavedReport(mode) {
    if (!dom.reportContainer) return;
    const rep = runtime.storedReports[mode];
    if (rep) {
      dom.reportContainer.textContent = rep;
    } else {
      utils.clearReport();
    }
  }

  function restoreSavedPreview(mode) {
    const saved = runtime.storedSvgs[mode];
    if (saved && saved.svg) {
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
      const rawInput = localStorage.getItem(STORAGE_INPUT);
      const rawApi = localStorage.getItem(STORAGE_API);
      const state = rawInput ? { ...getDefaultState(), ...JSON.parse(rawInput) } : getDefaultState();
      const apiState = rawApi ? { ...getDefaultApiState(), ...JSON.parse(rawApi) } : getDefaultApiState();

      if (state.mode) {
        const target = dom.modeInputs.find((m) => m.value === state.mode);
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
      if (state.relationship) {
        const { first, second } = state.relationship;
        if (first) {
          setField("firstName", first.name || "");
          setField("firstDate", `${first.year}-${String(first.month).padStart(2, "0")}-${String(first.day).padStart(2, "0")}`);
          setField("firstTime", `${String(first.hour).padStart(2, "0")}:${String(first.minute).padStart(2, "0")}`);
          setField("firstLat", first.lat);
          setField("firstLng", first.lng);
          setField("firstTz", first.tz_str);
          setField("firstCity", first.city);
          setField("firstNation", first.nation);
        }
        if (second) {
          setField("secondName", second.name || "");
          setField("secondDate", `${second.year}-${String(second.month).padStart(2, "0")}-${String(second.day).padStart(2, "0")}`);
          setField("secondTime", `${String(second.hour).padStart(2, "0")}:${String(second.minute).padStart(2, "0")}`);
          setField("secondLat", second.lat);
          setField("secondLng", second.lng);
          setField("secondTz", second.tz_str);
          setField("secondCity", second.city);
          setField("secondNation", second.nation);
        }
      }
      runtime.storedSvgs = apiState.svgs || {};
      runtime.storedSummaries = apiState.summaries || {};
      runtime.storedReports = apiState.reports || {};
      runtime.hasLoadedState = true;
    } catch (err) {
      console.warn("Could not load saved form state", err);
    }
  }

  function restoreSavedModeState() {
    return;
  }

  function setField(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
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
        configHouse: "W",
      };
      Object.entries(resetInputs).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      });
      const natalRadio = document.querySelector('input[name="mode"][value="natal"]');
      if (natalRadio) natalRadio.checked = true;
      updateModeVisibility();
      utils.setStatus("Local state cleared.");
    } catch (err) {
      console.warn("Could not clear state", err);
      utils.setStatus("Failed to clear saved state.", true);
    }
  }

  function init() {
    dom.modeInputs.forEach((input) => {
      input.addEventListener("change", updateModeVisibility);
    });
    loadSavedState();
    updateModeVisibility();
  }

  window.clearSavedState = clearSavedState;

  HomeApp.state = {
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
