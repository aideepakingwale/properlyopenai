const BASE = '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request('/api/health'),
  listChildren: () => request('/api/children'),
  createChild: (body) => request('/api/children', { method: 'POST', body: JSON.stringify(body) }),
  getChild: (id) => request(`/api/children/${id}`),
  updateChild: (id, body) =>
    request(`/api/children/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  recordActivity: (id, body = {}) =>
    request(`/api/children/${id}/activity`, { method: 'POST', body: JSON.stringify(body) }),
  getProgress: (id) => request(`/api/children/${id}/progress`),
  getRewards: (id) => request(`/api/children/${id}/rewards`),
  uploadChildAvatar: (id, image) =>
    request(`/api/children/${id}/avatar`, {
      method: 'POST',
      body: JSON.stringify({ image }),
    }),
  generateStory: (body) =>
    request('/api/stories/generate', { method: 'POST', body: JSON.stringify(body) }),
  createPracticePack: (body) =>
    request('/api/stories/practice', { method: 'POST', body: JSON.stringify(body) }),
  listPracticeSentences: (phase) =>
    request(`/api/stories/practice?phase=${Number(phase) || 2}`),
  getStory: (id) => request(`/api/stories/${id}`),
  startSession: (body) =>
    request('/api/sessions/start', { method: 'POST', body: JSON.stringify(body) }),
  getSession: (id) => request(`/api/sessions/${id}`),
  validateSession: (id, transcript) =>
    request(`/api/sessions/${id}/validate`, {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    }),
  completeSession: (id, body) =>
    request(`/api/sessions/${id}/complete`, { method: 'POST', body: JSON.stringify(body) }),
  coach: (body) => request('/api/coach', { method: 'POST', body: JSON.stringify(body) }),
  pronounce: (body) =>
    request('/api/pronounce', { method: 'POST', body: JSON.stringify(body) }),
  phases: () => request('/api/phonics/phases'),
  phaseGuide: (phase) => request(`/api/phonics/phases/${phase}`),
  pdfUrl: (storyId) => `/api/stories/${storyId}/pdf`,
};

export function wsAudioUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  return `${proto}://${host}/ws/audio`;
}
