import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: 'Discover', icon: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></> },
  { to: '/foryou', label: 'For You', icon: <path d="M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6C19 16.5 12 21 12 21Z" /> },
  { to: '/tickets', label: 'My Tickets', icon: <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z" /> },
  { to: '/sell', label: 'Sell', icon: <><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></> },
  { to: '/account', label: 'My Account', icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></> },
]

export default function BottomNav() {
  return (
    <nav className="tabbar">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
          <svg viewBox="0 0 24 24">{it.icon}</svg>
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}
