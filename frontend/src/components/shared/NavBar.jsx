import { NavLink, Link } from 'react-router-dom'

const BRAND_BLUE = '#243A78'

const linkClass = ({ isActive }) =>
  `rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-yellow-400 border-yellow-400 text-[#243A78]'
      : 'border-white/60 bg-transparent text-white hover:bg-white/10'
  }`

export default function NavBar() {
  return (
    <nav className="border-b border-black/10" style={{ background: BRAND_BLUE }}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/" className="flex items-center shrink-0" aria-label="Read to Grow home">
              <img
                src="/RTG-Logo-Stacked-White-Type.svg"
                alt="Read to Grow"
                className="h-12 w-auto"
              />
            </Link>
            <span className="hidden md:block text-base font-medium text-white truncate">
              Measurement &amp; Evaluation — School District Tiers
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
            <NavLink to="/methodology" className={linkClass}>Methodology</NavLink>
            <NavLink to="/admin" className={linkClass}>Admin</NavLink>
          </div>
        </div>
      </div>
    </nav>
  )
}
