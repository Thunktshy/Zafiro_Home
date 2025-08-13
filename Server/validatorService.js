'use strict';

class ValidationService {
  constructor() {
    this.validators = {
      // Tipos básicos
      isString: v => typeof v === 'string',
      isNumber: v => typeof v === 'number' && Number.isFinite(v),
      isBoolean: v => typeof v === 'boolean',
      isArray: v => Array.isArray(v),
      isObject: v => v !== null && typeof v === 'object' && !Array.isArray(v),
      isDate: v => v instanceof Date && !isNaN(v),

      // Tipos “semánticos”
      isEmail: v =>
        typeof v === 'string' &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),

      // Reglas genéricas (convertimos a string para longitud/patrón)
      maxLength: (v, max) => String(v).length <= max,
      minLength: (v, min) => String(v).length >= min,
      min: (v, min) => Number(v) >= Number(min),
      max: (v, max) => Number(v) <= Number(max),
      pattern: (v, regex) => {
        const re = typeof regex === 'string' ? new RegExp(regex) : regex;
        return re.test(String(v));
      }
    };
  }

  async validateData(data = {}, ruleset = {}) {
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new TypeError('validateData: "data" debe ser un objeto no nulo');
    }
    if (ruleset === null || typeof ruleset !== 'object' || Array.isArray(ruleset)) {
      throw new TypeError('validateData: "ruleset" debe ser un objeto no nulo');
    }

    const errors = [];

    for (const [field, rule] of Object.entries(ruleset)) {
      const value = data[field];
      const messages = rule?.messages || {};

      // Requerido
      const isEmpty =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        value === '';

      if (rule.required && isEmpty) {
        errors.push({
          field,
          message: messages.required ?? `${field} is required`
        });
        continue;
      }

      // Si es opcional y “vacío”, saltamos más validaciones
      if (!rule.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Trim opcional
      if (rule.trim && typeof value === 'string') {
        data[field] = value.trim();
      }

      // Tipo
      if (rule.type) {
        const typeKey = `is${rule.type.charAt(0).toUpperCase()}${rule.type.slice(1)}`;
        const fn = this.validators[typeKey];

        if (typeof fn !== 'function') {
          errors.push({
            field,
            message: messages.type || `Unsupported type validator: ${rule.type}`
          });
        } else if (!fn(data[field])) {
          errors.push({
            field,
            message: messages.type || `${field} must be ${rule.type}`
          });
          // si falla tipo, no tiene sentido seguir con reglas de ese campo
          continue;
        }
      }

      // Longitudes (sobre stringificación segura)
      if (rule.maxLength != null && !this.validators.maxLength(data[field], rule.maxLength)) {
        errors.push({
          field,
          message: messages.maxLength || `${field} cannot exceed ${rule.maxLength} characters`
        });
      }
      if (rule.minLength != null && !this.validators.minLength(data[field], rule.minLength)) {
        errors.push({
          field,
          message: messages.minLength || `${field} must be at least ${rule.minLength} characters`
        });
      }

      // Rangos numéricos
      if (rule.min != null && !this.validators.min(data[field], rule.min)) {
        errors.push({
          field,
          message: messages.min || `${field} must be >= ${rule.min}`
        });
      }
      if (rule.max != null && !this.validators.max(data[field], rule.max)) {
        errors.push({
          field,
          message: messages.max || `${field} must be <= ${rule.max}`
        });
      }

      // Patrón
      if (rule.pattern && !this.validators.pattern(data[field], rule.pattern)) {
        errors.push({
          field,
          message: messages.pattern || `${field} format is invalid`
        });
      }

      // Validador personalizado (puede ser async)
      if (typeof rule.custom === 'function') {
        const result = await rule.custom(data[field], data);
        if (result !== true) {
          errors.push({
            field,
            message:
              (typeof result === 'string' && result) ||
              messages.custom ||
              `${field} is invalid`
          });
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}

module.exports = new ValidationService();
