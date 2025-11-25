(function () {
  const HomeApp = window.HomeApp || {};
  if (HomeApp.disabled) return;

  const { config } = HomeApp;
  const { getConfigFromInputs } = config;

  function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
  }

  function toFloat(id, fallback) {
    const v = parseFloat(getValue(id));
    return Number.isFinite(v) ? v : fallback;
  }

  function getDateTimeParts(dateId, timeId, defaults) {
    const datePart = (getValue(dateId) || "").trim();
    const timePart = (getValue(timeId) || "").trim();
    const [year, month, day] = datePart.split("-").map((n) => parseInt(n, 10));
    const [hourRaw = `${defaults.hour}`, minuteRaw = `${defaults.minute}`] = timePart.split(":");
    const hour = parseInt(hourRaw, 10);
    const minute = parseInt(minuteRaw, 10);
    return {
      year: Number.isFinite(year) ? year : defaults.year,
      month: Number.isFinite(month) ? month : defaults.month,
      day: Number.isFinite(day) ? day : defaults.day,
      hour: Number.isFinite(hour) ? hour : defaults.hour,
      minute: Number.isFinite(minute) ? minute : defaults.minute,
    };
  }

  function buildRelationshipPartner(prefix, defaults) {
    const getVal = (suffix, fallback) => {
      const el = document.getElementById(`${prefix}${suffix}`);
      return el && el.value ? el.value : fallback;
    };
    const dateStr = getVal("Date", defaults.date);
    const timeStr = getVal("Time", defaults.time);
    const [year, month, day] = (dateStr || "").split("-").map((n) => parseInt(n, 10));
    const [hour, minute] = (timeStr || "").split(":").map((n) => parseInt(n, 10));
    return {
      name: getVal("Name", defaults.name),
      year: Number.isFinite(year) ? year : defaults.date.split("-")[0],
      month: Number.isFinite(month) ? month : defaults.date.split("-")[1],
      day: Number.isFinite(day) ? day : defaults.date.split("-")[2],
      hour: Number.isFinite(hour) ? hour : 12,
      minute: Number.isFinite(minute) ? minute : 0,
      lat: parseFloat(getVal("Lat", defaults.lat)) || defaults.lat,
      lng: parseFloat(getVal("Lng", defaults.lng)) || defaults.lng,
      tz_str: getVal("Tz", defaults.tz),
      city: getVal("City", defaults.city),
      nation: getVal("Nation", defaults.nation),
    };
  }

  function buildPayloadFromForm(mode) {
    const birthDateParts = getDateTimeParts("dateInput", "timeInput", {
      year: 1990,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
    });

    const transitDateParts = getDateTimeParts("transitDateInput", "transitTimeInput", {
      year: 2025,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
    });

    const config = getConfigFromInputs();

    const birth = {
      name: getValue("name") || "Subject",
      ...birthDateParts,
      lat: toFloat("lat", 52.3702),
      lng: toFloat("lng", 4.8952),
      tz_str: getValue("tz_str") || "Europe/Amsterdam",
      city: getValue("city") || "Amsterdam",
      nation: getValue("nation") || "NL",
    };

    const moment = {
      ...transitDateParts,
      lat: toFloat("transitLat", 52.3702),
      lng: toFloat("transitLng", 4.8952),
      tz_str: getValue("transitTz") || "Europe/Amsterdam",
      city: getValue("transitCity") || "Amsterdam",
      nation: getValue("transitNation") || "NL",
    };

    const normalizedConfig = {
      ...config,
      sidereal_mode: config.zodiac_type === "Sidereal" ? config.sidereal_mode : null,
    };

    if (mode === "natal") {
      return {
        payload: {
          birth,
          config: normalizedConfig,
        },
        birthDateParts,
        transitDateParts: null,
        config: normalizedConfig,
      };
    }

    if (mode === "transit") {
      return {
        payload: {
          moment,
          birth: null,
          config: normalizedConfig,
        },
        birthDateParts: null,
        transitDateParts,
        config: normalizedConfig,
      };
    }

    if (mode === "natal_transit") {
      return {
        payload: {
          moment,
          birth,
          config: normalizedConfig,
        },
        birthDateParts,
        transitDateParts,
        config: normalizedConfig,
      };
    }

    if (mode === "relationship") {
      const first = buildRelationshipPartner("first", {
        name: "Partner A",
        date: "1990-01-01",
        time: "12:00",
        lat: 52.3702,
        lng: 4.8952,
        tz: "Europe/Amsterdam",
        city: "Amsterdam",
        nation: "NL",
      });
      const second = buildRelationshipPartner("second", {
        name: "Partner B",
        date: "1992-02-02",
        time: "14:00",
        lat: 40.7128,
        lng: -74.006,
        tz: "America/New_York",
        city: "New York",
        nation: "US",
      });

      return {
        payload: {
          birth: null,
          moment: null,
          first,
          second,
          config: normalizedConfig,
        },
        birthDateParts: null,
        transitDateParts: null,
        config: normalizedConfig,
      };
    }

    return {
      payload: {
        birth: null,
        moment,
        config: normalizedConfig,
      },
      birthDateParts,
      transitDateParts,
      config: normalizedConfig,
    };
  }

  function buildRelationshipPayload() {
    return {
      first: buildRelationshipPartner("first", {
        name: "Partner A",
        date: "1990-01-01",
        time: "12:00",
        lat: 52.3702,
        lng: 4.8952,
        tz: "Europe/Amsterdam",
        city: "Amsterdam",
        nation: "NL",
      }),
      second: buildRelationshipPartner("second", {
        name: "Partner B",
        date: "1992-02-02",
        time: "14:00",
        lat: 40.7128,
        lng: -74.006,
        tz: "America/New_York",
        city: "New York",
        nation: "US",
      }),
      config: getConfigFromInputs(),
    };
  }

  HomeApp.payloads = {
    getValue,
    toFloat,
    getDateTimeParts,
    buildPayloadFromForm,
    buildRelationshipPayload,
  };
})();
