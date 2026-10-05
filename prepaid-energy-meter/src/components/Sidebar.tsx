import { NavLink } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'

type SidebarProps = {
  open: boolean
  onClose: () => void
}

const normalLinks = [
  {
    label: 'Dashboard',
    path: '/dashboard',
  },
  {
    label: 'Recharge',
    path: '/recharge',
  },
  {
    label: 'Usage',
    path: '/usage',
  },
  {
    label: 'Alerts',
    path: '/alerts',
  },
  {
    label: 'Settings',
    path: '/settings',
  },
  {
    label: 'Profile',
    path: '/profile',
  },
]

export default function Sidebar({
  open,
  onClose,
}: SidebarProps) {
  const { profile } = useAuth()

  return (
    <>
      {open && (
        <button
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
          aria-label="Close menu"
        />
      )}

      {/* Phone: a drawer that slides in.
          Desktop (lg): stays in place, full screen height,
          while the page scrolls. */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:bottom-auto lg:h-screen lg:shrink-0 lg:self-start lg:translate-x-0 ${
          open
            ? 'translate-x-0'
            : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            PE
          </div>

          <span className="ml-3 font-bold text-slate-900">
            EnergyPay
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {normalLinks.map((link) => (
            <NavItem
              key={link.path}
              {...link}
              onClick={onClose}
            />
          ))}

          {profile?.role === 'admin' && (
            <>
              <div className="my-4 border-t border-slate-200" />

              <NavItem
                label="Admin"
                path="/admin"
                onClick={onClose}
              />
            </>
          )}
        </nav>
      </aside>
    </>
  )
}

function NavItem({
  label,
  path,
  onClick,
}: {
  label: string
  path: string
  onClick: () => void
}) {
  return (
    <NavLink
      to={path}
      onClick={onClick}
      className={({ isActive }) =>
        `block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
          isActive
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      {label}
    </NavLink>
  )
}
