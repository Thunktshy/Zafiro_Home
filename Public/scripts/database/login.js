// /scripts/database/login.js
export async function tryLogin(username, password) {
  const response = await fetch('/login', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });

  const ct = response.headers.get('content-type') || '';
  const raw = await response.text();
  const payload = ct.includes('application/json') ? JSON.parse(raw || '{}') : {};

  if (!response.ok) {
    // Propaga el mensaje del servidor si existe
    throw new Error(payload.message || `Error al iniciar sesión (HTTP ${response.status})`);
  }

  // Normaliza el shape esperado
  return {
    success: !!payload.success,
    message: payload.message ?? '',
    isAdmin: payload.isAdmin === true,
    username: payload.username ?? 'Bienvenido',
    redirect: payload.redirect || ''
  };
}

