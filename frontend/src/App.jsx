import { Routes, Route, Navigate } from 'react-router-dom'
import PublicLayout from './components/shared/PublicLayout.jsx'
import AdminLayout from './components/shared/AdminLayout.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import OutcomesPage from './pages/OutcomesPage.jsx'
import MethodologyPage from './pages/MethodologyPage.jsx'
import UploadPage from './pages/admin/UploadPage.jsx'
import CensusRefreshPage from './pages/admin/CensusRefreshPage.jsx'
import ConfigPage from './pages/admin/ConfigPage.jsx'
import AuditLogPage from './pages/admin/AuditLogPage.jsx'

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/outcomes" element={<OutcomesPage />} />
        <Route path="/methodology" element={<MethodologyPage />} />
      </Route>

      {/* Admin routes — auth gate temporarily removed.
          /admin/login still exists in the codebase (LoginPage.jsx + useAuth)
          but is no longer reachable from the router. Re-wire RequireAuth here
          to restore. */}
      <Route path="/admin" element={<AdminLayout />}>
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
