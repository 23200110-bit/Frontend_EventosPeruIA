// Google Identity Services: carga el script oficial y dibuja el botón "Continuar con Google".
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let loading = null

export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function loadScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        loading = null
        reject(new Error('No se pudo cargar Google. Revisa tu conexión.'))
      }
      document.head.appendChild(script)
    })
  }
  return loading
}

/** Dibuja el botón en `element`; `onCredential(idToken)` se llama cuando el usuario elige su cuenta. */
export async function renderGoogleButton(element, onCredential, { width = 320 } = {}) {
  if (!googleClientId || !element) return
  await loadScript()
  window.google.accounts.id.initialize({
    client_id: googleClientId,
    callback: (response) => response?.credential && onCredential(response.credential)
  })
  element.innerHTML = ''
  window.google.accounts.id.renderButton(element, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    text: 'continue_with',
    locale: 'es',
    width
  })
}
