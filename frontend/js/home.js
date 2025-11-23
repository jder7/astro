(function () {
  const form = document.getElementById("natalForm");
  const chartContainer = document.getElementById("chartContainer");
  const statusEl = document.getElementById("status");
  const generateBtn = document.getElementById("generateBtn");
  const summaryEl = document.getElementById("summaryContent");
  const modeInputs = Array.from(document.querySelectorAll('input[name="mode"]'));
  const nameRow = document.getElementById("nameRow");

  if (!form || !chartContainer) {
    console.error("Home form or chart container missing from DOM.");
    return;
  }

  function getSelectedMode() {
    const checked = modeInputs.find((el) => el.checked);
    return checked ? checked.value : "natal";
  }

  function updateModeVisibility() {
    const mode = getSelectedMode();
    if (nameRow) {
      nameRow.style.display = mode === "natal" ? "" : "none";
    }
  }

  modeInputs.forEach((input) => {
    input.addEventListener("change", updateModeVisibility);
  });
  updateModeVisibility();

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.classList.toggle("status-error", Boolean(isError));
  }

  function clearSummary() {
    if (summaryEl) {
      summaryEl.innerHTML = "";
    }
  }

  function clearChart() {
    chartContainer.innerHTML = "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("");
    clearSummary();
    clearChart();

    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.textContent = "Generating…";
    }

    const mode = getSelectedMode();

    try {
      const { payload, isNatal } = buildPayloadFromForm(form, mode);

      if (isNatal) {
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
          renderNatalSummary(natalJson.subject);
        } else if (summaryEl) {
          summaryEl.innerHTML =
            "<p>Unexpected response from natal endpoint – subject field not found.</p>";
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
        chartContainer.innerHTML = svgText;
        setStatus("Natal chart generated.");
      } else {
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
        chartContainer.innerHTML = svgText;

        if (summaryEl) {
          summaryEl.innerHTML =
            "<p>Transit chart generated. (Transit summary is not yet implemented.)</p>";
        }

        setStatus("Transit chart generated.");
      }
    } catch (err) {
      console.error(err);
      setStatus(err.message || "An error occurred while generating the chart.", true);
      if (summaryEl && !summaryEl.innerHTML) {
        summaryEl.innerHTML =
          "<p>Could not generate summary due to an error. Check the console for details.</p>";
      }
    } finally {
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.textContent = "Generate chart";
      }
    }
  }

  const ASPECTS = [
    { name: "conjunction", angle: 0, orb: 6 },
    { name: "sextile", angle: 60, orb: 4 },
    { name: "square", angle: 90, orb: 6 },
    { name: "trine", angle: 120, orb: 6 },
    { name: "opposition", angle: 180, orb: 6 },
  ];

  const HOUSE_LABELS = {
    First_House: "1st house",
    Second_House: "2nd house",
    Third_House: "3rd house",
    Fourth_House: "4th house",
    Fifth_House: "5th house",
    Sixth_House: "6th house",
    Seventh_House: "7th house",
    Eighth_House: "8th house",
    Ninth_House: "9th house",
    Tenth_House: "10th house",
    Eleventh_House: "11th house",
    Twelfth_House: "12th house",
  };

  function normalizeAngleDiff(a, b) {
    let diff = Math.abs(a - b) % 360;
    if (diff > 180) diff = 360 - diff;
    return diff;
  }

  function classifyAspect(diff) {
    for (const asp of ASPECTS) {
      const delta = Math.abs(diff - asp.angle);
      if (delta <= asp.orb) {
        return { ...asp, orb: delta };
      }
    }
    return null;
  }

  function extractPoints(subject) {
    const points = {};
    for (const [key, value] of Object.entries(subject)) {
      if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "abs_pos")) {
        points[key] = value;
      }
    }
    return points;
  }

  function computeKeyAspects(subject, baseNames) {
    const points = extractPoints(subject);
    const aspects = [];
    const baseSet = new Set(baseNames);
    const keys = Object.keys(points);

    for (const base of baseNames) {
      const basePoint = points[base];
      if (!basePoint) continue;
      const baseDeg = basePoint.abs_pos;

      for (const other of keys) {
        if (other === base) continue;
        const otherPoint = points[other];
        if (!otherPoint) continue;

        if (baseSet.has(other) && base > other) continue;

        const otherDeg = otherPoint.abs_pos;
        const diff = normalizeAngleDiff(baseDeg, otherDeg);
        const asp = classifyAspect(diff);
        if (!asp) continue;

        aspects.push({
          base,
          other,
          type: asp.name,
          exact: asp.angle,
          orb: asp.orb,
        });
      }
    }

    aspects.sort((a, b) => a.orb - b.orb);
    return aspects;
  }

  function formatHouse(house) {
    if (!house) return "";
    const label = HOUSE_LABELS[house] || house.replace(/_/g, " ");
    return label;
  }

  function formatPointLabel(key, point) {
    const baseNameMap = {
      sun: "Sun",
      moon: "Moon",
      ascendant: "Ascendant",
    };
    const label = baseNameMap[key] || point.name || key;
    const deg = typeof point.position === "number" ? point.position.toFixed(2) : "?";
    const sign = point.sign || "";
    const houseLabel = formatHouse(point.house);
    const parts = [`${label} ${sign} ${deg}°`];
    if (houseLabel) {
      parts.push(`(${houseLabel})`);
    }
    return parts.join(" ");
  }

  function formatAspectLabel(subject, aspect) {
    const points = extractPoints(subject);
    const basePoint = points[aspect.base];
    const otherPoint = points[aspect.other];
    if (!basePoint || !otherPoint) return null;

    const baseLabel = formatPointLabel(aspect.base, basePoint);
    const otherLabel = formatPointLabel(aspect.other, otherPoint);
    const orbText = aspect.orb.toFixed(2);

    return `${baseLabel} ${aspect.type} ${otherLabel} (orb ${orbText}°)`;
  }

  function renderNatalSummary(subject) {
    if (!summaryEl) {
      return;
    }

    const sun = subject.sun;
    const moon = subject.moon;
    const asc = subject.ascendant;

    if (!sun || !moon || !asc) {
      summaryEl.innerHTML =
        "<p>Could not find Sun, Moon or Ascendant in the natal response.</p>";
      return;
    }

    const baseNames = ["sun", "moon", "ascendant"];
    const aspects = computeKeyAspects(subject, baseNames);
    const topThree = aspects.slice(0, 3);

    const sunText = formatPointLabel("sun", sun);
    const moonText = formatPointLabel("moon", moon);
    const ascText = formatPointLabel("ascendant", asc);

    const aspectItems = topThree
      .map((asp) => formatAspectLabel(subject, asp))
      .filter(Boolean)
      .map((text) => `<li>${text}</li>`)
      .join("");

    summaryEl.innerHTML = `
      <div class="summary-points">
        <p><strong>Sun:</strong> ${sunText}</p>
        <p><strong>Moon:</strong> ${moonText}</p>
        <p><strong>Ascendant:</strong> ${ascText}</p>
      </div>
      <div class="summary-aspects">
        <h4>Top aspects involving Sun, Moon, Ascendant</h4>
        ${
          aspectItems
            ? `<ul>${aspectItems}</ul>`
            : "<p>No major aspects found within the configured orbs.</p>"
        }
      </div>
    `;
  }

  function buildPayloadFromForm(form, mode) {
    const getValue = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : "";
    };

    const toFloat = (id, fallback) => {
      const v = parseFloat(getValue(id));
      return Number.isFinite(v) ? v : fallback;
    };

    const parseDateTimeValue = () => {
      const datePart = (getValue("dateInput") || "").trim();
      const timePart = (getValue("timeInput") || "").trim();

      if (!datePart) return null;
      const [year, month, day] = datePart.split("-").map((n) => parseInt(n, 10));
      const [hourRaw = "12", minuteRaw = "0"] = timePart.split(":");
      const hour = parseInt(hourRaw, 10);
      const minute = parseInt(minuteRaw, 10);

      if ([year, month, day].some((n) => !Number.isFinite(n))) {
        return null;
      }
      return {
        year,
        month,
        day,
        hour: Number.isFinite(hour) ? hour : 12,
        minute: Number.isFinite(minute) ? minute : 0,
      };
    };

    const dateTime = parseDateTimeValue();

    const common = {
      year: dateTime?.year ?? 1990,
      month: dateTime?.month ?? 1,
      day: dateTime?.day ?? 1,
      hour: dateTime?.hour ?? 12,
      minute: dateTime?.minute ?? 0,
      lat: toFloat("lat", 52.3702),
      lng: toFloat("lng", 4.8952),
      tz_str: getValue("tz_str") || "Europe/Amsterdam",
      city: getValue("city") || "Amsterdam",
      nation: getValue("nation") || "NL",
    };

    const config = {
      theme: getValue("theme") || "classic",
    };

    if (mode === "transit") {
      const moment = {
        ...common,
      };

      return {
        isNatal: false,
        payload: {
          moment,
          birth: null,
          config,
        },
      };
    }

    const birth = {
      name: getValue("name") || "Subject",
      ...common,
    };

    return {
      isNatal: true,
      payload: {
        birth,
        config,
      },
    };
  }

  form.addEventListener("submit", handleSubmit);
})();
