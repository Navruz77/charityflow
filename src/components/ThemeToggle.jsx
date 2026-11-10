import { useEffect, useState } from 'react'
import { applyTheme, currentTheme, deviceTheme, savedTheme } from '../lib/theme.js'

// Header button that switches between light and dark. It shows the theme
// you would switch TO (a moon in light mode, a sun in dark mode), and says
// so to screen readers. Until someone taps it, the app follows the device.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme)

  // No choice saved yet: keep the icon right if the device switches
  // (for example automatic dark mode at sunset).
  useEffect(() => {
    let media
    try {
      media = window.matchMedia('(prefers-color-scheme: dark)')
    } catch {
      return undefined
    }
    const onChange = () => {
      if (!savedTheme()) setTheme(deviceTheme())
    }
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])

  const next = theme === 'dark' ? 'light' : 'dark'
  const label = `Switch to ${next} mode`

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => {
        applyTheme(next)
        setTheme(next)
      }}
    >
      {next === 'dark' ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
