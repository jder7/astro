(function () {
  const ns = window.AppNamespace || "HomeApp";
  const App = (window[ns] = window[ns] || {});
  if (App.disabled) return;

  const { dom, runtime, utils, payloads, state } = App;
  const { clearSavedState, updateModeVisibility, init } = state;

  init();

  function bindSubmit() {
    if (!dom.form) return;
    if (typeof App.handleSubmit === "function") {
      console.info("[actions] binding submit handler for namespace", ns);
      dom.form.addEventListener("submit", (event) => App.handleSubmit(event));
    } else {
      console.warn("[actions] no submit handler defined for namespace", ns);
      dom.form.addEventListener("submit", (event) => {
        event.preventDefault();
        utils.setStatus("No submit handler defined for this page.", true);
      });
    }
  }

  if (typeof App.registerHandleSubmit === "function") {
    console.info("[actions] registerHandleSubmit hook found for namespace", ns);
    App.registerHandleSubmit();
  }

  async function loadReport() {
    const target = dom.reportContent || dom.reportContainer;
    if (!target) return;
    const mode = utils.getSelectedMode() || "natal";
    const { payload } = buildPayloadFromForm(mode);
    const baseBirth =
      payload.birth ||
      (payload.moment
        ? {
            name: "Transit snapshot",
            ...payload.moment,
          }
        : null) ||
      (mode === "relationship" ? payload.first : null);
    if (!baseBirth) {
      target.innerHTML = '<p class="hint">No birth data available for report.</p>';
      return;
    }
    try {
      target.innerHTML = '<p class="hint">Loading report…</p>';
      const requestBody = {
        kind: "NATAL",
        mode,
        birth: baseBirth,
        first: mode === "relationship" ? payload.first : null,
        second: mode === "relationship" ? payload.second : null,
        config: payload.config || config.getConfigFromInputs(),
        include_aspects: true,
        max_aspects: 50,
        moment: mode !== "natal" ? payload.moment : null,
      };
      const resp = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || resp.statusText);
      }
      const data = await resp.json();
      const text = data.text || "Report returned empty.";
      const title =
        (data.structured && data.structured.title) ||
        (payload.birth && payload.birth.name ? `Report - ${payload.birth.name}` : "Detailed text");
      const renderMarkdown =
        utils && typeof utils.renderReportMarkdown === "function"
          ? utils.renderReportMarkdown
          : (el, content) => {
              if (el) el.textContent = content || "";
            };
      renderMarkdown(target, text);
      if (utils && typeof utils.setReportTitle === "function") {
        utils.setReportTitle(title);
      }
      state.saveApiData(mode, { report: { text, title } });
    } catch (err) {
      target.innerHTML = `<p class="hint">Could not load report: ${err.message || err}</p>`;
    }
  }

  function getReportForMode(mode) {
    const rep = runtime.storedReports && runtime.storedReports[mode];
    if (!rep) return null;
    if (typeof rep === "string") return { text: rep, title: null };
    if (typeof rep === "object") return { text: rep.text || "", title: rep.title || null };
    return null;
  }

  function copyReportToClipboard() {
    const mode = utils.getSelectedMode() || "natal";
    const rep = getReportForMode(mode);
    if (!rep || !rep.text) {
      utils.setStatus("No report loaded to copy.", true);
      return;
    }
    const content = rep.text;
    const handleError = (err) => {
      utils.setStatus("Could not copy report.", true);
    };
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(content).then(() => {
        utils.setStatus("Report copied to clipboard.");
      }, handleError);
      return;
    }
    try {
      const area = document.createElement("textarea");
      area.value = content;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.focus();
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      if (ok) {
        utils.setStatus("Report copied to clipboard.");
      } else {
        handleError(new Error("execCommand copy failed"));
      }
    } catch (err) {
      handleError(err);
    }
  }

  async function downloadReportPdf() {
    const mode = utils.getSelectedMode();
    const { payload } = buildPayloadFromForm(mode);
    const baseBirth =
      payload.birth ||
      (payload.moment
        ? {
            name: "Transit snapshot",
            ...payload.moment,
          }
        : null) ||
      (mode === "relationship" ? payload.first : null);
    if (!baseBirth) {
      utils.setStatus("No birth data for report download.", true);
      return;
    }
    try {
      utils.setStatus("Downloading report…");
      const requestBody = {
        kind: "NATAL",
        mode,
        birth: baseBirth,
        first: mode === "relationship" ? payload.first : null,
        second: mode === "relationship" ? payload.second : null,
        config: payload.config || config.getConfigFromInputs(),
        include_aspects: true,
        max_aspects: 50,
        moment: mode !== "natal" ? payload.moment : null,
      };
      const resp = await fetch(`/api/report/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || resp.statusText);
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
      utils.setStatus("Report PDF downloaded.");
    } catch (err) {
      utils.setStatus(err.message || "Could not download report PDF.", true);
    }
  }

  async function handleDownloadPdf() {
    utils.setStatus("");
    const mode = utils.getSelectedMode();
    const { payload, config: cfg, transitDateParts } = buildPayloadFromForm(mode);

    if (!runtime.hasChart) {
      utils.setStatus("Generate a chart first to download PDF.", true);
      return;
    }

    try {
      if (dom.downloadBtn) dom.downloadBtn.disabled = true;
      const pdfConfig = { ...cfg, theme: "classic" };

      const momentPayload =
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

      const requestBody = {
        mode,
        birth: payload.birth || null,
        moment: momentPayload,
        first: mode === "relationship" ? payload.first : null,
        second: mode === "relationship" ? payload.second : null,
        config: pdfConfig,
      };

      const resp = await fetch(`/api/svg/pdf`, {
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
      a.download = `${mode}-chart.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      utils.setStatus("PDF downloaded.");
    } catch (err) {
      utils.setStatus(err.message || "Could not download PDF.", true);
    } finally {
      utils.updateDownloadState();
    }
  }

  function bindZoom() {
    if (dom.zoomBtn && dom.svgModal && dom.svgModalBody && dom.svgModalClose) {
      let zoomScale = 1;
      let zoomTarget = null;

      const applyScale = () => {
        if (!zoomTarget) return;
        zoomTarget.style.transform = `scale(${zoomScale})`;
      };

      const setZoomTarget = () => {
        const inner = dom.svgModalBody.querySelector(".svg-zoom-inner");
        zoomTarget = inner || dom.svgModalBody;
        zoomTarget.style.transformOrigin = "top center";
        zoomTarget.style.transition = "transform 120ms ease-out";
        zoomScale = 1;
        applyScale();
      };

      dom.zoomBtn.addEventListener("click", () => {
        const svgContent = dom.chartContainer.innerHTML;
        dom.svgModalBody.innerHTML = `<div class="svg-zoom-inner">${svgContent || '<p class="hint">No chart to zoom.</p>'}</div>`;
        setZoomTarget();
        dom.svgModal.classList.add("open");
      });
      dom.svgModalClose.addEventListener("click", () => dom.svgModal.classList.remove("open"));
      dom.svgModal.addEventListener("click", (e) => {
        if (e.target === dom.svgModal) dom.svgModal.classList.remove("open");
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") dom.svgModal.classList.remove("open");
      });

      if (dom.svgZoomIn) {
        dom.svgZoomIn.addEventListener("click", () => {
          zoomScale = Math.min(3, zoomScale + 0.2);
          applyScale();
        });
      }
      if (dom.svgZoomOut) {
        dom.svgZoomOut.addEventListener("click", () => {
          zoomScale = Math.max(0.5, zoomScale - 0.2);
          applyScale();
        });
      }
    }
  }

  bindSubmit();

  if (dom.downloadBtn) {
    dom.downloadBtn.addEventListener("click", handleDownloadPdf);
    utils.updateDownloadState();
  }

  bindZoom();

  if (dom.loadReportBtn && dom.reportContainer && typeof loadReport === "function") {
    dom.loadReportBtn.addEventListener("click", loadReport);
  }
  if (dom.downloadReportBtn && typeof downloadReportPdf === "function") {
    dom.downloadReportBtn.addEventListener("click", downloadReportPdf);
  }
  if (dom.copyReportBtn && typeof copyReportToClipboard === "function") {
    dom.copyReportBtn.addEventListener("click", copyReportToClipboard);
  }
  if (dom.clearStateBtn) {
    dom.clearStateBtn.addEventListener("click", clearSavedState);
  }
})();
