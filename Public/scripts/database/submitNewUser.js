// Public/scripts/database/submitNewUser.js

/**
 * Sends a new client registration to the API.
 * Expects payload: { cuenta, contrasena, email }
 * Returns: { ok: boolean, data: object|null, status: number }
 */
export async function submitNewUser(payload) {
  try {
    const res = await fetch('/clientes/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data = null;
    try { data = await res.json(); } catch (_) {}

    return { ok: res.ok, data, status: res.status };
  } catch (err) {
    console.error('submitNewUser error:', err);
    return { ok: false, data: null, status: 0 };
  }
}
