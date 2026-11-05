// CharityFlow server. Serves the built front end (dist/) and the /api
// routes. This is the only part of the app that ever holds secret keys.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')

const app = express()

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use(express.static(distDir))

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`CharityFlow server listening on port ${port}`)
})
