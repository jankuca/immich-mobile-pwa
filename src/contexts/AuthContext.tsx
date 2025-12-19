import { createContext } from 'preact'
import type { ComponentChildren } from 'preact'
import { useCallback, useContext, useEffect, useState } from 'preact/hooks'
import { apiService } from '../services/api'

// Define the user type
export interface User {
  id: string
  email: string
  name: string
  profileImagePath?: string
}

// Local storage keys
const API_KEY_STORAGE_KEY = 'immich_api_key'
const USER_STORAGE_KEY = 'immich_user'

// Check if the server is configured with an API key (pre-authenticated mode)
// The actual API key is never exposed to the client - the server adds it to proxy requests
declare global {
  interface Window {
    __IMMICH_PRE_AUTHENTICATED__?: boolean
  }
}
const IS_PRE_AUTHENTICATED =
  !!import.meta.env.VITE_IMMICH_PRE_AUTHENTICATED ||
  (typeof window !== 'undefined' && window.__IMMICH_PRE_AUTHENTICATED__ === true)

// Auth context type
interface AuthContextType {
  apiKey: string | null
  user: User | null
  isLoading: boolean
  error: string | null
  isAuthenticated: boolean
  isEnvAuth: boolean // True if authenticated via environment variable
  loginWithApiKey: (apiKeyValue: string) => Promise<boolean>
  logout: () => void
}

// Create context with undefined default
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Helper to get initial API key from localStorage (only used when not pre-authenticated)
const getStoredApiKey = (): string | null => {
  if (IS_PRE_AUTHENTICATED) {
    // In pre-auth mode, we don't need to store/retrieve API keys
    return null
  }
  const stored = localStorage.getItem(API_KEY_STORAGE_KEY)
  if (stored) {
    apiService.setApiKey(stored)
  }
  return stored
}

// Helper to get initial user
const getInitialUser = (): User | null => {
  if (IS_PRE_AUTHENTICATED) {
    // When pre-authenticated, create a default user immediately
    return {
      id: 'pre-auth-user',
      email: 'api-user@immich.app',
      name: 'API User',
    }
  }
  return JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null')
}

// Provider component
export const AuthProvider = ({ children }: { children: ComponentChildren }) => {
  const [apiKey, setApiKey] = useState<string | null>(getStoredApiKey)
  const [user, setUser] = useState<User | null>(getInitialUser)
  const [isLoading, setIsLoading] = useState<boolean>(() => IS_PRE_AUTHENTICATED) // Loading if we need to verify pre-auth
  const [error, setError] = useState<string | null>(null)
  const [isEnvAuth] = useState<boolean>(() => IS_PRE_AUTHENTICATED)

  // Verify pre-authentication on mount by making a test API call
  useEffect(() => {
    if (!IS_PRE_AUTHENTICATED) {
      return
    }

    const verifyPreAuth = async () => {
      try {
        // Make a test API call to verify the server's API key is working
        const isValid = await apiService.verifyApiKey()
        if (!isValid) {
          console.error('Server pre-authentication failed')
          setError('Server authentication failed')
          setUser(null)
        }
      } catch (err) {
        console.error('Failed to verify pre-authentication:', err)
        setError('Failed to verify authentication')
      } finally {
        setIsLoading(false)
      }
    }

    verifyPreAuth()
  }, [])

  // Login with API key
  const loginWithApiKey = useCallback(async (apiKeyValue: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)

      // Clean up the API key (remove any whitespace)
      const cleanApiKey = apiKeyValue.trim()

      // Set the API key directly
      localStorage.setItem(API_KEY_STORAGE_KEY, cleanApiKey)
      apiService.setApiKey(cleanApiKey)

      // Verify the API key
      const isValid = await apiService.verifyApiKey()

      if (!isValid) {
        // If verification fails, the API key is invalid
        localStorage.removeItem(API_KEY_STORAGE_KEY)
        apiService.setApiKey('')
        throw new Error('Invalid API key')
      }

      // Create a simple user object
      const mockUser: User = {
        id: 'api-user',
        email: 'api-user@immich.app',
        name: 'API User',
      }

      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUser))

      console.log('logged in', apiKeyValue, mockUser)

      // Update state
      setApiKey(cleanApiKey)
      setUser(mockUser)

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to login')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Logout function
  const logout = useCallback((): void => {
    localStorage.removeItem(API_KEY_STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
    apiService.setApiKey('')

    // Update state
    setApiKey(null)
    setUser(null)

    // Redirect to login page
    window.location.href = '/login'
  }, [])

  const value: AuthContextType = {
    apiKey,
    user,
    isLoading,
    error,
    // In pre-auth mode, we're authenticated if we have a user (no apiKey needed)
    // In normal mode, we need both apiKey and user
    isAuthenticated: isEnvAuth ? !!user : !!apiKey && !!user,
    isEnvAuth,
    loginWithApiKey,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
