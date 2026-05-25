// TODO: real admin layout with side nav and Sign out (see PLATFORM_SPEC.md "AdminNav")
import { Outlet, NavLink } from 'react-router-dom'

const linkClass = ({ isActive }) =>
  `block px-3 py-2 text-sm rounded-md ${
    isActive ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
  }`

export default function AdminLayout() {
  return (
    <div className="flex h-full">
      <aside className="w-56 border-r border-gray-200 bg-white p-4 flex flex-col gap-1">
        <div className="px-3 py-2 text-xs uppercase text-gray-500">Admin</div>
        <NavLink to="/admin/upload"  className={linkClass}>Upload</NavLink>
        <NavLink to="/admin/census"  className={linkClass}>Census</NavLink>
        <NavLink to="/admin/config"  className={linkClass}>
          Config <span className="text-[10px] text-gray-400">(soon)</span>
        </NavLink>
        <NavLink to="/admin/audit"   className={linkClass}>
          Audit Log <span className="text-[10px] text-gray-400">(soon)</span>
        </NavLink>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
