import { BrowserRouter, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { FeatureProvider } from './context/FeatureContext'
import { AppRoutes } from './routes/AppRoutes'
import { InstallPrompt } from './components/InstallPrompt'
import { UpdateNotification } from './components/UpdateNotification'
import { LunaWidget } from './components/LunaWidget'

function LunaHost() {
  const { isAuthenticated } = useAuth()
  const { pathname } = useLocation()
  if (!isAuthenticated || pathname.startsWith('/admin')) return null
  return <LunaWidget />
}

function App() {
  return (
    <AuthProvider>
      <FeatureProvider>
        <BrowserRouter>
          <InstallPrompt />
          <UpdateNotification />
          <AppRoutes />
          <LunaHost />
        </BrowserRouter>
      </FeatureProvider>
    </AuthProvider>
  )
}

export default App
