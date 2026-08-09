import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import BottomNav from './components/BottomNav'
import TicketDetail from './pages/TicketDetail'
import Discover from './pages/Discover'
import MyTickets from './pages/MyTickets'
import Sell from './pages/Sell'
import Account from './pages/Account'
import SignIn from './pages/SignIn'
import Admin from './pages/Admin'
import CreateEvent from './pages/CreateEvent'
import ManageEvents from './pages/ManageEvents'
import CreateLogin from './pages/CreateLogin'
import Accept from './pages/Accept'
import Profile from './pages/Profile'
import Favourites from './pages/Favourites'

function RequireAuth({ children }) {
  const { user, isConfigured, loading } = useAuth()
  if (loading) return null
  // when not configured yet, let pages render so you can see the UI
  if (isConfigured && !user) return <Navigate to="/signin" replace />
  return children
}

export default function App() {
  const { pathname } = useLocation()
  const immersive = pathname.startsWith('/ticket/') // full-screen detail hides the tab bar
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Discover />} />
        <Route path="/tickets" element={<MyTickets />} />
        <Route path="/sell" element={<Sell />} />
        <Route path="/account" element={<Account />} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/favourites" element={<RequireAuth><Favourites /></RequireAuth>} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/foryou" element={<RequireAuth><Admin /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
        <Route path="/admin/create" element={<RequireAuth><CreateEvent /></RequireAuth>} />
        <Route path="/admin/edit/:id" element={<RequireAuth><CreateEvent /></RequireAuth>} />
        <Route path="/admin/manage" element={<RequireAuth><ManageEvents /></RequireAuth>} />
        <Route path="/admin/staff" element={<RequireAuth><CreateLogin /></RequireAuth>} />
        {/* not wrapped in RequireAuth: the ?transfer= deep-link must survive a sign-in */}
        <Route path="/accept" element={<Accept />} />
        <Route path="/ticket/:id" element={<RequireAuth><TicketDetail /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!immersive && <BottomNav />}
    </div>
  )
}
