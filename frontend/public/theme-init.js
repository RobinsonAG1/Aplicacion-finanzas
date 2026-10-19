// Aplica el tema antes del primer pintado para evitar el destello (FOUC).
// Es un archivo externo (no inline) porque la CSP usa script-src 'self'.
// La clave debe coincidir con THEME_STORAGE_KEY en src/features/theme/theme-context.ts.
; (function () {
  var STORAGE_KEY = 'finanzas-theme'
  try {
    var stored = window.localStorage.getItem(STORAGE_KEY)
    var theme =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
    document.documentElement.dataset.theme = theme
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f0f12' : '#f7f5fa')
  } catch {
    document.documentElement.dataset.theme = 'light'
  }
})()
