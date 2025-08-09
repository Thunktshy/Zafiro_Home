// personalinfo.js
import { submitPersonalInfo } from '../../database/submitInfoForm.js';
import { showError }           from '../../showError.js';

const form       = document.getElementById('personalInfoForm');
const successMsg = document.getElementById('successMsg');
const validators = {
  cliente_id: {
    regex: /^[A-Za-z0-9]{1,20}$/,
    message: 'El ID debe tener solo letras y números (máx. 20 caracteres).'
  },
  nombre: {
    regex: /^[A-Za-zÀ-ÿ\s'-]{1,50}$/,
    message: 'El nombre solo admite letras, espacios, apóstrofes o guiones (máx. 50 caracteres).'
  },
  apellidos: {
    regex: /^[A-Za-zÀ-ÿ\s'-]{1,100}$/,
    message: 'Los apellidos solo admiten letras, espacios, apóstrofes o guiones (máx. 100 caracteres).'
  },
  telefono: {
    regex: /^[0-9+\-()\s]{7,20}$/,
    message: 'El teléfono solo admite dígitos, espacios y los símbolos + - ( ) (de 7 a 20 caracteres).'
  },
  codigo_postal: {
    regex: /^[0-9]{5,10}$/,
    message: 'El código postal debe tener solo dígitos (entre 5 y 10 caracteres).'
  }
};


form.addEventListener('submit', async (e) => {
  e.preventDefault();
  successMsg.classList.add('hidden');

  // 1) Validación de campos requeridos
  const requiredFields = form.querySelectorAll('[required]');
  let valid = true;
  requiredFields.forEach(input => {
    input.classList.remove('border-red-500');
    if (!input.value.trim()) {
      valid = false;
      input.classList.add('border-red-500');
    }
  });
  if (!valid) {
    showError('Por favor, completa los campos requeridos (*)');
    return;
  }

  // 2) Validación de formato y longitud
  for (let [fieldName, { regex, message }] of Object.entries(validators)) {
    const input = form[fieldName];
    // solo validar si hay valor (algunos son opcionales)
    if (input.value.trim() && !regex.test(input.value.trim())) {
      input.classList.add('border-red-500');
      showError(message);
      return;
    } else {
      input.classList.remove('border-red-500');
    }
  }

  // 3) Recolectar datos si todo pasó
  const data = {
    cliente_id:    form.cliente_id.value.trim(),
    nombre:        form.nombre.value.trim(),
    apellidos:     form.apellidos.value.trim(),
    telefono:      form.telefono.value.trim() || null,
    direccion:     form.direccion.value.trim() || null,
    ciudad:        form.ciudad.value.trim()   || null,
    codigo_postal: form.codigo_postal.value.trim() || null,
    pais:          form.pais.value.trim()     || null
  };

  // ENVÍO
  try {
    const res = await submitPersonalInfo(data);
    if (!res.success) {
      showError(res.message || 'Error desconocido al guardar');
      return;
    }
    successMsg.classList.remove('hidden');
    form.reset();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    showError('No se pudo conectar al servidor');
  }
});
