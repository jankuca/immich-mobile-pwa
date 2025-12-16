import { type ComponentChildren, render } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import 'preact/debug' // Enable Preact DevTools

import { TabBar } from './components/common/TabBar'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { HashLocationProvider, useHashLocation } from './contexts/HashLocationContext'
import { AlbumDetail } from './pages/AlbumDetail'
import { Albums } from './pages/Albums'
import { Login } from './pages/Login'
import { People } from './pages/People'
import { PersonDetail } from './pages/PersonDetail'
import { Search } from './pages/Search'
import { Timeline } from './pages/Timeline'

// Import our styles
import './styles/global.css'

// Protected route wrapper - redirects to login if not authenticated
const ProtectedRoute = ({ children }: { children: ComponentChildren }) => {
  const { isAuthenticated, isLoading } = useAuth()
  const { route } = useHashLocation()

  useEffect(() => {
    if (!(isLoading || isAuthenticated)) {
      // Save the current hash path to redirect after login
      const currentPath = window.location.hash.slice(1) || '/'
      if (currentPath !== '/login') {
        localStorage.setItem('redirect_after_login', currentPath)
        route('/login')
      }
    }
  }, [isAuthenticated, isLoading, route])

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          flexDirection: 'column',
          color: 'var(--color-gray)',
        }}
      >
        <div
          class="loading-spinner"
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid var(--color-gray-light)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ marginTop: 'var(--spacing-md)' }}>Loading...</p>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  // Render children if authenticated
  return isAuthenticated ? <>{children}</> : null
}

// Main app with persistent tabs
const PersistentTabsApp = () => {
  const { url } = useHashLocation()
  const [timelineMounted, setTimelineMounted] = useState<boolean>(false)
  const [albumsMounted, setAlbumsMounted] = useState<boolean>(false)
  const [albumDetailMounted, setAlbumDetailMounted] = useState<boolean>(false)
  const [albumDetailId, setAlbumDetailId] = useState<string | null>(null)
  const [peopleMounted, setPeopleMounted] = useState<boolean>(false)
  const [personDetailMounted, setPersonDetailMounted] = useState<boolean>(false)
  const [personDetailId, setPersonDetailId] = useState<string | null>(null)
  const [searchMounted, setSearchMounted] = useState<boolean>(false)

  // Determine which tab is active based on the URL
  const basePath = `/${url.split('/')[1] || ''}`
  const isAlbumDetail = url.startsWith('/albums/') && url !== '/albums'
  const isPersonDetail = url.startsWith('/people/') && url !== '/people'

  // Extract album ID from URL if on album detail page
  useEffect(() => {
    if (isAlbumDetail) {
      const id = url.split('/')[2] || ''
      setAlbumDetailId(id)
      setAlbumDetailMounted(true)
      setAlbumsMounted(true) // Ensure albums list is also mounted
    } else {
      setAlbumDetailMounted(false)
    }
  }, [isAlbumDetail, url])

  // Extract person ID from URL if on person detail page
  useEffect(() => {
    if (isPersonDetail) {
      const id = url.split('/')[2] || ''
      setPersonDetailId(id)
      setPersonDetailMounted(true)
      setPeopleMounted(true) // Ensure people list is also mounted
    } else {
      setPersonDetailMounted(false)
    }
  }, [isPersonDetail, url])

  useEffect(() => {
    if (url === '/') {
      setTimelineMounted(true)
    } else if (url === '/albums' || isAlbumDetail) {
      setAlbumsMounted(true)
    } else if (url === '/people' || isPersonDetail) {
      setPeopleMounted(true)
    } else if (url === '/search') {
      setSearchMounted(true)
    }
  }, [url, isAlbumDetail, isPersonDetail])

  // Determine which tab is active for styling
  const activeTab = isAlbumDetail ? '/albums' : isPersonDetail ? '/people' : basePath

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        position: 'relative',
        backgroundColor: 'var(--color-background)',
      }}
    >
      {/* Timeline Tab */}
      <div
        style={{
          height: '100%',
          width: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          visibility: activeTab === '/' ? 'visible' : 'hidden',
          zIndex: activeTab === '/' ? 1 : 0,
          backgroundColor: 'var(--color-background)',
        }}
      >
        {timelineMounted && <Timeline />}
      </div>

      {/* Albums Tab with Navigation Stack */}
      <div
        style={{
          height: '100%',
          width: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          visibility: activeTab === '/albums' ? 'visible' : 'hidden',
          zIndex: activeTab === '/albums' ? 1 : 0,
          backgroundColor: 'var(--color-background)',
        }}
      >
        {/* Album List */}
        <div
          style={{
            height: '100%',
            width: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            visibility: isAlbumDetail ? 'hidden' : 'visible',
            zIndex: isAlbumDetail ? 0 : 1,
            backgroundColor: 'var(--color-background)',
          }}
        >
          {albumsMounted && <Albums />}
        </div>

        {/* Album Detail */}
        <div
          style={{
            height: '100%',
            width: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            visibility: isAlbumDetail ? 'visible' : 'hidden',
            zIndex: isAlbumDetail ? 1 : 0,
            backgroundColor: 'var(--color-background)',
          }}
        >
          {albumDetailMounted && albumDetailId && <AlbumDetail albumId={albumDetailId} />}
        </div>
      </div>

      {/* People Tab with Navigation Stack */}
      <div
        style={{
          height: '100%',
          width: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          visibility: activeTab === '/people' ? 'visible' : 'hidden',
          zIndex: activeTab === '/people' ? 1 : 0,
          backgroundColor: 'var(--color-background)',
        }}
      >
        {/* People List */}
        <div
          style={{
            height: '100%',
            width: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            visibility: isPersonDetail ? 'hidden' : 'visible',
            zIndex: isPersonDetail ? 0 : 1,
            backgroundColor: 'var(--color-background)',
          }}
        >
          {peopleMounted && <People />}
        </div>

        {/* Person Detail */}
        <div
          style={{
            height: '100%',
            width: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            visibility: isPersonDetail ? 'visible' : 'hidden',
            zIndex: isPersonDetail ? 1 : 0,
            backgroundColor: 'var(--color-background)',
          }}
        >
          {personDetailMounted && personDetailId && <PersonDetail personId={personDetailId} />}
        </div>
      </div>

      {/* Search Tab */}
      <div
        style={{
          height: '100%',
          width: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          visibility: activeTab === '/search' ? 'visible' : 'hidden',
          zIndex: activeTab === '/search' ? 1 : 0,
          backgroundColor: 'var(--color-background)',
        }}
      >
        {searchMounted && <Search />}
      </div>
    </div>
  )
}

// Hash-based route matching
const HashRouter = () => {
  const { url } = useHashLocation()

  // Login route is public
  if (url === '/login') {
    return <Login />
  }

  // All other routes are protected
  return (
    <ProtectedRoute>
      <PersistentTabsApp />
    </ProtectedRoute>
  )
}

const AppContent = () => {
  const { isAuthenticated } = useAuth()
  const { url } = useHashLocation()
  console.log({ isAuthenticated })

  // Don't show tab bar on login page
  const showTabBar = isAuthenticated && url !== '/login'

  return (
    <div
      id="app-container"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-background)',
      }}
    >
      <main
        style={{
          flex: 1,
          overflow: 'hidden',
          backgroundColor: 'var(--color-background)',
        }}
      >
        <HashRouter />
      </main>
      {showTabBar && <TabBar />}
    </div>
  )
}

export function App() {
  return (
    <AuthProvider>
      <HashLocationProvider>
        <AppContent />
      </HashLocationProvider>
    </AuthProvider>
  )
}

const appNode = document.getElementById('app')
if (!appNode) {
  throw new Error('Failed to find the root element')
}

render(<App />, appNode)
