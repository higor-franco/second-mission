import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import { EmployerAuthProvider } from '@/lib/employer-auth'
import { AdminAuthProvider } from '@/lib/admin-auth'
import LandingPage from '@/pages/LandingPage'
import TranslatePage from '@/pages/TranslatePage'
import LoginPage from '@/pages/LoginPage'
import VerifyPage from '@/pages/VerifyPage'
import DashboardPage from '@/pages/DashboardPage'
import ProfilePage from '@/pages/ProfilePage'
import OpportunitiesPage from '@/pages/OpportunitiesPage'
import ApplicationsPage from '@/pages/ApplicationsPage'
import CompanyProfilePage from '@/pages/CompanyProfilePage'
import EmployerLoginPage, { EmployerRegisterPage } from '@/pages/EmployerLoginPage'
import EmployerForgotPasswordPage from '@/pages/EmployerForgotPasswordPage'
import EmployerResetPasswordPage from '@/pages/EmployerResetPasswordPage'
import EmployerDashboardPage from '@/pages/EmployerDashboardPage'
import EmployerNewListingPage from '@/pages/EmployerNewListingPage'
import EmployerListingDetailPage from '@/pages/EmployerListingDetailPage'
import EmployerEditListingPage from '@/pages/EmployerEditListingPage'
import EmployerProfilePage from '@/pages/EmployerProfilePage'
import AdminLoginPage from '@/pages/AdminLoginPage'
import AdminDashboardPage from '@/pages/AdminDashboardPage'

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
          {/* Veteran-facing public company profile. Auth-gated inside the
              page (veteran session required) — the backend also enforces it. */}
          <Route path="/companies/:id" element={<CompanyProfilePage />} />

          {/* Employer routes */}
          <Route path="/employer/login" element={
            <EmployerAuthProvider><EmployerLoginPage /></EmployerAuthProvider>
          } />
          <Route path="/employer/forgot-password" element={
            <EmployerAuthProvider><EmployerForgotPasswordPage /></EmployerAuthProvider>
          } />
          <Route path="/employer/reset-password" element={
            <EmployerAuthProvider><EmployerResetPasswordPage /></EmployerAuthProvider>
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
          <Route path="/employer/listings/:id" element={
            <EmployerAuthProvider><EmployerListingDetailPage /></EmployerAuthProvider>
          } />
          <Route path="/employer/listings/:id/edit" element={
            <EmployerAuthProvider><EmployerEditListingPage /></EmployerAuthProvider>
          } />
          <Route path="/employer/profile" element={
            <EmployerAuthProvider><EmployerProfilePage /></EmployerAuthProvider>
          } />

          {/* Admin routes */}
          <Route path="/admin/login" element={
            <AdminAuthProvider><AdminLoginPage /></AdminAuthProvider>
          } />
          <Route path="/admin/dashboard" element={
            <AdminAuthProvider><AdminDashboardPage /></AdminAuthProvider>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
