import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import LandingPage from '@/pages/LandingPage'
import TranslatePage from '@/pages/TranslatePage'
import LoginPage from '@/pages/LoginPage'
import VerifyPage from '@/pages/VerifyPage'
import DashboardPage from '@/pages/DashboardPage'
import ProfilePage from '@/pages/ProfilePage'
import OpportunitiesPage from '@/pages/OpportunitiesPage'
import ApplicationsPage from '@/pages/ApplicationsPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/translate" element={<TranslatePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/verify" element={<VerifyPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/opportunities" element={<OpportunitiesPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
