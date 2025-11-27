(function () {
  const ns = window.AppNamespace || "HomeApp";
  const App = (window[ns] = window[ns] || {});
  if (App.disabled) return;

  const { dom, runtime, utils, payloads, state } = App;
  const { buildPayloadFromForm, buildRelationshipPayload } = payloads;
  const { saveFormState, saveApiData } = state;
  const getRender = () => App.render || {};

  App.handleSubmit = async function handleSubmit(event) {
    event.preventDefault();
    utils.setStatus("");
    utils.clearSummary();
    utils.clearChart();
    utils.clearReport();

    if (dom.generateBtn) {
      dom.generateBtn.disabled = true;
      dom.generateBtn.textContent = "Generating…";
    }

    const mode = utils.getSelectedMode() || "natal";

    try {
      const { payload, birthDateParts, transitDateParts } = buildPayloadFromForm(mode);

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
          getRender().renderNatalSummary?.(natalJson.subject, birthDateParts);
        } else if (dom.summaryEl) {
          dom.summaryEl.innerHTML = "<p>Unexpected response from natal endpoint – subject field not found.</p>";
        }

        const svgResp = await fetch("/api/svg/natal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!svgResp.ok) {
          const text = await svgResp.text();
          throw new Error(`SVG natal request failed: ${svgResp.status} ${svgResp.statusText} - ${text}`);
        }
        const svgText = await svgResp.text();
        dom.chartContainer.innerHTML = svgText;
        runtime.hasChart = true;
        utils.updateDownloadState();
        utils.setStatus("Natal chart generated.");
        saveFormState(mode, payload);
        saveApiData(mode, { svg: svgText, summary: dom.summaryEl ? dom.summaryEl.innerHTML : "" });
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
          getRender().renderTransitSummary?.(transitJson.snapshot, transitDateParts);
        } else if (dom.summaryEl) {
          dom.summaryEl.innerHTML = "<p>Unexpected response from transit endpoint – snapshot not found.</p>";
        }

        const svgResp = await fetch("/api/svg/transit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!svgResp.ok) {
          const text = await svgResp.text();
          throw new Error(`SVG transit request failed: ${svgResp.status} ${svgResp.statusText} - ${text}`);
        }
        const svgText = await svgResp.text();
        dom.chartContainer.innerHTML = svgText;
        runtime.hasChart = true;
        utils.updateDownloadState();
        utils.setStatus("Transit chart generated.");
        saveFormState(mode, payload);
        saveApiData(mode, { svg: svgText, summary: dom.summaryEl ? dom.summaryEl.innerHTML : "" });
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
          getRender().renderCombinedSummary?.(transitJson.snapshot, birthDateParts, transitDateParts);
        } else if (dom.summaryEl) {
          dom.summaryEl.innerHTML = "<p>Unexpected response from transit endpoint – snapshot not found.</p>";
        }

        const svgResp = await fetch("/api/svg/transit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!svgResp.ok) {
          const text = await svgResp.text();
          throw new Error(`SVG dual-wheel request failed: ${svgResp.status} ${svgResp.statusText} - ${text}`);
        }
        const svgText = await svgResp.text();
        dom.chartContainer.innerHTML = svgText;
        runtime.hasChart = true;
        utils.updateDownloadState();
        utils.setStatus("Natal + Transit chart generated.");
        saveFormState(mode, payload);
        saveApiData(mode, { svg: svgText, summary: dom.summaryEl ? dom.summaryEl.innerHTML : "" });
      } else {
        const synPayload = buildRelationshipPayload();
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
        const renderer = getRender();
        if (renderer.renderRelationshipSummary) {
          renderer.renderRelationshipSummary(relJson);
        }

        const svgResp = await fetch("/api/svg/synastry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...synPayload, grid_view: false }),
        });
        if (!svgResp.ok) {
          const text = await svgResp.text();
          throw new Error(`SVG synastry request failed: ${svgResp.status} ${svgResp.statusText} - ${text}`);
        }
        const svgText = await svgResp.text();
        dom.chartContainer.innerHTML = svgText;
        runtime.hasChart = true;
        utils.updateDownloadState();
        utils.setStatus("Relationship chart generated.");
        saveFormState(mode, { ...payload, ...synPayload });
        saveApiData(mode, { svg: svgText, summary: dom.summaryEl ? dom.summaryEl.innerHTML : "" });
      }
    } catch (err) {
      utils.setStatus(err.message || "An error occurred while generating the chart.", true);
      if (dom.summaryEl && !dom.summaryEl.innerHTML) {
        dom.summaryEl.innerHTML =
          "<p>Could not generate summary due to an error. Check the console for details.</p>";
      }
    } finally {
      if (dom.generateBtn) {
        dom.generateBtn.disabled = false;
        dom.generateBtn.textContent = "Generate chart";
      }
      utils.updateDownloadState();
    }
  };

  App.registerHandleSubmit = function registerHandleSubmit() {
    // no-op; handleSubmit already defined for home
  };
})();
