import { Outlet } from 'react-router-dom'
import NavBar from './NavBar.jsx'

export default function PublicLayout() {
  return (
    <div className="flex h-full flex-col">
      <NavBar />
      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  )
}
