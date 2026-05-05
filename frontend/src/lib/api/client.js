const BASIC_USER = import.meta.env.VITE_API_USER;
const BASIC_PASS = import.meta.env.VITE_API_PASS;
const AUTH_HEADER =
  BASIC_USER && BASIC_PASS ? `Basic ${btoa(`${BASIC_USER}:${BASIC_PASS}`)}` : null;

const baseHeaders = { 'Content-Type': 'application/json' };
const headersWithAuth = AUTH_HEADER ? { ...baseHeaders, Authorization: AUTH_HEADER } : baseHeaders;

async function parseJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Unexpected JSON from ${res.url}: ${text}`);
  }
}

async function getJson(path) {
  const res = await fetch(path, {
    method: 'GET',
    headers: headersWithAuth,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${path} failed: ${res.status} ${res.statusText} - ${body}`);
  }
  return parseJson(res);
}

async function postJson(path, payload) {
  const res = await fetch(path, {
    method: 'POST',
    headers: headersWithAuth,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${path} failed: ${res.status} ${res.statusText} - ${body}`);
  }
  return parseJson(res);
}

async function postSvg(path, payload) {
  const res = await fetch(path, {
    method: 'POST',
    headers: headersWithAuth,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${path} failed: ${res.status} ${res.statusText} - ${body}`);
  }
  return res.text();
}

async function postPdf(path, payload) {
  const res = await fetch(path, {
    method: 'POST',
    headers: headersWithAuth,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${path} failed: ${res.status} ${res.statusText} - ${body}`);
  }
  return res.blob();
}

export async function requestChartDataAndSvg(mode, payload) {
  if (mode === 'natal') {
    const [json, svg] = await Promise.all([
      postJson('/api/natal', payload),
      postSvg('/api/svg/natal', payload),
    ]);
    return { json, svg };
  }

  if (mode === 'transit') {
    const [json, svg] = await Promise.all([
      postJson('/api/transit', payload),
      postSvg('/api/svg/transit', payload),
    ]);
    return { json, svg };
  }

  if (mode === 'natal_transit') {
    const [json, svg] = await Promise.all([
      postJson('/api/transit', payload),
      postSvg('/api/svg/transit', payload),
    ]);
    return { json, svg };
  }

  const [json, svg] = await Promise.all([
    postJson('/api/relationship', payload),
    postSvg('/api/svg/synastry', { ...payload, grid_view: false }),
  ]);
  return { json, svg };
}

export async function requestChartData(mode, payload) {
  if (mode === 'natal') {
    return postJson('/api/natal', payload);
  }

  if (mode === 'transit') {
    return postJson('/api/transit', payload);
  }

  if (mode === 'natal_transit') {
    return postJson('/api/transit', payload);
  }

  return postJson('/api/relationship', payload);
}

export async function requestReport(payload) {
  return postJson('/api/report', payload);
}

export async function requestTransitRange(payload) {
  return postJson('/api/transit-range', payload);
}

export async function requestAspectSpans(payload) {
  return postJson('/api/aspect-spans', payload);
}

export async function requestKinematicAspectSpans(payload) {
  return postJson('/api/aspect-spans-kinematic', payload);
}

export async function requestTimeRangeSweeps(payload) {
  return postJson('/api/timeRangeSweeps', payload);
}

export async function requestChartPdf(payload) {
  return postPdf('/api/svg/pdf', payload);
}

export async function requestReportPdf(payload) {
  return postPdf('/api/report/pdf', payload);
}

export async function requestWeeklyRaySchedule(payload) {
  return postJson('/api/weekly-ray-schedule', payload);
}

export async function requestWeeklyRaySchedulePdf(payload) {
  return postPdf('/api/weekly-ray-schedule/pdf', payload);
}

export async function requestGeoStatus() {
  return getJson('/api/geo/status');
}

export async function searchGeoLocations(query) {
  return postJson('/api/geo/search', { query });
}

export async function resolveGeoLocation(placeId) {
  return postJson('/api/geo/resolve', { place_id: placeId });
}

export async function requestEducationTopic(fileId) {
  return getJson(`/api/education/${fileId}`);
}
