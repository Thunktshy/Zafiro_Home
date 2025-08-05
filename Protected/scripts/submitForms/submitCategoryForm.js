// submitCategoryForm.js
import { insertNewCategory } from './apis/categories.js';

export default class SubmitCategoryForm {
    constructor(formSelector) {
        this.form        = document.querySelector(formSelector);
        this.nameInput   = this.form.querySelector('#categoryName');
        this.descInput   = this.form.querySelector('#categoryDesc');
        this.imageInput  = this.form.querySelector('#productImageFile');
        this.errorName   = this.form.querySelector('#error-name');
        this.errorDesc   = this.form.querySelector('#error-description');
        this.errorImage  = this.form.querySelector('#error-image');
        this.alertBox    = this.form.querySelector('#alertBox');
    }

    init() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
    }

    clearErrors() {
        [this.errorName, this.errorDesc, this.errorImage].forEach(el => el.textContent = '');
        this.alertBox.textContent = '';
        this.alertBox.className = 'alert-box';
    }

    showFieldError(el, msg) {
        el.textContent = msg;
    }

    showAlert(msg, type = 'error') {
        this.alertBox.textContent = msg;
        this.alertBox.classList.add(type === 'success' ? 'alert-success' : 'alert-error');
    }

    validate() {
        let ok   = true;
        const name = this.nameInput.value.trim();
        const desc = this.descInput.value.trim();
        const file = this.imageInput.files[0];

        // Nombre (requerido, max 50)
        if (!name) {
            this.showFieldError(this.errorName, 'El nombre es obligatorio.');
            ok = false;
        } else if (name.length > 50) {
            this.showFieldError(this.errorName, 'Máximo 50 caracteres.');
            ok = false;
        }

        // Descripción (opcional, max 250)
        if (desc.length > 250) {
            this.showFieldError(this.errorDesc, 'Máximo 250 caracteres.');
            ok = false;
        }

        // Imagen (opcional, tipo y tamaño)
        if (file) {
            if (!file.type.startsWith('image/')) {
                this.showFieldError(this.errorImage, 'Solo se permiten imágenes.');
                ok = false;
            } else if (file.size > 2 * 1024 * 1024) {
                this.showFieldError(this.errorImage, 'La imagen no puede superar 2 MB.');
                ok = false;
            }
        }

        return ok;
    }

    async handleSubmit(e) {
        e.preventDefault();
        this.clearErrors();

        if (!this.validate()) return;

        // Construir FormData con las keys que espera el back
        const formData = new FormData();
        formData.append('nombre_categoria', this.nameInput.value.trim());
        formData.append('descripcion',       this.descInput.value.trim());
        if (this.imageInput.files[0]) {
            formData.append('imageFile', this.imageInput.files[0]);
        }

        // — DEBUG: Loguear contenido de FormData —
        console.log('--- FormData Debug ---');
        for (const [key, value] of formData.entries()) {
            if (value instanceof File) {
                console.log(`${key}: File { name: "${value.name}", type: "${value.type}", size: ${value.size} }`);
            } else {
                console.log(`${key}: "${value}"`);
            }
        }
        console.log('--- End Debug ---');

        // Feedback: disabling
        const btn = this.form.querySelector('#submitForm');
        btn.disabled    = true;
        btn.textContent = 'Guardando…';

        try {
            const result = await insertNewCategory(formData);
            // El servidor devuelve { success: true } o { success: false, error }
            if (result.success) {
                this.showAlert('Categoría guardada correctamente.', 'success');
                this.form.reset();
            } else {
                throw new Error(result.error || 'Error desconocido');
            }
        } catch (err) {
            console.error(err);
            this.showAlert(`Error al guardar: ${err.message}`, 'error');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Guardar Categoría';
        }
    }
}

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    new SubmitCategoryForm('#categoryForm').init();
});
