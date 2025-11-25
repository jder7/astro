(function () {
  const HomeApp = window.HomeApp || {};
  if (HomeApp.disabled) return;

  const { dom, constants } = HomeApp;
  const { DEFAULT_CONFIG, STORAGE_CONFIG } = constants;
  const configInputs = dom.configInputs || {};

  function toggleSiderealVisibility(zodiacType) {
    if (!dom.siderealRow) return;
    dom.siderealRow.style.display = zodiacType === "Sidereal" ? "" : "none";
  }

  function getConfigFromInputs() {
    const cfg = { ...DEFAULT_CONFIG };
    Object.entries(configInputs).forEach(([key, el]) => {
      if (el && el.value) {
        cfg[key] = el.value;
      }
    });
    if (cfg.zodiac_type !== "Sidereal") {
      cfg.sidereal_mode = null;
    }
    return cfg;
  }

  function loadConfig() {
    let stored = {};
    try {
      const raw = localStorage.getItem(STORAGE_CONFIG);
      if (raw) stored = JSON.parse(raw);
    } catch (err) {
      console.warn("Could not load config from localStorage", err);
    }
    const merged = { ...DEFAULT_CONFIG, ...stored };
    if (merged.zodiac_type === "Tropical") {
      merged.zodiac_type = "Tropic";
    }
    if (!["Sidereal", "Tropic"].includes(merged.zodiac_type)) {
      merged.zodiac_type = DEFAULT_CONFIG.zodiac_type;
    }
    Object.entries(configInputs).forEach(([key, el]) => {
      if (el && merged[key]) {
        el.value = merged[key];
      }
    });
    toggleSiderealVisibility(merged.zodiac_type);
    return merged;
  }

  function saveConfig() {
    const cfg = getConfigFromInputs();
    try {
      localStorage.setItem(STORAGE_CONFIG, JSON.stringify(cfg));
    } catch (err) {
      console.warn("Could not save config to localStorage", err);
    }
    return cfg;
  }

  function bindConfigInputs() {
    Object.values(configInputs).forEach((el) => {
      if (!el) return;
      el.addEventListener("change", saveConfig);
      el.addEventListener("blur", saveConfig);
    });
  }

  function showConfigPanel(show) {
    if (!dom.configPanel) return;
    dom.configPanel.classList.toggle("hidden", !show);
  }

  if (dom.configToggle) {
    dom.configToggle.addEventListener("click", () => showConfigPanel(true));
  }
  if (dom.configClose) {
    dom.configClose.addEventListener("click", () => showConfigPanel(false));
  }

  const loadedConfig = loadConfig();
  if (configInputs.zodiac_type) {
    configInputs.zodiac_type.addEventListener("change", (e) => {
      toggleSiderealVisibility(e.target.value);
      saveConfig();
    });
  }
  toggleSiderealVisibility(configInputs.zodiac_type?.value);
  bindConfigInputs();

  HomeApp.config = {
    getConfigFromInputs,
    loadConfig,
    saveConfig,
    toggleSiderealVisibility,
    loadedConfig,
  };
})();
