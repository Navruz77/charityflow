import { createContext } from 'react'

// Once someone has reached the review screen, CalculatorPage provides a
// function here so every step can jump straight back to the review instead
// of clicking Next through all the remaining steps. null = not reached yet.
export const ReviewShortcut = createContext(null)
