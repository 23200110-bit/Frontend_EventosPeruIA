export const required = (value) => !!value?.toString().trim() || 'Completa este campo.'

export const emailRule = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || 'Ingresa un correo válido.'

export const minLengthRule = (min) => (value) =>
  !value || value.length >= min || `Usa al menos ${min} caracteres.`

export const maxLengthRule = (max) => (value) =>
  !value || value.length <= max || `No superes los ${max} caracteres.`

export const positiveIntRule = (value) => {
  const num = Number(value)
  return (Number.isInteger(num) && num > 0) || 'Ingresa un número entero mayor a 0.'
}

export const nonNegativeNumberRule = (value) => {
  if (value === '' || value === null || value === undefined) return 'Completa este campo.'
  const num = Number(value)
  return (!Number.isNaN(num) && num >= 0) || 'El valor no puede ser negativo.'
}