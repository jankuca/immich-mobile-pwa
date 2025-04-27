import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import useAuth from '../../services/auth';

export function Login() {
  const [apiKey, setApiKey] = useState<string>('');
  const [serverUrl, setServerUrl] = useState<string>('http://100.64.0.1:2283');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { loginWithApiKey, isAuthenticated } = useAuth();

  // Check if user is already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Get the redirect URL from localStorage or default to home
      const redirectPath = localStorage.getItem('redirect_after_login') || '/';
      // Clear the redirect URL
      localStorage.removeItem('redirect_after_login');
      // Redirect to the saved path or home
      route(redirectPath, true);
    }
  }, [isAuthenticated]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!apiKey) {
      setError('Please enter your API key');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const success = await loginWithApiKey(apiKey);

      if (success) {
        // The useEffect hook will handle the redirect
        // No need to call route() here
      } else {
        setError('Invalid API key');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to login. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--spacing-lg)',
      backgroundColor: 'var(--color-background)'
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        padding: 'var(--spacing-xl)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        backgroundColor: 'var(--color-background)'
      }}>
        <h1 style={{
          fontSize: 'var(--font-size-xxl)',
          fontWeight: 'var(--font-weight-bold)',
          marginBottom: 'var(--spacing-lg)',
          textAlign: 'center'
        }}>
          Immich
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <label
              htmlFor="server"
              style={{
                display: 'block',
                marginBottom: 'var(--spacing-xs)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)'
              }}
            >
              Server URL
            </label>
            <input
              type="text"
              id="server"
              value={serverUrl}
              onInput={(e) => setServerUrl((e.target as HTMLInputElement).value)}
              style={{
                width: '100%',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-gray-light)',
                fontSize: 'var(--font-size-md)',
                backgroundColor: 'var(--color-light)',
                color: 'var(--color-text)'
              }}
              disabled
            />
          </div>

          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label
              htmlFor="apiKey"
              style={{
                display: 'block',
                marginBottom: 'var(--spacing-xs)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)'
              }}
            >
              API Key
            </label>
            <input
              type="text"
              id="apiKey"
              value={apiKey}
              onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
              style={{
                width: '100%',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-gray-light)',
                fontSize: 'var(--font-size-md)',
                backgroundColor: 'var(--color-light)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-geist-mono)'
              }}
              placeholder="Enter your Immich API key"
              required
            />
            <p style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-gray)',
              marginTop: 'var(--spacing-xs)'
            }}>
              You can generate an API key in the Immich web interface under Settings → API Keys
            </p>
          </div>

          {error && (
            <div style={{
              padding: 'var(--spacing-md)',
              backgroundColor: 'rgba(255, 59, 48, 0.1)',
              color: 'var(--color-danger)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-lg)',
              fontSize: 'var(--font-size-sm)',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: 'var(--spacing-md)',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-md)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-sm)'
            }}
          >
            {isLoading && (
              <div class="loading-spinner" style={{
                width: '20px',
                height: '20px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            )}
            <span>{isLoading ? 'Logging in...' : 'Login'}</span>

            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
