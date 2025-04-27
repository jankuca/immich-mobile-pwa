import { render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';
import { useEffect } from 'preact/hooks';
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

export function App() {
  const { isAuthenticated } = useAuth();

  // Log authentication state for debugging
  console.log('App rendering with authentication state:', isAuthenticated);

	return (
		<LocationProvider>
			<div id="app-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
				<main style={{ flex: 1, overflow: 'hidden' }}>
					<Router>
						<Route path="/login" component={Login} />
						<Route path="/" component={props => <ProtectedRoute component={Timeline} {...props} />} />
						<Route path="/albums" component={props => <ProtectedRoute component={Albums} {...props} />} />
						<Route path="/albums/:id" component={props => <ProtectedRoute component={AlbumDetail} {...props} />} />
						<Route path="/people" component={props => <ProtectedRoute component={People} {...props} />} />
						<Route path="/search" component={props => <ProtectedRoute component={Search} {...props} />} />
						<Route default component={NotFound} />
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
