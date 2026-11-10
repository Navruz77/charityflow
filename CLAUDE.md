# CharityFlow rules
- React + Vite, plain JavaScript, no TypeScript for the MVP. Beginner-readable code with short comments.
- Money is integer cents everywhere. Never use floats for money.
- Never edit the math in src/engine/ without being asked. Run npm test after any change.
- Never put secrets in code. Only VITE_ values from .env, which are public-safe.
- Never use dangerouslySetInnerHTML, eval, or innerHTML. No new dependencies without saying why.
- Mobile-first, accessible (labels, focus states, keyboard use, AA contrast), works at 360px wide.
- Site is served from base / (Express on Render serves dist/) with hash routes (#/calculator).
- Run npm test and npm run build before saying a task is done.
