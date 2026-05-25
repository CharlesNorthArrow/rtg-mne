import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import dataRoutes from './routes/data.js'
import adminRoutes from './routes/admin.js'
// import { requireAuth } from './middleware/auth.js'   // temporarily disabled

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())

// Public data routes
app.use('/api/data', dataRoutes)

// Admin routes — auth gate temporarily removed. Swap the noop back for
// `requireAuth` to restore the JWT check.
const noopAuth = (req, _res, next) => { req.user = { email: 'anonymous' }; next() }
app.use('/api/admin', noopAuth, adminRoutes)

app.listen(PORT, () => console.log(`RTG API running on :${PORT}`))

export default app
