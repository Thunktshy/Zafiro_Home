// submitInfoForm.js
export async function submitPersonalInfo(payload) {
  const resp = await fetch('/users/submitpersonalInformation', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });

  // Si la respuesta no es JSON válido lanzará
  const result = await resp.json().catch(() => {
    throw new Error('Respuesta inválida del servidor');
  });

  if (!resp.ok) {
    // asume { success: false, message: '...' }
    return { success: false, message: result.message || resp.statusText };
  }

  return result;
}
