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

  const MAJOR_ASPECT_PATTERNS = [
    {
      id: "stellium",
      name: "Stellium",
      planets: "3+ planets",
      aspects: ["conjunction"],
      aspectsLabel: "Conjunctions",
      geometry: "Clustered within ~30° (often one sign) with overlapping 0° links.",
      orb: "Planets within ~5–10° of each other across the cluster.",
      construction: "Conjunction-series bundle occupying one tight sector.",
    },
    {
      id: "t_square",
      name: "T-Square",
      planets: "3 planets",
      aspects: ["opposition", "square"],
      aspectsLabel: "Opposition + Squares",
      geometry: "Opposition capped by two 90° squares, forming a T spine.",
      orb: "Squares/opposition typically ±8–10°.",
      construction: "A ↔ B opposition with C square to both (C = focal).",
    },
    {
      id: "grand_trine",
      name: "Grand Trine",
      planets: "3 planets",
      aspects: ["trine"],
      aspectsLabel: "Trines",
      geometry: "Three 120° links in an equilateral triangle.",
      orb: "Trines usually ±6–8° (often ~±7°).",
      construction: "A–B–C all 120° apart forming a closed triangle.",
    },
    {
      id: "grand_cross",
      name: "Grand Cross",
      planets: "4 planets",
      aspects: ["opposition", "square"],
      aspectsLabel: "Oppositions + Squares",
      geometry: "Four points every 90°: two oppositions plus four squares.",
      orb: "Squares/oppositions typically ±8–10°.",
      construction: "A↔C and B↔D oppositions; each is square to its neighbors.",
    },
    {
      id: "grand_sextile",
      name: "Grand Sextile",
      planets: "6 planets",
      aspects: ["sextile", "trine"],
      aspectsLabel: "Sextiles + Trines",
      geometry: "Hexagram/Star of David: alternating 60° and 120° points.",
      orb: "Sextiles ±5–6°; trines ±6–8°.",
      construction: "Two interlaced Grand Trines linked by six sextiles.",
    },
    {
      id: "mystic_rectangle",
      name: "Mystic Rectangle",
      planets: "4 planets",
      aspects: ["opposition", "trine", "sextile"],
      aspectsLabel: "Oppositions, Trines, Sextiles",
      geometry: "Two oppositions stitched by trines and sextiles into a rectangle.",
      orb: "Oppositions ±8–10°; trines 6–8°; sextiles 5–6°.",
      construction: "A↔C and B↔D; A sextile D & trine B, C sextile B & trine D.",
    },
    {
      id: "trapeze",
      name: "Trapeze / Cradle",
      planets: "4 planets",
      aspects: ["opposition", "sextile"],
      aspectsLabel: "Opposition + Sextiles",
      geometry: "Three sextiles in a row with an opposition across the open ends.",
      orb: "Sextiles ±5–6°; opposition ±8–10°.",
      construction: "A sextile B sextile C sextile D, with A↔D in opposition.",
    },
  ];

  function buildMajorAspectIcons() {
    const wrap = (id, defs, shapes) => {
      const bgId = `${id}-bg`;
      return `
        <svg viewBox="0 0 88 88" class="adv-pattern-svg" aria-hidden="true" role="img">
          <defs>
            <linearGradient id="${bgId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.32" />
              <stop offset="100%" stop-color="#6366f1" stop-opacity="0.25" />
            </linearGradient>
            ${defs || ""}
          </defs>
          <rect x="2" y="2" width="84" height="84" rx="18" fill="url(#${bgId})" stroke="rgba(56, 189, 248, 0.45)" />
          <rect x="2" y="2" width="84" height="84" rx="18" fill="rgba(7, 12, 24, 0.55)" />
          ${shapes}
        </svg>
      `;
    };
    const generic = wrap(
      "generic",
      "",
      `<circle cx="44" cy="44" r="26" fill="rgba(56, 189, 248, 0.08)" stroke="#38bdf8" stroke-width="2.2" />`
    );
    return {
      generic,
      stellium: wrap(
        "stellium",
        `
          <radialGradient id="stellium-halo" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.7" />
            <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.05" />
          </radialGradient>
          <linearGradient id="stellium-orbit" x1="20%" y1="70%" x2="80%" y2="35%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.6" />
            <stop offset="100%" stop-color="#c084fc" stop-opacity="0.8" />
          </linearGradient>
        `,
        `
          <circle cx="44" cy="44" r="30" fill="url(#stellium-halo)" opacity="0.5" />
          <path d="M18 54c7-10 21-16 34-14 7 1 13 4 17 8" fill="none" stroke="url(#stellium-orbit)" stroke-width="2.6" stroke-linecap="round" />
          <path d="M20 42c6-5 12-8 20-9" fill="none" stroke="rgba(99, 102, 241, 0.5)" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="4 4" />
          <g fill="#7dd3fc" stroke="#0ea5e9" stroke-width="1.8">
            <circle cx="32" cy="50" r="6.2" />
            <circle cx="42.5" cy="46" r="7" />
            <circle cx="53.5" cy="48.5" r="5.8" />
          </g>
          <circle cx="46" cy="33" r="3.2" fill="#c084fc" opacity="0.9" />
        `
      ),
      t_square: wrap(
        "t_square",
        `
          <linearGradient id="t-square-spine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#f97316" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#ef4444" stop-opacity="0.8" />
          </linearGradient>
        `,
        `
          <circle cx="44" cy="50" r="28" fill="rgba(248, 113, 113, 0.07)" />
          <line x1="22" y1="50" x2="66" y2="50" stroke="#fda4af" stroke-width="2.6" stroke-linecap="round" />
          <line x1="44" y1="22" x2="44" y2="50" stroke="url(#t-square-spine)" stroke-width="3.4" stroke-linecap="round" />
          <circle cx="22" cy="50" r="6" fill="#fef08a" stroke="#facc15" stroke-width="1.8" />
          <circle cx="66" cy="50" r="6" fill="#fef08a" stroke="#facc15" stroke-width="1.8" />
          <circle cx="44" cy="22" r="7" fill="#f97316" stroke="#fb923c" stroke-width="2" />
          <path d="M22 50 L44 22 L66 50" fill="none" stroke="rgba(255, 255, 255, 0.35)" stroke-width="1.4" stroke-dasharray="4 3" />
        `
      ),
      grand_trine: wrap(
        "grand_trine",
        `
          <linearGradient id="grand-trine-line" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#22d3ee" />
            <stop offset="100%" stop-color="#2dd4bf" />
          </linearGradient>
        `,
        `
          <polygon points="44,16 18,64 70,64" fill="rgba(34, 211, 238, 0.08)" stroke="url(#grand-trine-line)" stroke-width="3" stroke-linejoin="round" />
          <circle cx="44" cy="16" r="6.5" fill="#67e8f9" stroke="#22d3ee" stroke-width="1.8" />
          <circle cx="18" cy="64" r="6" fill="#a5f3fc" stroke="#22d3ee" stroke-width="1.6" />
          <circle cx="70" cy="64" r="6" fill="#a5f3fc" stroke="#22d3ee" stroke-width="1.6" />
          <path d="M30 42 Q44 48 58 42" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.3" stroke-dasharray="5 3" />
        `
      ),
      grand_cross: wrap(
        "grand_cross",
        `
          <linearGradient id="grand-cross-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#f87171" />
            <stop offset="100%" stop-color="#fbbf24" />
          </linearGradient>
        `,
        `
          <rect x="20" y="20" width="48" height="48" rx="8" fill="rgba(248, 113, 113, 0.08)" stroke="url(#grand-cross-line)" stroke-width="3" />
          <line x1="44" y1="18" x2="44" y2="70" stroke="#fcd34d" stroke-width="2.4" stroke-linecap="round" />
          <line x1="18" y1="44" x2="70" y2="44" stroke="#fcd34d" stroke-width="2.4" stroke-linecap="round" />
          <line x1="22" y1="22" x2="66" y2="66" stroke="rgba(255,255,255,0.28)" stroke-width="1.4" stroke-dasharray="4 3" />
          <line x1="66" y1="22" x2="22" y2="66" stroke="rgba(255,255,255,0.28)" stroke-width="1.4" stroke-dasharray="4 3" />
          <g fill="#fb7185" stroke="#fecdd3" stroke-width="1.8">
            <circle cx="22" cy="22" r="5.5" />
            <circle cx="66" cy="22" r="5.5" />
            <circle cx="22" cy="66" r="5.5" />
            <circle cx="66" cy="66" r="5.5" />
          </g>
        `
      ),
      grand_sextile: wrap(
        "grand_sextile",
        `
          <linearGradient id="grand-sextile-line" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#34d399" />
            <stop offset="100%" stop-color="#38bdf8" />
          </linearGradient>
        `,
        `
          <polygon points="44,12 66,24 66,46 44,58 22,46 22,24" fill="rgba(52, 211, 153, 0.08)" stroke="url(#grand-sextile-line)" stroke-width="2.5" stroke-linejoin="round" />
          <polygon points="44,20 60,32 52,52 36,52 28,32" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linejoin="round" />
          <polygon points="44,4 74,24 74,52 44,72 14,52 14,24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.4" stroke-dasharray="4 3" />
          <g fill="#bbf7d0" stroke="#34d399" stroke-width="1.6">
            <circle cx="44" cy="12" r="5" />
            <circle cx="66" cy="24" r="5" />
            <circle cx="66" cy="46" r="5" />
            <circle cx="44" cy="58" r="5" />
            <circle cx="22" cy="46" r="5" />
            <circle cx="22" cy="24" r="5" />
          </g>
        `
      ),
      mystic_rectangle: wrap(
        "mystic_rectangle",
        `
          <linearGradient id="mystic-trine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#22d3ee" />
            <stop offset="100%" stop-color="#c084fc" />
          </linearGradient>
          <linearGradient id="mystic-sextile" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#facc15" />
            <stop offset="100%" stop-color="#fb923c" />
          </linearGradient>
        `,
        `
          <rect x="20" y="22" width="48" height="44" rx="10" fill="rgba(192, 132, 252, 0.08)" stroke="url(#mystic-trine)" stroke-width="2.5" />
          <line x1="20" y1="44" x2="68" y2="44" stroke="rgba(255,255,255,0.28)" stroke-width="1.4" stroke-dasharray="4 3" />
          <line x1="20" y1="22" x2="68" y2="66" stroke="url(#mystic-sextile)" stroke-width="2.2" stroke-linecap="round" />
          <line x1="68" y1="22" x2="20" y2="66" stroke="url(#mystic-sextile)" stroke-width="2.2" stroke-linecap="round" />
          <line x1="20" y1="22" x2="68" y2="22" stroke="url(#mystic-trine)" stroke-width="2.2" stroke-linecap="round" />
          <line x1="20" y1="66" x2="68" y2="66" stroke="url(#mystic-trine)" stroke-width="2.2" stroke-linecap="round" />
          <g fill="#fef3c7" stroke="#facc15" stroke-width="1.6">
            <circle cx="20" cy="22" r="5.2" />
            <circle cx="68" cy="22" r="5.2" />
            <circle cx="68" cy="66" r="5.2" />
            <circle cx="20" cy="66" r="5.2" />
          </g>
        `
      ),
      trapeze: wrap(
        "trapeze",
        `
          <linearGradient id="trapeze-sextile" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#34d399" />
            <stop offset="100%" stop-color="#22d3ee" />
          </linearGradient>
          <linearGradient id="trapeze-opposition" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f472b6" />
            <stop offset="100%" stop-color="#fb7185" />
          </linearGradient>
        `,
        `
          <path d="M20 52 L36 32 L58 30 L70 52 Z" fill="rgba(52, 211, 153, 0.08)" stroke="url(#trapeze-sextile)" stroke-width="2.2" stroke-linejoin="round" />
          <line x1="20" y1="52" x2="70" y2="52" stroke="url(#trapeze-opposition)" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="5 3" />
          <path d="M36 32 L58 30" stroke="rgba(255,255,255,0.32)" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="3 3" />
          <g fill="#a7f3d0" stroke="#34d399" stroke-width="1.6">
            <circle cx="20" cy="52" r="5.2" />
            <circle cx="36" cy="32" r="5.2" />
            <circle cx="58" cy="30" r="5.2" />
            <circle cx="70" cy="52" r="5.2" />
          </g>
          <circle cx="45" cy="50" r="6" fill="#fb7185" stroke="#f472b6" stroke-width="1.8" opacity="0.9" />
        `
      ),
    };
  }

  const MAJOR_ASPECT_ICON_MAP = buildMajorAspectIcons();

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

  function classifyAspect(diff, aspects = ASPECTS) {
    if (!Array.isArray(aspects)) return null;
    for (const asp of aspects) {
      const delta = Math.abs(diff - asp.angle);
      if (delta <= asp.orb) return { ...asp, orb: delta };
    }
    return null;
  }

  function computeAspects(points, activeKeys = [], aspects = ASPECTS) {
    if (!points || typeof points !== "object") return [];
    const keys = Array.isArray(activeKeys) && activeKeys.length ? activeKeys : Object.keys(points);
    const results = [];
    for (let i = 0; i < keys.length; i++) {
      const baseKey = keys[i];
      const base = points[baseKey];
      if (!base || !Number.isFinite(base.abs_pos)) continue;
      for (let j = i + 1; j < keys.length; j++) {
        const otherKey = keys[j];
        const other = points[otherKey];
        if (!other || !Number.isFinite(other.abs_pos)) continue;
        const diffRaw = Math.abs(base.abs_pos - other.abs_pos) % 360;
        const diff = diffRaw > 180 ? 360 - diffRaw : diffRaw;
        const aspect = classifyAspect(diff, aspects);
        if (aspect) {
          results.push({ baseKey, otherKey, aspect, base, other });
        }
      }
    }
    return results.sort((a, b) => a.aspect.orb - b.aspect.orb);
  }

  function resolveMajorAspectPatterns(aspects, points, patterns = MAJOR_ASPECT_PATTERNS) {
    const safeAspects = Array.isArray(aspects) ? aspects : [];
    const lower = (v) => (typeof v === "string" ? v.toLowerCase() : v);
    return (patterns || []).map((pattern) => {
      const aspectNames = new Set((pattern.aspects || []).map((a) => lower(a)));
      const matches = safeAspects.filter((entry) => aspectNames.has(lower(entry.aspect?.name)));
      return { pattern, matches, points };
    });
  }

  function getMajorAspectIcon(id) {
    return MAJOR_ASPECT_ICON_MAP[id] || MAJOR_ASPECT_ICON_MAP.generic;
  }

  window.AppShared = {
    SIGN_META,
    ELEMENT_ICON,
    QUALITY_ICON,
    houseOrder,
    ASPECTS,
    ASPECT_ICON_MAP,
    POINTS_ICONS,
    MAJOR_ASPECT_PATTERNS,
    MAJOR_ASPECT_ICON_MAP,
    MOON_PHASES,
    emojiNumber,
    toOrdinal: toOrdinalWithSuffix,
    classifyAspect,
    computeAspects,
    resolveMajorAspectPatterns,
    getMajorAspectIcon,
    formatHouseLabel,
    formatHouseLabelShort,
    formatDateLabel,
    capitalise,
  };
})();
