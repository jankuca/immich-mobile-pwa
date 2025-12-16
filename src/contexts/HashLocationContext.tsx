import { type ComponentChildren, createContext } from 'preact'
import { useCallback, useContext, useEffect, useState } from 'preact/hooks'

interface HashLocationContextValue {
  url: string
  path: string
  query: Record<string, string>
  route: (url: string, replace?: boolean) => void
}

const HashLocationContext = createContext<HashLocationContextValue | null>(null)

/**
 * Get the current path from the hash portion of the URL.
 * For example, /#/albums/123 returns /albums/123
 */
function getHashPath(): string {
  const hash = window.location.hash
  // Remove the leading #
  const path = hash.slice(1)
  // Default to / if no hash path
  return path || '/'
}

/**
 * Parse query string from hash path
 */
function parseQuery(url: string): Record<string, string> {
  const queryIndex = url.indexOf('?')
  if (queryIndex === -1) return {}

  const queryString = url.slice(queryIndex + 1)
  const params = new URLSearchParams(queryString)
  const result: Record<string, string> = {}
  params.forEach((value, key) => {
    result[key] = value
  })
  return result
}

/**
 * Get path without query string
 */
function getPathWithoutQuery(url: string): string {
  const queryIndex = url.indexOf('?')
  return queryIndex === -1 ? url : url.slice(0, queryIndex)
}

interface HashLocationProviderProps {
  children: ComponentChildren
}

export function HashLocationProvider({ children }: HashLocationProviderProps) {
  const [url, setUrl] = useState<string>(getHashPath())

  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      setUrl(getHashPath())
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Navigate to a new hash path
  const route = useCallback((newUrl: string, replace = false) => {
    const hashUrl = `#${newUrl}`
    if (replace) {
      window.history.replaceState(null, '', hashUrl)
    } else {
      window.history.pushState(null, '', hashUrl)
    }
    // Manually trigger state update since pushState/replaceState don't fire hashchange
    setUrl(newUrl)
  }, [])

  const path = getPathWithoutQuery(url)
  const query = parseQuery(url)

  const value: HashLocationContextValue = {
    url,
    path,
    query,
    route,
  }

  return <HashLocationContext.Provider value={value}>{children}</HashLocationContext.Provider>
}

/**
 * Hook to access hash-based location.
 * Provides the same API as preact-iso's useLocation.
 */
export function useHashLocation() {
  const context = useContext(HashLocationContext)
  if (!context) {
    throw new Error('useHashLocation must be used within a HashLocationProvider')
  }
  return context
}

