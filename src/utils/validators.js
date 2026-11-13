export const required = (value) => !!value?.trim() || 'Completa este campo.'

export const emailRule = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || 'Ingresa un correo válido.'

export const minLengthRule = (min) => (value) =>
  !value || value.length >= min || `Usa al menos ${min} caracteres.`