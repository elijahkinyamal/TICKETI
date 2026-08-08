import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import BottomNav from './components/BottomNav'
import Discover from './pages/Discover'
import MyTickets from './pages/MyTickets'
import Sell from './pages/Sell'
import Account from './pages/Account'
import SignIn from './pages/SignIn'
import Admin from './pages/Admin'
import CreateEvent from './pages/CreateEvent'
import ManageEvents from './pages/ManageEvents'

function RequireAuth({ children }) {
  const { user, isConfigured, loading } = useAuth()
  if (loading) return null
  // when not configured yet, let pages render so you can see the UI
  if (isConfigured && !user) return <Navigate to="/signin" replace />
  return children
}

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Discover />} />
        <Route path="/tickets" element={<MyTickets />} />
        <Route path="/sell" element={<Sell />} />
        <Route path="/account" element={<Account />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/foryou" element={<RequireAuth><Admin /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
        <Route path="/admin/create" element={<RequireAuth><CreateEvent /></RequireAuth>} />
        <Route path="/admin/manage" element={<RequireAuth><ManageEvents /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
