class ValidationService {
  constructor() {
    this.validators = {
      isString: value => typeof value === 'string',
      isNumber: value => typeof value === 'number',
      maxLength: (value, max) => value.length <= max,
      pattern: (value, regex) => regex.test(value)
    };
  }

  async validateData(data, ruleset) {
    const errors = [];
    
    for (const [field, rule] of Object.entries(ruleset)) {
      const value = data[field];
      
      // Check required fields
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field,
          message: rule.messages.required || `${field} is required`
        });
        continue;
      }
      
      // Skip validation if field is optional and empty
      if (!rule.required && (value === undefined || value === null || value === '')) {
        continue;
      }
      
      // Type validation
      if (rule.type && !this.validators[`is${rule.type.charAt(0).toUpperCase() + rule.type.slice(1)}`](value)) {
        errors.push({
          field,
          message: rule.messages.type || `${field} must be ${rule.type}`
        });
        continue;
      }
      
      // Length validation
      if (rule.maxLength && !this.validators.maxLength(value, rule.maxLength)) {
        errors.push({
          field,
          message: rule.messages.maxLength || `${field} cannot exceed ${rule.maxLength} characters`
        });
      }
      
      // Pattern validation
      if (rule.pattern && !this.validators.pattern(value, rule.pattern)) {
        errors.push({
          field,
          message: rule.messages.pattern || `${field} format is invalid`
        });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = new ValidationService();