import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import { EmployerAuthProvider } from '@/lib/employer-auth'
import LandingPage from '@/pages/LandingPage'
import TranslatePage from '@/pages/TranslatePage'
import LoginPage from '@/pages/LoginPage'
import VerifyPage from '@/pages/VerifyPage'
import DashboardPage from '@/pages/DashboardPage'
import ProfilePage from '@/pages/ProfilePage'
import OpportunitiesPage from '@/pages/OpportunitiesPage'
import ApplicationsPage from '@/pages/ApplicationsPage'
import EmployerLandingPage from '@/pages/EmployerLandingPage'
import EmployerLoginPage, { EmployerRegisterPage } from '@/pages/EmployerLoginPage'
import EmployerDashboardPage from '@/pages/EmployerDashboardPage'
import EmployerNewListingPage from '@/pages/EmployerNewListingPage'
import EmployerProfilePage from '@/pages/EmployerProfilePage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Veteran routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/translate" element={<TranslatePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/verify" element={<VerifyPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/opportunities" element={<OpportunitiesPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />

          {/* Employer routes */}
          <Route path="/employers" element={<EmployerLandingPage />} />
          <Route path="/employer/login" element={
            <EmployerAuthProvider><EmployerLoginPage /></EmployerAuthProvider>
          } />
          <Route path="/employer/register" element={
            <EmployerAuthProvider><EmployerRegisterPage /></EmployerAuthProvider>
          } />
          <Route path="/employer/dashboard" element={
            <EmployerAuthProvider><EmployerDashboardPage /></EmployerAuthProvider>
          } />
          <Route path="/employer/listings/new" element={
            <EmployerAuthProvider><EmployerNewListingPage /></EmployerAuthProvider>
          } />
          <Route path="/employer/profile" element={
            <EmployerAuthProvider><EmployerProfilePage /></EmployerAuthProvider>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
