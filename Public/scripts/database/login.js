//login.js
export async function tryLogin(username, password) {
  const response = await fetch('/login', {
    method: 'POST',
    credentials: 'include',           // send cookies for session
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  console.log

  // 1) If server returns 4xx/5xx, throw so caller can handle
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Error al iniciar sesión');
  }

  // 2) Otherwise return JSON
  return response.json();
}
