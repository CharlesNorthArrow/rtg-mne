import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import dataRoutes from './routes/data.js'
import adminRoutes from './routes/admin.js'
import { requireAuth } from './middleware/auth.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())

// Public data routes
app.use('/api/data', dataRoutes)

// Admin routes — all require auth
app.use('/api/admin', requireAuth, adminRoutes)

app.listen(PORT, () => console.log(`RTG API running on :${PORT}`))

export default app
