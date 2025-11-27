(function () {
  const SIGN_META = {
    Ari: { name: "Aries", icon: "♈︎" },
    Tau: { name: "Taurus", icon: "♉︎" },
    Gem: { name: "Gemini", icon: "♊︎" },
    Can: { name: "Cancer", icon: "♋︎" },
    Leo: { name: "Leo", icon: "♌︎" },
    Vir: { name: "Virgo", icon: "♍︎" },
    Lib: { name: "Libra", icon: "♎︎" },
    Sco: { name: "Scorpio", icon: "♏︎" },
    Sag: { name: "Sagittarius", icon: "♐︎" },
    Cap: { name: "Capricorn", icon: "♑︎" },
    Aqu: { name: "Aquarius", icon: "♒︎" },
    Pis: { name: "Pisces", icon: "♓︎" },
  };

  const ELEMENT_ICON = {
    Fire: "🔥",
    Earth: "🌍",
    Air: "🌬️",
    Water: "💧",
  };

  const QUALITY_ICON = {
    Cardinal: "⬆️",
    Fixed: "⏺️",
    Mutable: "🔁",
  };

  const houseOrder = [
    "First_House",
    "Second_House",
    "Third_House",
    "Fourth_House",
    "Fifth_House",
    "Sixth_House",
    "Seventh_House",
    "Eighth_House",
    "Ninth_House",
    "Tenth_House",
    "Eleventh_House",
    "Twelfth_House",
  ];

  const ASPECTS = [
    { name: "conjunction", angle: 0, orb: 6, icon: "◎" },
    { name: "sextile", angle: 60, orb: 4, icon: "✺" },
    { name: "square", angle: 90, orb: 6, icon: "□" },
    { name: "trine", angle: 120, orb: 6, icon: "△" },
    { name: "opposition", angle: 180, orb: 6, icon: "☍" },
  ];

  const ASPECT_ICON_MAP = {
    conjunction: "◎",
    sextile: "✺",
    square: "□",
    trine: "△",
    opposition: "☍",
  };

   const POINTS_ICONS = {
    sun: "☉",
    moon: "☾",
    ascendant: "↗",
    mercury: "☿️",
    venus: "♀️",
    mars: "♂️",
    jupiter: "♃",
    saturn: "♄",
    uranus: "⛢",
    neptune: "♆",
    pluto: "♇",
  };

  const MOON_PHASES = [
      { name: "New Moon", icon: "🌑" },
      { name: "Waxing Crescent", icon: "🌒" },
      { name: "First Quarter", icon: "🌓" },
      { name: "Waxing Gibbous", icon: "🌔" },
      { name: "Full Moon", icon: "🌕" },
      { name: "Waning Gibbous", icon: "🌖" },
      { name: "Last Quarter", icon: "🌗" },
      { name: "Waning Crescent", icon: "🌘" },
    ];

  function emojiNumber(num) {
    const map = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "1️⃣1️⃣", "1️⃣2️⃣ "];
    return map[num] || num;
  }

  function toOrdinalWithSuffix(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return "";
    const suffix =
      ["th", "st", "nd", "rd"][((num % 100) - 20) % 10] || ["th", "st", "nd", "rd"][num % 10] || "th";
    return `${num}${suffix}`;
  }

  function formatHouseLabelShort(houseKey) {
    const idx = houseOrder.indexOf(houseKey);
    if (idx >= 0) return `${toOrdinalWithSuffix(idx + 1)}`;
    return houseKey;
  }

  function formatHouseLabel(houseKey) {
    const idx = houseOrder.indexOf(houseKey);
    if (idx >= 0) return `${toOrdinalWithSuffix(idx + 1)} House`;
    const clean = (houseKey || "").replace(/_/g, " ");
    return clean || "House";
  }

  function formatDateLabel(obj) {
    if (!obj) return { label: "—", weekday: "", tzShort: "" };
    const iso = obj.iso_formatted_local_datetime || obj.iso_formatted_utc_datetime;
    const tz = obj.tz_str || obj.timezone || "UTC";
    try {
      const date = iso ? new Date(iso) : null;
      const opts = { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: tz, timeZoneName: "short" };
      const formatter = new Intl.DateTimeFormat("en-GB", opts);
      const parts = date ? formatter.formatToParts(date) : [];
      const weekday = parts.find((p) => p.type === "weekday")?.value || obj.day_of_week || "";
      const time = parts.map((p) => p.value).join("");
      return { label: time, weekday, tzShort: parts.find((p) => p.type === "timeZoneName")?.value || "" };
    } catch {
      return { label: obj.iso_formatted_local_datetime || "—", weekday: obj.day_of_week || "", tzShort: "" };
    }
  }
  function capitalise(str) {
    if (typeof str !== "string" || str.length === 0) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  window.AppShared = {
    SIGN_META,
    ELEMENT_ICON,
    QUALITY_ICON,
    houseOrder,
    ASPECTS,
    ASPECT_ICON_MAP,
    POINTS_ICONS,
    MOON_PHASES,
    emojiNumber,
    toOrdinal: toOrdinalWithSuffix,
    formatHouseLabel,
    formatHouseLabelShort,
    formatDateLabel,
    capitalise,
  };
})();
