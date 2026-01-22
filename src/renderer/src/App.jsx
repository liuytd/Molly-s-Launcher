import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import Titlebar from './components/Titlebar'
import SplashScreen from './components/SplashScreen'
import UpdatePopup from './components/UpdatePopup'
import Home from './pages/Home'
import Product from './pages/Product'

function PageTransition({ children }) {
  const location = useLocation()
  const [displayLocation, setDisplayLocation] = useState(location)
  const [transitionStage, setTransitionStage] = useState('animate-fade-in')

  useEffect(() => {
    if (location !== displayLocation) {
      setTransitionStage('animate-fade-out')
      setTimeout(() => {
        setDisplayLocation(location)
        setTransitionStage('animate-fade-in')
      }, 200)
    }
  }, [location, displayLocation])

  return (
    <div className={`h-full ${transitionStage}`}>
      {children}
    </div>
  )
}

function AppContent() {
  return (
    <div className="h-full flex flex-col">
      <Titlebar />
      <main className="flex-1 overflow-hidden">
        <PageTransition>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/product/:productId" element={<Product />} />
          </Routes>
        </PageTransition>
      </main>
    </div>
  )
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [loadingText, setLoadingText] = useState('INITIALIZING...')
  const [updateInfo, setUpdateInfo] = useState(null)
  const [showUpdatePopup, setShowUpdatePopup] = useState(false)

  useEffect(() => {
    // Simulate loading steps
    const loadingSteps = async () => {
      setLoadingText('VERIFYING INSTALLATION...')
      await new Promise(r => setTimeout(r, 1000))

      setLoadingText('CHECKING FOR UPDATES...')
      await new Promise(r => setTimeout(r, 800))

      // Check for actual updates (only show popup if update is actually available and downloadable)
      if (window.api) {
        try {
          const result = await window.api.checkForUpdates()
          // Only show popup if success is true and update is available (not in dev mode)
          if (result.success && result.updateAvailable) {
            setUpdateInfo(result)
            setShowUpdatePopup(true)
          }
        } catch (err) {
          console.log('Update check failed:', err)
        }
      }

      setLoadingText('LOADING PRODUCTS...')
      await new Promise(r => setTimeout(r, 600))

      setLoadingText('READY')
      await new Promise(r => setTimeout(r, 400))

      setIsLoading(false)
    }

    loadingSteps()

    // Listen for update events
    if (window.api) {
      window.api.onUpdateAvailable((data) => {
        setUpdateInfo(data)
        setShowUpdatePopup(true)
      })

      window.api.onUpdateDownloaded((data) => {
        setLoadingText('INSTALLING UPDATE...')
      })
    }

    return () => {
      if (window.api) {
        window.api.removeAllListeners('updater:available')
        window.api.removeAllListeners('updater:downloaded')
      }
    }
  }, [])

  if (isLoading) {
    return <SplashScreen text={loadingText} />
  }

  return (
    <HashRouter>
      <AppContent />
      {showUpdatePopup && (
        <UpdatePopup
          version={updateInfo?.latestVersion}
          onClose={() => setShowUpdatePopup(false)}
        />
      )}
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        toastStyle={{
          background: 'rgba(20, 20, 30, 0.95)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '8px'
        }}
      />
    </HashRouter>
  )
}
