//nuevoUsuario.js

/**
 * Envía un nuevo usuario al backend para registro.
 */
export async function submitNewUser(user) {
  try {
    const response = await fetch('/users/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(user)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || response.statusText);
    }

    return await response.json();
  } catch (error) {
    console.error("Error al crear usuario:", error);
    throw error;
  }
}
