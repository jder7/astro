(function () {
  const ns = window.AppNamespace || "HomeApp";
  const App = (window[ns] = window[ns] || {});

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
    firstDatetimeDisplay: document.getElementById("firstDatetimeDisplay"),
    secondDatetimeDisplay: document.getElementById("secondDatetimeDisplay"),
    datetimeModal: document.getElementById("datetime-modal"),
    datetimeModalTitle: document.getElementById("datetimeModalTitle"),
    datetimeInlinePicker: document.getElementById("datetimeInlinePicker"),
    datetimeTimeList: document.getElementById("datetimeTimeList"),
    datetimeTimeField: document.getElementById("datetimeTimeField"),
    datetimeDateField: document.getElementById("datetimeDateField"),
    datetimeSaveBtn: document.getElementById("datetimeSaveBtn"),
    datetimeTriggers: Array.from(document.querySelectorAll("[data-datetime-target]")),
    datetimeTodayBtn: document.getElementById("datetimeTodayBtn"),
    datetimeNowBtn: document.getElementById("datetimeNowBtn"),
    birthLocationDisplay: document.getElementById("birthLocationDisplay"),
    transitLocationDisplay: document.getElementById("transitLocationDisplay"),
    firstLocationDisplay: document.getElementById("firstLocationDisplay"),
    secondLocationDisplay: document.getElementById("secondLocationDisplay"),
    locationModal: document.getElementById("location-modal"),
    locationModalTitle: document.getElementById("locationModalTitle"),
    locationSaveBtn: document.getElementById("locationSaveBtn"),
    locationTriggers: Array.from(document.querySelectorAll("[data-location-target]")),
    locationLookupLink: document.getElementById("locationLookupLink"),
    locationPasteBtn: document.getElementById("locationPasteBtn"),
    locationTzCurrentBtn: document.getElementById("locationTzCurrentBtn"),
    locationTzCurrentLabel: document.getElementById("locationTzCurrentLabel"),
    locationModalFields: {
      city: document.getElementById("locationCityField"),
      nation: document.getElementById("locationNationField"),
      tz: document.getElementById("locationTzField"),
      lat: document.getElementById("locationLatField"),
      lng: document.getElementById("locationLngField"),
    },
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
    locationValues: {},
  };

  const COUNTRY_CODES = {
    AF: "Afghanistan",
    AX: "Aland Islands",
    AL: "Albania",
    DZ: "Algeria",
    AS: "American Samoa",
    AD: "Andorra",
    AO: "Angola",
    AI: "Anguilla",
    AQ: "Antarctica",
    AG: "Antigua and Barbuda",
    AR: "Argentina",
    AM: "Armenia",
    AW: "Aruba",
    AU: "Australia",
    AT: "Austria",
    AZ: "Azerbaijan",
    BS: "Bahamas",
    BH: "Bahrain",
    BD: "Bangladesh",
    BB: "Barbados",
    BY: "Belarus",
    BE: "Belgium",
    BZ: "Belize",
    BJ: "Benin",
    BM: "Bermuda",
    BT: "Bhutan",
    BO: "Bolivia",
    BQ: "Bonaire, Sint Eustatius and Saba",
    BA: "Bosnia and Herzegovina",
    BW: "Botswana",
    BV: "Bouvet Island",
    BR: "Brazil",
    IO: "British Indian Ocean Territory",
    BN: "Brunei Darussalam",
    BG: "Bulgaria",
    BF: "Burkina Faso",
    BI: "Burundi",
    CV: "Cabo Verde",
    KH: "Cambodia",
    CM: "Cameroon",
    CA: "Canada",
    KY: "Cayman Islands",
    CF: "Central African Republic",
    TD: "Chad",
    CL: "Chile",
    CN: "China",
    CX: "Christmas Island",
    CC: "Cocos (Keeling) Islands",
    CO: "Colombia",
    KM: "Comoros",
    CG: "Congo",
    CD: "Congo, Democratic Republic of the",
    CK: "Cook Islands",
    CR: "Costa Rica",
    CI: "Cote d'Ivoire",
    HR: "Croatia",
    CU: "Cuba",
    CW: "Curacao",
    CY: "Cyprus",
    CZ: "Czechia",
    DK: "Denmark",
    DJ: "Djibouti",
    DM: "Dominica",
    DO: "Dominican Republic",
    EC: "Ecuador",
    EG: "Egypt",
    SV: "El Salvador",
    GQ: "Equatorial Guinea",
    ER: "Eritrea",
    EE: "Estonia",
    SZ: "Eswatini",
    ET: "Ethiopia",
    FK: "Falkland Islands",
    FO: "Faroe Islands",
    FJ: "Fiji",
    FI: "Finland",
    FR: "France",
    GF: "French Guiana",
    PF: "French Polynesia",
    TF: "French Southern Territories",
    GA: "Gabon",
    GM: "Gambia",
    GE: "Georgia",
    DE: "Germany",
    GH: "Ghana",
    GI: "Gibraltar",
    GR: "Greece",
    GL: "Greenland",
    GD: "Grenada",
    GP: "Guadeloupe",
    GU: "Guam",
    GT: "Guatemala",
    GG: "Guernsey",
    GN: "Guinea",
    GW: "Guinea-Bissau",
    GY: "Guyana",
    HT: "Haiti",
    HM: "Heard Island and McDonald Islands",
    VA: "Holy See",
    HN: "Honduras",
    HK: "Hong Kong",
    HU: "Hungary",
    IS: "Iceland",
    IN: "India",
    ID: "Indonesia",
    IR: "Iran",
    IQ: "Iraq",
    IE: "Ireland",
    IM: "Isle of Man",
    IL: "Israel",
    IT: "Italy",
    JM: "Jamaica",
    JP: "Japan",
    JE: "Jersey",
    JO: "Jordan",
    KZ: "Kazakhstan",
    KE: "Kenya",
    KI: "Kiribati",
    KP: "Korea, North",
    KR: "Korea, South",
    KW: "Kuwait",
    KG: "Kyrgyzstan",
    LA: "Lao People's Democratic Republic",
    LV: "Latvia",
    LB: "Lebanon",
    LS: "Lesotho",
    LR: "Liberia",
    LY: "Libya",
    LI: "Liechtenstein",
    LT: "Lithuania",
    LU: "Luxembourg",
    MO: "Macao",
    MG: "Madagascar",
    MW: "Malawi",
    MY: "Malaysia",
    MV: "Maldives",
    ML: "Mali",
    MT: "Malta",
    MH: "Marshall Islands",
    MQ: "Martinique",
    MR: "Mauritania",
    MU: "Mauritius",
    YT: "Mayotte",
    MX: "Mexico",
    FM: "Micronesia",
    MD: "Moldova",
    MC: "Monaco",
    MN: "Mongolia",
    ME: "Montenegro",
    MS: "Montserrat",
    MA: "Morocco",
    MZ: "Mozambique",
    MM: "Myanmar",
    NA: "Namibia",
    NR: "Nauru",
    NP: "Nepal",
    NL: "Netherlands",
    NC: "New Caledonia",
    NZ: "New Zealand",
    NI: "Nicaragua",
    NE: "Niger",
    NG: "Nigeria",
    NU: "Niue",
    NF: "Norfolk Island",
    MP: "Northern Mariana Islands",
    NO: "Norway",
    OM: "Oman",
    PK: "Pakistan",
    PW: "Palau",
    PS: "Palestine, State of",
    PA: "Panama",
    PG: "Papua New Guinea",
    PY: "Paraguay",
    PE: "Peru",
    PH: "Philippines",
    PN: "Pitcairn",
    PL: "Poland",
    PT: "Portugal",
    PR: "Puerto Rico",
    QA: "Qatar",
    RE: "Reunion",
    RO: "Romania",
    RU: "Russian Federation",
    RW: "Rwanda",
    BL: "Saint Barthelemy",
    SH: "Saint Helena",
    KN: "Saint Kitts and Nevis",
    LC: "Saint Lucia",
    MF: "Saint Martin (French part)",
    PM: "Saint Pierre and Miquelon",
    VC: "Saint Vincent and the Grenadines",
    WS: "Samoa",
    SM: "San Marino",
    ST: "Sao Tome and Principe",
    SA: "Saudi Arabia",
    SN: "Senegal",
    RS: "Serbia",
    SC: "Seychelles",
    SL: "Sierra Leone",
    SG: "Singapore",
    SX: "Sint Maarten (Dutch part)",
    SK: "Slovakia",
    SI: "Slovenia",
    SB: "Solomon Islands",
    SO: "Somalia",
    ZA: "South Africa",
    GS: "South Georgia and the South Sandwich Islands",
    SS: "South Sudan",
    ES: "Spain",
    LK: "Sri Lanka",
    SD: "Sudan",
    SR: "Suriname",
    SJ: "Svalbard and Jan Mayen",
    SE: "Sweden",
    CH: "Switzerland",
    SY: "Syrian Arab Republic",
    TW: "Taiwan",
    TJ: "Tajikistan",
    TZ: "Tanzania",
    TH: "Thailand",
    TL: "Timor-Leste",
    TG: "Togo",
    TK: "Tokelau",
    TO: "Tonga",
    TT: "Trinidad and Tobago",
    TN: "Tunisia",
    TR: "Turkey",
    TM: "Turkmenistan",
    TC: "Turks and Caicos Islands",
    TV: "Tuvalu",
    UG: "Uganda",
    UA: "Ukraine",
    AE: "United Arab Emirates",
    GB: "United Kingdom",
    UM: "United States Minor Outlying Islands",
    US: "United States",
    UY: "Uruguay",
    UZ: "Uzbekistan",
    VU: "Vanuatu",
    VE: "Venezuela",
    VN: "Viet Nam",
    VG: "Virgin Islands, British",
    VI: "Virgin Islands, U.S.",
    WF: "Wallis and Futuna",
    EH: "Western Sahara",
    YE: "Yemen",
    ZM: "Zambia",
    ZW: "Zimbabwe",
  };

  const COUNTRY_NAMES = Object.entries(COUNTRY_CODES).reduce((acc, [code, name]) => {
    acc[name.toLowerCase()] = code;
    return acc;
  }, {});

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
    first: {
      dateInputId: "firstDate",
      timeInputId: "firstTime",
      displayEl: () => dom.firstDatetimeDisplay,
      defaultDate: "1990-01-01",
      defaultTime: "12:00",
      title: "Partner A date & time",
    },
    second: {
      dateInputId: "secondDate",
      timeInputId: "secondTime",
      displayEl: () => dom.secondDatetimeDisplay,
      defaultDate: "1992-02-02",
      defaultTime: "14:00",
      title: "Partner B date & time",
    },
  };

  const locationTargets = {
    birth: {
      title: "Birth location",
      displayEl: () => dom.birthLocationDisplay,
      fields: {
        city: "city",
        nation: "nation",
        tz: "tz_str",
        lat: "lat",
        lng: "lng",
      },
      defaults: {
        city: "Amsterdam",
        nation: "NL",
        nation_name: COUNTRY_CODES.NL,
        tz: "Europe/Amsterdam",
        lat: "52.3702",
        lng: "4.8952",
      },
    },
    transit: {
      title: "Transit location",
      displayEl: () => dom.transitLocationDisplay,
      fields: {
        city: "transitCity",
        nation: "transitNation",
        tz: "transitTz",
        lat: "transitLat",
        lng: "transitLng",
      },
      defaults: {
        city: "Amsterdam",
        nation: "NL",
        nation_name: COUNTRY_CODES.NL,
        tz: "Europe/Amsterdam",
        lat: "52.3702",
        lng: "4.8952",
      },
    },
    first: {
      title: "Partner A location",
      displayEl: () => dom.firstLocationDisplay,
      fields: {
        city: "firstCity",
        nation: "firstNation",
        tz: "firstTz",
        lat: "firstLat",
        lng: "firstLng",
      },
      defaults: {
        city: "Amsterdam",
        nation: "NL",
        nation_name: COUNTRY_CODES.NL,
        tz: "Europe/Amsterdam",
        lat: "52.3702",
        lng: "4.8952",
      },
    },
    second: {
      title: "Partner B location",
      displayEl: () => dom.secondLocationDisplay,
      fields: {
        city: "secondCity",
        nation: "secondNation",
        tz: "secondTz",
        lat: "secondLat",
        lng: "secondLng",
      },
      defaults: {
        city: "New York",
        nation: "US",
        nation_name: COUNTRY_CODES.US,
        tz: "America/New_York",
        lat: "40.7128",
        lng: "-74.0060",
      },
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

  function formatCoordinate(value) {
    const num = parseFloat(value);
    if (Number.isFinite(num)) {
      return num.toFixed(4);
    }
    const clean = (value || "").toString().trim();
    return clean || "—";
  }

  function formatTimezoneShort(tz) {
    if (!tz) return "";
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date());
      const tzPart = parts.find((p) => p.type === "timeZoneName");
      if (tzPart && tzPart.value) return tzPart.value;
    } catch (err) {
    }
    return typeof tz === "string" ? tz : "";
  }

  function formatLocationBadge(values, defaults) {
    const city = (values?.city ?? defaults?.city ?? "").trim();
    const name =
      (values?.nation_name ?? COUNTRY_CODES[values?.nation] ?? defaults?.nation_name ?? values?.nation ?? "").trim();
    const cityPart = [city, name].filter(Boolean).join(", ") || "—";
    const tzLabel = formatTimezoneShort(values?.tz_str || values?.tz || defaults?.tz);
    return [cityPart, tzLabel].filter(Boolean).join(" · ");
  }

  function buildLookupHref(values) {
    const city = (values?.city || "").trim();
    const nation = (values?.nation_name || values?.nation || "").trim();
    const query = [city, nation].filter(Boolean).join(" ");
    if (!query) return "https://www.google.com/maps/search/?api=1&query=";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  function parseLatLngText(raw) {
    if (!raw || typeof raw !== "string") return null;
    const text = raw.trim();
    if (!text) return null;
    const parts = text.split(/[,\s]+/).filter(Boolean);
    if (parts.length < 2) return null;
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  function setDetectedTimezoneLabel() {
    if (!dom.locationTzCurrentLabel) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "--";
    dom.locationTzCurrentLabel.textContent = tz;
    dom.locationTzCurrentLabel.dataset.tz = tz;
  }

  function persistFormState() {
    try {
      if (!App.payloads || !App.payloads.buildPayloadFromForm || !App.state) return;
      const mode = typeof utils.getSelectedMode === "function" ? utils.getSelectedMode() : "natal";
      const { payload } = App.payloads.buildPayloadFromForm(mode) || {};
      App.state.saveFormState(mode, payload || {});
    } catch (err) {
    }
  }
 

  function normalizeLocationValues(targetKey, values) {
    const target = locationTargets[targetKey];
    const defaults = target?.defaults || {};
    const clean = (val) => {
      if (val === null || typeof val === "undefined") return "";
      return String(val).trim();
    };
    const baseTz = values?.tz_str ?? values?.tz ?? defaults.tz ?? "";
    const rawCode = clean(values?.nation ?? defaults.nation);
    const rawName = clean(values?.nation_name ?? defaults.nation_name ?? COUNTRY_CODES[rawCode] ?? rawCode);
    const resolvedCode =
      rawCode ||
      COUNTRY_NAMES[rawName.toLowerCase()] ||
      (rawName.length === 2 ? rawName.toUpperCase() : "");
    const resolvedName = COUNTRY_CODES[resolvedCode] || rawName || resolvedCode;
    return {
      city: clean(values?.city ?? defaults.city),
      nation: resolvedCode.toUpperCase(),
      nation_name: resolvedName,
      tz: clean(baseTz),
      tz_str: clean(baseTz),
      lat: clean(values?.lat ?? defaults.lat),
      lng: clean(values?.lng ?? defaults.lng),
    };
  }

  function readDomLocationValues(targetKey) {
    const target = locationTargets[targetKey];
    if (!target) return null;
    const pick = (id, fallback) => {
      const el = document.getElementById(id);
      return el && typeof el.value !== "undefined" ? el.value : fallback;
    };
    return {
      city: pick(target.fields.city, target.defaults.city),
      nation: pick(target.fields.nation, target.defaults.nation),
      nation_name: COUNTRY_CODES[pick(target.fields.nation, target.defaults.nation)] || target.defaults.nation_name,
      tz: pick(target.fields.tz, target.defaults.tz),
      tz_str: pick(target.fields.tz, target.defaults.tz),
      lat: pick(target.fields.lat, target.defaults.lat),
      lng: pick(target.fields.lng, target.defaults.lng),
    };
  }

  function getLocationValues(targetKey) {
    const target = locationTargets[targetKey];
    if (!target) return null;
    const domVals = readDomLocationValues(targetKey) || {};
    const stored = runtime.locationValues[targetKey] || {};
    const merged = { ...target.defaults, ...stored, ...domVals };
    return normalizeLocationValues(targetKey, merged);
  }

  function cacheLocationValues(targetKey, values) {
    const normalized = normalizeLocationValues(targetKey, values || getLocationValues(targetKey) || {});
    runtime.locationValues[targetKey] = normalized;
  }

  function setLocationValues(targetKey, values) {
    const target = locationTargets[targetKey];
    if (!target) return;
    const assign = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? "";
    };
    const normalized = normalizeLocationValues(targetKey, values);
    assign(target.fields.city, normalized.city);
    assign(target.fields.nation, normalized.nation);
    assign(target.fields.tz, normalized.tz_str);
    assign(target.fields.lat, normalized.lat);
    assign(target.fields.lng, normalized.lng);
    cacheLocationValues(targetKey, normalized);
  }

  function refreshLocationBadges(targetKey) {
    const targets = targetKey ? [targetKey] : Object.keys(locationTargets);
    targets.forEach((key) => {
      const target = locationTargets[key];
      if (!target) return;
      const display = target.displayEl && target.displayEl();
      if (!display) return;
      const values = getLocationValues(key);
      display.textContent = formatLocationBadge(values, target.defaults);
    });
  }

  function syncLocationRuntimeFromDom() {
    Object.keys(locationTargets).forEach((key) => {
      cacheLocationValues(key);
    });
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
          el.textContent = content;
        }
      })
      .catch((err) => {
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
      }
      return captureInstance(inlineEl.datepicker);
    }
    return null;
  }


  if (!dom.form || (!dom.chartContainer && !(App.flags && App.flags.skipSvg))) {
    App.disabled = true;
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
    if (dom.chartContainer) {
      dom.chartContainer.innerHTML = "";
    }
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

    let activeTarget = "birth";
    const timeRadios = dom.datetimeTimeList
      ? Array.from(dom.datetimeTimeList.querySelectorAll('input[name="datetimeTimeOption"]'))
      : [];

    let inlinePicker = getDatepickerInstance();
    let selectedModalDate = null;
    if (inlinePicker) {
    } else {
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
      }
    });

    const setInlineDate = (dateStr) => {
      const [y, m, d] = (dateStr || "").split("-").map((n) => parseInt(n, 10));
    if (!inlinePicker) inlinePicker = getDatepickerInstance();
    if (inlinePicker && Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      inlinePicker.setDate(new Date(y, m - 1, d));
      selectedModalDate = `${pad(y)}-${pad(m)}-${pad(d)}`;
      } else {
        selectedModalDate = dateStr || null;
        if (!inlinePicker && dom.datetimeInlinePicker) {
          dom.datetimeInlinePicker.textContent = selectedModalDate || "";
        }
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
          return resolved;
        }
      }
      if (dom.datetimeDateField && dom.datetimeDateField.value) {
        const normalized = normalizeDateString(dom.datetimeDateField.value, null);
        if (normalized) {
          return normalized;
        }
      }
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

    if (dom.datetimeNowBtn) {
      dom.datetimeNowBtn.addEventListener("click", () => {
        const now = new Date();
        const nowStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        setSelectedTime(nowStr);
        pendingTime = nowStr;
        if (dom.datetimeTimeField) {
          dom.datetimeTimeField.value = nowStr;
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
        }
      });
    }

    if (dom.datetimeTodayBtn) {
      dom.datetimeTodayBtn.addEventListener("click", () => {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        selectedModalDate = todayStr;
        setInlineDate(todayStr);
        setDateFieldValue(todayStr);
        if (dom.datetimeDateField) {
          dom.datetimeDateField.value = todayStr;
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
    };

    let modalInstance = null;
    if (window.Modal && typeof window.Modal === "function") {
      try {
        modalInstance = new window.Modal(dom.datetimeModal, {
          backdrop: "dynamic",
          closable: true,
        });
      } catch (err) {
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
        pendingTime = null;
        selectedModalDate = null;
        persistFormState();
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

  function initLocationModal() {
    const hydrateAllLocations = () => {
      Object.keys(locationTargets).forEach((key) => {
        cacheLocationValues(key);
      });
      refreshLocationBadges();
    };

    hydrateAllLocations();
    if (!dom.locationModal) return;

    let activeTarget = "birth";
    let activeSnapshot = null;

    const syncModalFields = (targetKey) => {
      const target = locationTargets[targetKey] || locationTargets.birth;
      const vals = runtime.locationValues[targetKey] || getLocationValues(targetKey) || target?.defaults || {};
      const { city, nation, tz, lat, lng } = dom.locationModalFields || {};
      if (city) city.value = vals.city || "";
      if (nation) nation.value = vals.nation_name || vals.nation || "";
      if (tz) tz.value = vals.tz || vals.tz_str || "";
      if (lat) lat.value = vals.lat || "";
      if (lng) lng.value = vals.lng || "";
      if (dom.locationModalTitle && target) {
        dom.locationModalTitle.textContent = target.title || "Edit location";
      }
      if (dom.locationLookupLink) {
        dom.locationLookupLink.href = buildLookupHref(vals);
      }
    };

    const updateLookupFromFields = () => {
      const { city, nation } = dom.locationModalFields || {};
      const cityVal = city && typeof city.value === "string" ? city.value.trim() : "";
      const nationVal = nation && typeof nation.value === "string" ? nation.value.trim() : "";
      if (dom.locationLookupLink) {
        dom.locationLookupLink.href = buildLookupHref({ city: cityVal, nation_name: nationVal, nation: nationVal });
      }
    };

    let modalInstance = null;
    if (window.Modal && typeof window.Modal === "function") {
      try {
        modalInstance = new window.Modal(dom.locationModal, {
          backdrop: "dynamic",
          closable: true,
        });
      } catch (err) {
      }
    }

    const openModal = () => {
      if (modalInstance && typeof modalInstance.show === "function") {
        modalInstance.show();
      } else {
        dom.locationModal.classList.remove("hidden");
        dom.locationModal.removeAttribute("aria-hidden");
        dom.locationModal.removeAttribute("inert");
      }
    };

    const closeModal = () => {
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }
      if (modalInstance && typeof modalInstance.hide === "function") {
        modalInstance.hide();
      } else {
        dom.locationModal.classList.add("hidden");
        dom.locationModal.setAttribute("aria-hidden", "true");
        dom.locationModal.setAttribute("inert", "true");
      }
    };

    dom.locationTriggers.forEach((btn) => {
      btn.addEventListener("click", () => {
        const requested = btn.dataset.locationTarget || "birth";
        activeTarget = locationTargets[requested] ? requested : "birth";
        activeSnapshot = getLocationValues(activeTarget);
        syncModalFields(activeTarget);
        if (dom.locationModalFields?.city) {
          dom.locationModalFields.city.focus();
        }
        openModal();
      });
    });

    setDetectedTimezoneLabel();

    if (dom.locationModalFields?.city) {
      dom.locationModalFields.city.addEventListener("input", updateLookupFromFields);
    }
    if (dom.locationModalFields?.nation) {
      dom.locationModalFields.nation.addEventListener("input", updateLookupFromFields);
    }

    if (dom.locationTzCurrentBtn && dom.locationModalFields?.tz) {
      dom.locationTzCurrentBtn.addEventListener("click", () => {
        const tz =
          (dom.locationTzCurrentLabel && dom.locationTzCurrentLabel.dataset.tz) ||
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "";
        if (!tz) return;
        dom.locationModalFields.tz.value = tz;
        setLocationValues(activeTarget, {
          ...getLocationValues(activeTarget),
          tz,
          tz_str: tz,
        });
        refreshLocationBadges(activeTarget);
        activeSnapshot = getLocationValues(activeTarget);
        if (dom.locationLookupLink) {
          dom.locationLookupLink.href = buildLookupHref(activeSnapshot);
        }
        persistFormState();
      });
    }

    if (dom.locationPasteBtn) {
      dom.locationPasteBtn.addEventListener("click", () => {
        if (!navigator.clipboard || typeof navigator.clipboard.readText !== "function") {
          return;
        }
        navigator.clipboard
          .readText()
          .then((text) => {
            const parsed = parseLatLngText(text);
            if (!parsed) return;
            if (dom.locationModalFields.lat) dom.locationModalFields.lat.value = parsed.lat.toFixed(4);
            if (dom.locationModalFields.lng) dom.locationModalFields.lng.value = parsed.lng.toFixed(4);
            setLocationValues(activeTarget, {
              ...getLocationValues(activeTarget),
              lat: parsed.lat,
              lng: parsed.lng,
            });
            refreshLocationBadges(activeTarget);
            activeSnapshot = getLocationValues(activeTarget);
          })
          .catch((err) => {
          });
      });
    }

    if (dom.locationSaveBtn) {
      dom.locationSaveBtn.addEventListener("click", () => {
        const fields = dom.locationModalFields || {};
        const readField = (el) => {
          if (!el) return "";
          const raw = typeof el.value === "string" ? el.value.trim() : el.value;
          return raw ?? "";
        };
        const rawCountry = readField(fields.nation);
        const resolvedCode =
          COUNTRY_NAMES[rawCountry.toLowerCase()] ||
          (COUNTRY_CODES[rawCountry.toUpperCase()] ? rawCountry.toUpperCase() : "");
        const resolvedName = COUNTRY_CODES[resolvedCode] || rawCountry;
        setLocationValues(activeTarget, {
          city: readField(fields.city),
          nation: resolvedCode,
          nation_name: resolvedName,
          tz: readField(fields.tz),
          tz_str: readField(fields.tz),
          lat: readField(fields.lat),
          lng: readField(fields.lng),
        });
        refreshLocationBadges(activeTarget);
        activeSnapshot = getLocationValues(activeTarget);
        if (dom.locationLookupLink) {
          dom.locationLookupLink.href = buildLookupHref(activeSnapshot);
        }
        persistFormState();
        closeModal();
      });
    }

    const closeButtons = dom.locationModal.querySelectorAll('[data-modal-hide="location-modal"]');
    closeButtons.forEach((btn) =>
      btn.addEventListener("click", () => {
        if (activeSnapshot) {
          syncModalFields(activeTarget);
          // Restore modal fields to the last saved snapshot so they don't leak across targets.
          const { city, nation, tz, lat, lng } = dom.locationModalFields || {};
          if (city) city.value = activeSnapshot.city || "";
          if (nation) nation.value = activeSnapshot.nation || "";
          if (tz) tz.value = activeSnapshot.tz || activeSnapshot.tz_str || "";
          if (lat) lat.value = activeSnapshot.lat || "";
          if (lng) lng.value = activeSnapshot.lng || "";
          if (dom.locationLookupLink) {
            dom.locationLookupLink.href = buildLookupHref(activeSnapshot);
          }
        } else {
          syncModalFields(activeTarget);
        }
        closeModal();
      })
    );
    dom.locationModal.addEventListener("click", (event) => {
      if (event.target === dom.locationModal) {
        if (activeSnapshot) {
          const { city, nation, tz, lat, lng } = dom.locationModalFields || {};
          if (city) city.value = activeSnapshot.city || "";
          if (nation) nation.value = activeSnapshot.nation || "";
          if (tz) tz.value = activeSnapshot.tz || activeSnapshot.tz_str || "";
          if (lat) lat.value = activeSnapshot.lat || "";
          if (lng) lng.value = activeSnapshot.lng || "";
          if (dom.locationLookupLink) {
            dom.locationLookupLink.href = buildLookupHref(activeSnapshot);
          }
        } else {
          syncModalFields(activeTarget);
        }
        closeModal();
      }
    });
  }

  function initNavMenu() {
    const toggle = document.getElementById("navToggle");
    const menu = document.getElementById("navMenu");
    if (!toggle || !menu) return;

    const closeMenu = () => {
      if (menu.classList.contains("hidden")) return;
      menu.classList.add("hidden");
      toggle.setAttribute("aria-expanded", "false");
    };

    const openMenu = () => {
      menu.classList.remove("hidden");
      toggle.setAttribute("aria-expanded", "true");
    };

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    document.addEventListener("click", (event) => {
      if (menu.classList.contains("hidden")) return;
      if (!menu.contains(event.target) && !toggle.contains(event.target)) {
        closeMenu();
      }
    });

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });
  }

  App.dom = dom;
  App.constants = constants;
  App.runtime = runtime;
  App.setReportTitle = setReportTitle;
  App.utils = {
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
    refreshLocationBadges,
    syncLocationRuntimeFromDom,
    setDetectedTimezoneLabel,
    persistFormState,
  };

  initDatetimeModal();
  initLocationModal();
  initNavMenu();
})();
