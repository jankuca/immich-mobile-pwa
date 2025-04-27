import { render } from 'preact';
import { LocationProvider, Router, Route, useLocation } from 'preact-iso';
import { useState, useEffect } from 'preact/hooks';
import 'preact/debug'; // Enable Preact DevTools

import Timeline from './pages/Timeline';
import Albums from './pages/Albums';
import AlbumDetail from './pages/AlbumDetail';
import People from './pages/People';
import Search from './pages/Search';
import Login from './pages/Login';
import { NotFound } from './pages/_404.jsx';
import TabBar from './components/common/TabBar';
import useAuth from './services/auth';

// Import our styles
import './styles/global.css';

// Protected route component
const ProtectedRoute = ({ component: Component, ...rest }: any) => {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Save the current path to redirect after login
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        localStorage.setItem('redirect_after_login', currentPath);
        window.location.href = '/login';
      }
    }
  }, [isAuthenticated, isLoading]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        flexDirection: 'column',
        color: 'var(--color-gray)'
      }}>
        <div class="loading-spinner" style={{
          width: '40px',
          height: '40px',
          border: '4px solid var(--color-gray-light)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ marginTop: 'var(--spacing-md)' }}>Loading...</p>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Render the component if authenticated
  return isAuthenticated ? <Component {...rest} /> : null;
};

// Main app with persistent tabs
const PersistentTabsApp = () => {
  const { url, ...rest } = useLocation();
  const [timelineMounted, setTimelineMounted] = useState<boolean>(false);
  const [albumsMounted, setAlbumsMounted] = useState<boolean>(false);
  const [albumDetailMounted, setAlbumDetailMounted] = useState<boolean>(false);
  const [albumDetailId, setAlbumDetailId] = useState<string | null>(null);
  const [peopleMounted, setPeopleMounted] = useState<boolean>(false);
  const [searchMounted, setSearchMounted] = useState<boolean>(false);

  // Determine which tab is active based on the URL
  const basePath = '/' + (url.split('/')[1] || '');
  const isAlbumDetail = url.startsWith('/albums/') && url !== '/albums';

  // Extract album ID from URL if on album detail page
  useEffect(() => {
    if (isAlbumDetail) {
      const id = url.split('/')[2];
      setAlbumDetailId(id);
      setAlbumDetailMounted(true);
      setAlbumsMounted(true); // Ensure albums list is also mounted
    }
  }, [isAlbumDetail, url]);

  // Mount components when they're first visited
  console.debug('URL changed to:', url);
  useEffect(() => {
    console.debug('URL changed to:', url);
    if (url === '/') setTimelineMounted(true);
    else if (url === '/albums' || isAlbumDetail) setAlbumsMounted(true);
    else if (url === '/people') setPeopleMounted(true);
    else if (url === '/search') setSearchMounted(true);
  }, [url, isAlbumDetail]);

  // Determine which tab is active for styling
  const activeTab = isAlbumDetail ? '/albums' : basePath;

  return (
    <div style={{
      height: '100%',
      width: '100%',
      position: 'relative',
      backgroundColor: 'var(--color-background)'
    }}>
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
          backgroundColor: 'var(--color-background)'
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
          backgroundColor: 'var(--color-background)'
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
            visibility: !isAlbumDetail ? 'visible' : 'hidden',
            zIndex: !isAlbumDetail ? 1 : 0,
            backgroundColor: 'var(--color-background)'
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
            backgroundColor: 'var(--color-background)'
          }}
        >
          {albumDetailMounted && albumDetailId && <AlbumDetail albumId={albumDetailId} />}
        </div>
      </div>

      {/* People Tab */}
      <div
        style={{
          height: '100%',
          width: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          visibility: activeTab === '/people' ? 'visible' : 'hidden',
          zIndex: activeTab === '/people' ? 1 : 0,
          backgroundColor: 'var(--color-background)'
        }}
      >
        {peopleMounted && <People />}
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
          backgroundColor: 'var(--color-background)'
        }}
      >
        {searchMounted && <Search />}
      </div>
    </div>
  );
};

export function App() {
  const { isAuthenticated } = useAuth();

  // Log authentication state for debugging
  console.log('App rendering with authentication state:', isAuthenticated);

	return (
		<LocationProvider>
			<div id="app-container" style={{
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				backgroundColor: 'var(--color-background)'
			}}>
				<main style={{
					flex: 1,
					overflow: 'hidden',
					backgroundColor: 'var(--color-background)'
				}}>
					<Router>
						<Route path="/login" component={Login} />
						<Route default component={props => <ProtectedRoute component={PersistentTabsApp} {...props} />} />
					</Router>
				</main>
				{isAuthenticated && <TabBar />}
			</div>
		</LocationProvider>
	);
}

// Add safe area viewport meta tag for iOS
const meta = document.createElement('meta');
meta.name = 'viewport';
meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
document.head.appendChild(meta);

render(<App />, document.getElementById('app'));
