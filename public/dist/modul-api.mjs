// MODUL-AI | Cliente del navegador para la API propia (/api en Vercel).
async function call(path, {method = 'GET', body} = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : {'content-type': 'application/json'},
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new Error('Sin conexión con el servidor. Revisa tu internet.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* respuesta no JSON */ }
  if (!res.ok || !data) {
    if (!data && res.status === 404) throw new Error('La API no responde: abre MODUL-AI con MODUL-AI.exe o con «npm start», no abriendo index.html directamente.');
    throw new Error(data?.error || 'Error del servidor (' + res.status + ').');
  }
  return data;
}

export const api = {
  me: () => call('/api/auth/me').then(d => d.user),
  register: (email, password) => call('/api/auth/register', {method: 'POST', body: {email, password}}).then(d => d.user),
  login: (email, password) => call('/api/auth/login', {method: 'POST', body: {email, password}}).then(d => d.user),
  logout: () => call('/api/auth/logout', {method: 'POST', body: {}}),
  listProjects: () => call('/api/projects').then(d => d.projects),
  getProject: id => call('/api/projects?id=' + encodeURIComponent(id)).then(d => d.project),
  saveProject: data => call('/api/projects', {method: 'POST', body: {data}}).then(d => d.project),
  deleteProject: id => call('/api/projects?id=' + encodeURIComponent(id), {method: 'DELETE'})
};
