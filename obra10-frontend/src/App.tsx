import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { FeatureProvider } from './context/FeatureContext'
import { AppRoutes } from './routes/AppRoutes'
import { InstallPrompt } from './components/InstallPrompt'
import { UpdateNotification } from './components/UpdateNotification'

function App() {
  return (
    <AuthProvider>
      <FeatureProvider>
        <BrowserRouter>
          <InstallPrompt />
          <UpdateNotification />
          <AppRoutes />
        </BrowserRouter>
      </FeatureProvider>
    </AuthProvider>
  )
}

export default App
