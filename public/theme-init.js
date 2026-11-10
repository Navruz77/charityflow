// Runs before the page draws so a saved light/dark choice shows at once,
// with no flash of the other theme. Same key and format as src/lib/theme.js
// ({"version":1,"data":"dark"}). Kept as its own file, not inline in
// index.html, so a strict Content-Security-Policy stays possible.
;(function () {
  try {
    var raw = window.localStorage.getItem('cf.v1.theme')
    if (!raw) return
    var parsed = JSON.parse(raw)
    if (parsed && parsed.version === 1 && (parsed.data === 'light' || parsed.data === 'dark')) {
      document.documentElement.setAttribute('data-theme', parsed.data)
    }
  } catch {
    // storage blocked or damaged: follow the device setting
  }
})()
