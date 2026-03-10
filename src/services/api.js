import { API } from '../config/constants';

export async function apiCall(action, params = {}) {
  if (action === 'guardar') {
    const formData = new URLSearchParams();
    formData.append('action', 'guardar');
    formData.append('data', JSON.stringify(params.data));
    if (params.id) formData.append('id', params.id); 
    if (params.baseUrl) formData.append('baseUrl', params.baseUrl); 
    const r = await fetch(API, { method: 'POST', body: formData });
    return r.json();
  } else {
    const url = new URL(API);
    url.searchParams.set('action', action);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
    const r = await fetch(url.toString());
    return r.json();
  }
}