(function () {
  const form = document.getElementById("natalForm");
  const chartContainer = document.getElementById("chartContainer");
  const statusEl = document.getElementById("status");
  const generateBtn = document.getElementById("generateBtn");

  if (!form || !chartContainer) {
    console.error("Home form or chart container missing from DOM.");
    return;
  }

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("status-error", Boolean(isError));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("");
    chartContainer.innerHTML = "";

    generateBtn.disabled = true;
    generateBtn.textContent = "Generating…";

    try {
      const payload = buildPayloadFromForm(form);
      const response = await fetch("/api/svg/natal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const svgText = await response.text();

      if (!response.ok) {
        console.error("Error response:", response.status, svgText);
        setStatus("Error: " + response.status + " – see console for details.", true);
        chartContainer.innerHTML =
          "<p class=\"hint\">Request failed. Open the browser console for details.</p>";
        return;
      }

      chartContainer.innerHTML = svgText;
      setStatus("Chart generated successfully.", false);
    } catch (err) {
      console.error("Failed to generate chart:", err);
      setStatus("Unexpected error – see console for details.", true);
      chartContainer.innerHTML =
        "<p class=\"hint\">Unexpected error. Open the browser console for details.</p>";
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate chart";
    }
  }

  function buildPayloadFromForm(form) {
    const getValue = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : "";
    };

    const toInt = (id, fallback) => {
      const v = parseInt(getValue(id), 10);
      return Number.isFinite(v) ? v : fallback;
    };

    const toFloat = (id, fallback) => {
      const v = parseFloat(getValue(id));
      return Number.isFinite(v) ? v : fallback;
    };

    const birth = {
      name: getValue("name") || "Subject",
      year: toInt("year", 1990),
      month: toInt("month", 1),
      day: toInt("day", 1),
      hour: toInt("hour", 12),
      minute: toInt("minute", 0),
      lat: toFloat("lat", 52.3702),
      lng: toFloat("lng", 4.8952),
      tz_str: getValue("tz_str") || "Europe/Amsterdam",
      city: getValue("city") || "Amsterdam",
      nation: getValue("nation") || "NL",
    };

    const config = {
      theme: getValue("theme") || "classic",
      // Other config fields (perspective, zodiac_type, etc.) follow API defaults.
    };

    return { birth, config };
  }

  form.addEventListener("submit", handleSubmit);
})();
