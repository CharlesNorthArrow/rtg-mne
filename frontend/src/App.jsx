import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.jsx'
import PublicLayout from './components/shared/PublicLayout.jsx'
import AdminLayout from './components/shared/AdminLayout.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import MethodologyPage from './pages/MethodologyPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import UploadPage from './pages/admin/UploadPage.jsx'
import CensusRefreshPage from './pages/admin/CensusRefreshPage.jsx'
import ConfigPage from './pages/admin/ConfigPage.jsx'
import AuditLogPage from './pages/admin/AuditLogPage.jsx'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>
  return user ? children : <Navigate to="/admin/login" replace />
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/methodology" element={<MethodologyPage />} />
      </Route>

      {/* Admin login (no layout) */}
      <Route path="/admin/login" element={<LoginPage />} />

      {/* Admin routes — auth-gated */}
      <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
        <Route index element={<Navigate to="/admin/upload" replace />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="census" element={<CensusRefreshPage />} />
        <Route path="config" element={<ConfigPage />} />
        <Route path="audit" element={<AuditLogPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
