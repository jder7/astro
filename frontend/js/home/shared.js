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
    birthDatetimeDisplay: document.getElementById("birthDatetimeDisplay"),
    transitDatetimeDisplay: document.getElementById("transitDatetimeDisplay"),
    datetimeModal: document.getElementById("datetime-modal"),
    datetimeModalTitle: document.getElementById("datetimeModalTitle"),
    datetimeInlinePicker: document.getElementById("datetimeInlinePicker"),
    datetimeTimeList: document.getElementById("datetimeTimeList"),
    datetimeTimeField: document.getElementById("datetimeTimeField"),
    datetimeDateField: document.getElementById("datetimeDateField"),
    datetimeSaveBtn: document.getElementById("datetimeSaveBtn"),
    datetimeTriggers: Array.from(document.querySelectorAll("[data-datetime-target]")),
    configInputs: {
      perspective: document.getElementById("configPerspective"),
      zodiac_type: document.getElementById("configZodiac"),
      sidereal_mode: document.getElementById("configSiderealMode"),
      house_system: document.getElementById("configHouse"),
      theme: document.getElementById("configTheme"),
      active_points: document.getElementById("configAspectPoints"),
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
      active_points: [
        "sun",
        "moon",
        "mercury",
        "venus",
        "mars",
        "jupiter",
        "saturn",
        "ascendant",
      ],
    },
  };

  const runtime = {
    hasChart: false,
    hasLoadedState: false,
    storedSvgs: {},
    storedSummaries: {},
    storedReports: {},
  };

  const datetimeTargets = {
    birth: {
      dateInputId: "dateInput",
      timeInputId: "timeInput",
      displayEl: () => dom.birthDatetimeDisplay,
      defaultDate: "1990-01-01",
      defaultTime: "12:00",
      title: "Birth date & time",
    },
    transit: {
      dateInputId: "transitDateInput",
      timeInputId: "transitTimeInput",
      displayEl: () => dom.transitDatetimeDisplay,
      defaultDate: "2025-01-01",
      defaultTime: "12:00",
      title: "Transit date & time",
    },
  };

  const MARKED_SRC = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
  let markedPromise = null;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatCompactDatetime(dateStr, timeStr) {
    const cleanDate = (dateStr || "").trim() || "—";
    const cleanTime = (timeStr || "").trim() || "--:--";
    return `${cleanDate} · ${cleanTime}`;
  }

  function normalizeTimeString(value, fallback) {
    const raw = (value || "").trim();
    if (!raw) return fallback;
    const [hRaw, mRaw = "0"] = raw.split(":");
    const hour = parseInt(hRaw, 10);
    const minute = parseInt(mRaw, 10);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback;
    const hh = Math.max(0, Math.min(23, hour));
    const mm = Math.max(0, Math.min(59, minute));
    return `${pad(hh)}:${pad(mm)}`;
  }

  function normalizeDateString(value, fallback) {
    const raw = (value || "").trim();
    const [yRaw, mRaw, dRaw] = raw.split("-");
    const y = parseInt(yRaw, 10);
    const m = parseInt(mRaw, 10);
    const d = parseInt(dRaw, 10);
    if ([y, m, d].every((n) => Number.isFinite(n))) {
      return `${pad(y)}-${pad(m)}-${pad(d)}`;
    }
    return fallback;
  }

  function refreshDateTimeBadges(targetKey) {
    const targets = targetKey ? [targetKey] : Object.keys(datetimeTargets);
    targets.forEach((key) => {
      const target = datetimeTargets[key];
      if (!target) return;
      const dateInput = document.getElementById(target.dateInputId);
      const timeInput = document.getElementById(target.timeInputId);
      const display = target.displayEl && target.displayEl();
      if (!display || !dateInput || !timeInput) return;
      display.textContent = formatCompactDatetime(
        dateInput.value || target.defaultDate,
        timeInput.value || target.defaultTime
      );
    });
  }

  function parseFromDisplay(target) {
    const display = target.displayEl && target.displayEl();
    if (!display || !display.textContent) return { date: null, time: null };
    const parts = display.textContent.split("·").map((p) => p.trim());
    return { date: parts[0] || null, time: parts[1] || null };
  }

  function setDateFieldValue(value) {
    if (!dom.datetimeDateField) return;
    dom.datetimeDateField.value = normalizeDateString(value, value || "");
  }

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

  let datepickerInitDone = false;

  function getDatepickerInstance() {
    const inlineEl = dom.datetimeInlinePicker;
    if (!inlineEl) return null;

    const captureInstance = (picker) => {
      if (picker) {
        datepickerInitDone = true;
        if (inlineEl.hasAttribute("inline-datepicker")) {
          // Prevent Flowbite's DOMContentLoaded auto-init from creating a second calendar.
          inlineEl.removeAttribute("inline-datepicker");
        }
      }
      return picker || null;
    };

    if (inlineEl.datepicker) {
      return captureInstance(inlineEl.datepicker);
    }
    if (!datepickerInitDone && window.Flowbite && typeof window.Flowbite.initDatepickers === "function") {
      try {
        window.Flowbite.initDatepickers();
      } catch (err) {
        console.warn("[datetime] Flowbite initDatepickers failed", err);
      }
      return captureInstance(inlineEl.datepicker);
    }
    return null;
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
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    dom.transitDateInput.value = dateStr;
    dom.transitTimeInput.value = timeStr;
    refreshDateTimeBadges("transit");
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

  function initDatetimeModal() {
    refreshDateTimeBadges();
    if (!dom.datetimeModal || !dom.datetimeInlinePicker) return;
    console.debug("[datetime] init start");

    let activeTarget = "birth";
    const timeRadios = dom.datetimeTimeList
      ? Array.from(dom.datetimeTimeList.querySelectorAll('input[name="datetimeTimeOption"]'))
      : [];

    let inlinePicker = getDatepickerInstance();
    let selectedModalDate = null;
    if (inlinePicker) {
      console.debug("[datetime] Inline datepicker available");
    } else {
      console.warn("[datetime] Datepicker class missing; using native date input fallback");
      dom.datetimeInlinePicker.style.display = "none";
    }
    dom.datetimeInlinePicker.addEventListener("changeDate", (event) => {
      const rawDate = event?.detail?.date;
      const dp = event?.detail?.datepicker;
      const dateVal =
        rawDate instanceof Date && !Number.isNaN(rawDate.getTime())
          ? rawDate
          : dp && typeof dp.getDate === "function"
            ? dp.getDate()
            : null;
      if (dateVal instanceof Date && !Number.isNaN(dateVal.getTime())) {
        selectedModalDate = `${dateVal.getFullYear()}-${pad(dateVal.getMonth() + 1)}-${pad(dateVal.getDate())}`;
        setDateFieldValue(selectedModalDate);
        console.debug("[datetime] changeDate captured", selectedModalDate);
      }
    });
    dom.datetimeInlinePicker.addEventListener("click", (event) => {
      const cell = event.target.closest("[data-date]");
      if (!cell) return;
      const raw = cell.getAttribute("data-date");
      if (!raw) return;
      const parsed = new Date(raw);
      if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
        selectedModalDate = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
        setDateFieldValue(selectedModalDate);
        console.debug("[datetime] click cell captured", selectedModalDate);
      }
    });

    const setInlineDate = (dateStr) => {
      const [y, m, d] = (dateStr || "").split("-").map((n) => parseInt(n, 10));
    if (!inlinePicker) inlinePicker = getDatepickerInstance();
    if (inlinePicker && Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      inlinePicker.setDate(new Date(y, m - 1, d));
      selectedModalDate = `${pad(y)}-${pad(m)}-${pad(d)}`;
      console.debug("[datetime] setInlineDate applied", selectedModalDate);
      } else {
        selectedModalDate = dateStr || null;
        if (!inlinePicker && dom.datetimeInlinePicker) {
          dom.datetimeInlinePicker.textContent = selectedModalDate || "";
        }
        console.debug("[datetime] setInlineDate fallback", selectedModalDate);
      }
      setDateFieldValue(selectedModalDate);
    };

    const getInlineDate = () => {
      if (selectedModalDate) return selectedModalDate;
      if (!inlinePicker) inlinePicker = getDatepickerInstance();
      if (inlinePicker && typeof inlinePicker.getDate === "function") {
        const val = inlinePicker.getDate();
        if (val instanceof Date && !Number.isNaN(val.getTime())) {
          const resolved = `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}`;
          console.debug("[datetime] getInlineDate from picker", resolved);
          return resolved;
        }
      }
      if (dom.datetimeDateField && dom.datetimeDateField.value) {
        const normalized = normalizeDateString(dom.datetimeDateField.value, null);
        if (normalized) {
          console.debug("[datetime] getInlineDate from date field", normalized);
          return normalized;
        }
      }
      console.debug("[datetime] getInlineDate missing, returning null");
      return null;
    };

    let pendingTime = null;

    const setSelectedTime = (timeStr) => {
      pendingTime = timeStr || null;
      if (dom.datetimeTimeField) {
        dom.datetimeTimeField.value = normalizeTimeString(timeStr, timeStr || "");
      }
      if (!timeRadios.length) return;
      let matched = false;
      timeRadios.forEach((radio) => {
        const isMatch = radio.value === timeStr;
        radio.checked = isMatch;
        matched = matched || isMatch;
      });
      if (!matched) {
        timeRadios.forEach((radio) => {
          if (pendingTime === null && radio.defaultChecked) {
            radio.checked = true;
            pendingTime = radio.value;
          } else if (pendingTime !== null) {
            radio.checked = false;
          }
        });
      }
    };

    const getSelectedTime = () => {
      const checked = timeRadios.find((radio) => radio.checked);
      return checked ? checked.value : pendingTime;
    };

    timeRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        pendingTime = radio.value;
        if (dom.datetimeTimeField) {
          dom.datetimeTimeField.value = normalizeTimeString(radio.value, radio.value);
        }
      });
    });

    if (dom.datetimeTimeList) {
      dom.datetimeTimeList.addEventListener("click", (event) => {
        const label = event.target.closest("label[for]");
        if (!label) return;
        const input = document.getElementById(label.getAttribute("for"));
        if (input && !input.checked) {
          input.checked = true;
          pendingTime = input.value;
          if (dom.datetimeTimeField) {
            dom.datetimeTimeField.value = normalizeTimeString(input.value, input.value);
          }
        }
      });
    }

    if (dom.datetimeTimeField) {
      dom.datetimeTimeField.addEventListener("input", () => {
        const normalized = normalizeTimeString(dom.datetimeTimeField.value, null);
        pendingTime = normalized;
        if (timeRadios.length) {
          timeRadios.forEach((radio) => {
            radio.checked = radio.value === normalized;
          });
        }
      });
    }

    if (dom.datetimeDateField) {
      dom.datetimeDateField.addEventListener("input", () => {
        const normalized = normalizeDateString(dom.datetimeDateField.value, null);
        if (normalized) {
          selectedModalDate = normalized;
          setDateFieldValue(normalized);
          if (inlinePicker) {
            const [y, m, d] = normalized.split("-").map((n) => parseInt(n, 10));
            if ([y, m, d].every((n) => Number.isFinite(n))) {
              inlinePicker.setDate(new Date(y, m - 1, d));
            }
          }
          console.debug("[datetime] manual date input", normalized);
        }
      });
    }

    const syncModal = (targetKey) => {
      const target = datetimeTargets[targetKey] || datetimeTargets.birth;
      const dateInput = document.getElementById(target.dateInputId);
      const timeInput = document.getElementById(target.timeInputId);
      const displayFallback = parseFromDisplay(target);
      const nextDate = (dateInput && dateInput.value) || displayFallback.date || target.defaultDate;
      const nextTime = (timeInput && timeInput.value) || displayFallback.time || target.defaultTime;
      pendingTime = null;
      setInlineDate(nextDate);
      setSelectedTime(nextTime);
      if (dom.datetimeModalTitle) {
        dom.datetimeModalTitle.textContent = target.title;
      }
      console.debug("[datetime] syncModal", { targetKey, nextDate, nextTime });
    };

    let modalInstance = null;
    if (window.Modal && typeof window.Modal === "function") {
      try {
        modalInstance = new window.Modal(dom.datetimeModal, {
          backdrop: "dynamic",
          closable: true,
        });
      } catch (err) {
        console.warn("Datetime modal init failed", err);
      }
    }

    const openModal = () => {
      if (modalInstance && typeof modalInstance.show === "function") {
        modalInstance.show();
      } else {
        dom.datetimeModal.classList.remove("hidden");
        dom.datetimeModal.removeAttribute("aria-hidden");
        dom.datetimeModal.removeAttribute("inert");
      }
      console.debug("[datetime] modal opened", { activeTarget });
    };

    const closeModal = () => {
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }
      if (modalInstance && typeof modalInstance.hide === "function") {
        modalInstance.hide();
      } else {
        dom.datetimeModal.classList.add("hidden");
        dom.datetimeModal.setAttribute("aria-hidden", "true");
        dom.datetimeModal.setAttribute("inert", "true");
      }
      console.debug("[datetime] modal closed");
    };

    dom.datetimeTriggers.forEach((btn) => {
      btn.addEventListener("click", () => {
        const requested = btn.dataset.datetimeTarget || "birth";
        activeTarget = datetimeTargets[requested] ? requested : "birth";
        syncModal(activeTarget);
        if (dom.datetimeDateField) {
          dom.datetimeDateField.focus();
        }
        openModal();
      });
    });

    if (dom.datetimeSaveBtn) {
      dom.datetimeSaveBtn.addEventListener("click", () => {
        const target = datetimeTargets[activeTarget] || datetimeTargets.birth;
        const dateInput = document.getElementById(target.dateInputId);
        const timeInput = document.getElementById(target.timeInputId);
        const selectedDate = normalizeDateString(
          getInlineDate() || dateInput?.value || target.defaultDate,
          target.defaultDate
        );
        const fieldTime = dom.datetimeTimeField ? dom.datetimeTimeField.value : null;
        const selectedTime =
          normalizeTimeString(pendingTime, null) ||
          normalizeTimeString(getSelectedTime(), null) ||
          normalizeTimeString(fieldTime, null) ||
          target.defaultTime;
        if (dateInput) dateInput.value = selectedDate;
        if (timeInput) timeInput.value = selectedTime;
        refreshDateTimeBadges(activeTarget);
        console.debug("[datetime] save applied", { target: activeTarget, selectedDate, selectedTime });
        pendingTime = null;
        selectedModalDate = null;
        closeModal();
      });
    }

    const closeButtons = dom.datetimeModal.querySelectorAll('[data-modal-hide="datetime-modal"]');
    closeButtons.forEach((btn) => btn.addEventListener("click", closeModal));
    dom.datetimeModal.addEventListener("click", (event) => {
      if (event.target === dom.datetimeModal) {
        closeModal();
      }
    });
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
    refreshDateTimeBadges,
  };

  initDatetimeModal();
})();
