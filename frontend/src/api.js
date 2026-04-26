const BASE = '/api';

async function request(method, path, body) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Unknown error');
    return json.data;
}

// ─── Batch ─────────────────────────────────────────────────────────────────────
export const createBatch = (data) => request('POST', '/batch', data);
export const addDrying = (id, data) => request('POST', `/batch/${id}/drying`, data);
export const addMixing = (id, data) => request('POST', `/batch/${id}/mixing`, data);
export const addProduct = (id, data) => request('POST', `/batch/${id}/product`, data);
export const readBatch = (id) => request('GET', `/batch/${id}`);

// ─── Transport ─────────────────────────────────────────────────────────────────
export const createTransport = (data) => request('POST', '/transport', data);
export const trackCargo = (id, data) => request('POST', `/transport/${id}/track`, data);
export const completeTransport = (id, data) => request('POST', `/transport/${id}/complete`, data);
export const readTransport = (id) => request('GET', `/transport/${id}`);

// ─── Trace ─────────────────────────────────────────────────────────────────────
export const getFullTrace = (id) => request('GET', `/trace/${id}`);
