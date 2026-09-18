import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useMe } from './hooks/useAuth'
import { useAuthStore } from './store/auth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import TenantsListPage from './pages/TenantsListPage'
import TenantFormPage from './pages/TenantFormPage'
import TenantDetailPage from './pages/TenantDetailPage'
import AccountPage from './pages/AccountPage'
import ApiKeysPage from './pages/ApiKeysPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AuthGate() {
  useMe()
  return null
}

function AppRoutes() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/tenants" replace /> : <LoginPage />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/tenants" element={<TenantsListPage />} />
        <Route path="/tenants/new" element={<TenantFormPage />} />
        <Route path="/tenants/:id" element={<TenantDetailPage />} />
        <Route path="/tenants/:id/edit" element={<TenantFormPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/api-keys" element={<ApiKeysPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/tenants" replace />} />
    </Routes>
  )
}

export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate />
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
