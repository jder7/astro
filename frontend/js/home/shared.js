(function () {
  const HomeApp = (window.HomeApp = window.HomeApp || {});

  const dom = {
    form: document.getElementById("natalForm"),
    chartContainer: document.getElementById("chartContainer"),
    statusEl: document.getElementById("status"),
    generateBtn: document.getElementById("generateBtn"),
    summaryEl: document.getElementById("summaryContent"),
    modeInputs: Array.from(document.querySelectorAll('input[name="mode"]')),
    nameRow: document.getElementById("nameRow"),
    birthSection: document.getElementById("birthSection"),
    transitSection: document.getElementById("transitSection"),
    transitDateInput: document.getElementById("transitDateInput"),
    transitTimeInput: document.getElementById("transitTimeInput"),
    configPanel: document.getElementById("configPanel"),
    configToggle: document.getElementById("configToggle"),
    configClose: document.getElementById("configClose"),
    downloadBtn: document.getElementById("downloadPdfBtn"),
    zoomBtn: document.getElementById("zoomBtn"),
    svgModal: document.getElementById("svgModal"),
    svgModalBody: document.getElementById("svgModalBody"),
    svgModalClose: document.getElementById("svgModalClose"),
    svgZoomIn: document.getElementById("svgZoomIn"),
    svgZoomOut: document.getElementById("svgZoomOut"),
    loadReportBtn: document.getElementById("loadReportBtn"),
    reportContainer: document.getElementById("reportContainer"),
    reportContent: document.getElementById("reportContent"),
    downloadReportBtn: document.getElementById("downloadReportBtn"),
    copyReportBtn: document.getElementById("copyReportBtn"),
    reportTitle: document.getElementById("reportTitle"),
    clearStateBtn: document.getElementById("clearStateBtn"),
    siderealRow: document.getElementById("siderealRow"),
    configInputs: {
      perspective: document.getElementById("configPerspective"),
      zodiac_type: document.getElementById("configZodiac"),
      sidereal_mode: document.getElementById("configSiderealMode"),
      house_system: document.getElementById("configHouse"),
      theme: document.getElementById("configTheme"),
      base_aspect_points: document.getElementById("configAspectPoints"),
    },
  };

  const constants = {
    STORAGE_INPUT: "astroInputState",
    STORAGE_API: "astroApiState",
    STORAGE_CONFIG: "astroConfig",
    DEFAULT_CONFIG: {
      perspective: "Topocentric",
      zodiac_type: "Sidereal",
      sidereal_mode: "KRISHNAMURTI",
      house_system: "W",
      theme: "dark",
      base_aspect_points: ["sun", "moon", "ascendant", "mercury", "venus", "mars", "jupiter", "saturn"],
    },
  };

  const runtime = {
    hasChart: false,
    hasLoadedState: false,
    storedSvgs: {},
    storedSummaries: {},
    storedReports: {},
  };
  const MARKED_SRC = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
  let markedPromise = null;

  function loadMarked() {
    if (window.marked) return Promise.resolve(window.marked);
    if (markedPromise) return markedPromise;

    markedPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = MARKED_SRC;
      script.async = true;
      script.onload = () => {
        if (window.marked) {
          resolve(window.marked);
        } else {
          reject(new Error("Marked did not load"));
        }
      };
      script.onerror = () => reject(new Error("Could not load Marked.js"));
      document.head.appendChild(script);
    });

    return markedPromise;
  }

  function renderReportMarkdown(el, text) {
    if (!el) return;
    const content = text || "";
    if (!content.trim()) {
      el.innerHTML = '<p class="hint">Report is empty.</p>';
      return;
    }
    // Show plain text immediately as fallback while Marked loads.
    el.textContent = content;
    loadMarked()
      .then((marked) => {
        try {
          el.innerHTML = marked.parse(content);
        } catch (err) {
          console.warn("Markdown render failed", err);
          el.textContent = content;
        }
      })
      .catch((err) => {
        console.warn("Could not load Marked.js", err);
        el.textContent = content;
      });
  }

  if (!dom.form || !dom.chartContainer) {
    console.error("Home form or chart container missing from DOM.");
    HomeApp.disabled = true;
    return;
  }

  function getSelectedMode() {
    const checked = dom.modeInputs.find((el) => el.checked);
    return checked ? checked.value : "natal";
  }

  function setTransitNow() {
    if (runtime.hasLoadedState) return;
    if (!dom.transitDateInput || !dom.transitTimeInput) return;
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    dom.transitDateInput.value = dateStr;
    dom.transitTimeInput.value = timeStr;
  }

  function setStatus(message, isError) {
    if (!dom.statusEl) return;
    dom.statusEl.textContent = message || "";
    dom.statusEl.classList.toggle("status-error", Boolean(isError));
  }

  function clearSummary() {
    if (dom.summaryEl) {
      dom.summaryEl.innerHTML = "";
    }
  }

  function clearChart() {
    dom.chartContainer.innerHTML = "";
    runtime.hasChart = false;
    updateDownloadState();
  }

  function clearReport() {
    const target = dom.reportContent || dom.reportContainer;
    if (target) {
      target.innerHTML = `<p class="hint">Click "Load report" to fetch the full text report for the current mode.</p>`;
    }
    setReportTitle();
  }

  function setReportTitle(title) {
    if (!dom.reportTitle) return;
    dom.reportTitle.textContent = title || "Detailed text";
  }

  function updateDownloadState() {
    if (!dom.downloadBtn) return;
    dom.downloadBtn.disabled = !runtime.hasChart;
    dom.downloadBtn.classList.toggle("opacity-60", !runtime.hasChart);
    dom.downloadBtn.classList.toggle("cursor-not-allowed", !runtime.hasChart);
  }

  HomeApp.dom = dom;
  HomeApp.constants = constants;
  HomeApp.runtime = runtime;
  HomeApp.setReportTitle = setReportTitle;
  HomeApp.utils = {
    getSelectedMode,
    setTransitNow,
    setStatus,
    clearSummary,
    clearChart,
    clearReport,
    updateDownloadState,
    loadMarked,
    renderReportMarkdown,
    setReportTitle,
  };
})();
