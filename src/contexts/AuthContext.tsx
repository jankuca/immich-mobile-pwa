import { createContext } from 'preact'
import { useCallback, useContext, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
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

// Auth context type
interface AuthContextType {
  apiKey: string | null
  user: User | null
  isLoading: boolean
  error: string | null
  isAuthenticated: boolean
  loginWithApiKey: (apiKeyValue: string) => Promise<boolean>
  logout: () => void
}

// Create context with undefined default
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider component
export const AuthProvider = ({ children }: { children: ComponentChildren }) => {
  const [apiKey, setApiKey] = useState<string | null>(() => {
    const stored = localStorage.getItem(API_KEY_STORAGE_KEY)
    if (stored) {
      apiService.setApiKey(stored)
    }
    return stored
  })
  const [user, setUser] = useState<User | null>(() =>
    JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null')
  )
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

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
    isAuthenticated: !!apiKey && !!user,
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

