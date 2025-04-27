import { useState, useEffect } from 'preact/hooks';
import apiService from './api';

// Define the user type
export interface User {
  id: string;
  email: string;
  name: string;
  profileImagePath?: string;
}

// Local storage keys
const API_KEY_STORAGE_KEY = 'immich_api_key';
const USER_STORAGE_KEY = 'immich_user';

// Create a singleton instance to share auth state across components
let globalApiKey: string | null = localStorage.getItem(API_KEY_STORAGE_KEY);
let globalUser: User | null = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null');

// Initialize API service with stored API key
if (globalApiKey) {
  apiService.setApiKey(globalApiKey);
}

// Auth service
export const useAuth = () => {
  const [apiKey, setApiKey] = useState<string | null>(globalApiKey);
  const [user, setUser] = useState<User | null>(globalUser);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Login with API key
  const loginWithApiKey = async (apiKeyValue: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Attempting to login with API key:', apiKeyValue.substring(0, 5) + '...');

      // Clean up the API key (remove any whitespace)
      const cleanApiKey = apiKeyValue.trim();

      // Set the API key directly
      localStorage.setItem(API_KEY_STORAGE_KEY, cleanApiKey);
      apiService.setApiKey(cleanApiKey);

      // Verify the API key
      const isValid = await apiService.verifyApiKey();

      if (!isValid) {
        // If verification fails, the API key is invalid
        localStorage.removeItem(API_KEY_STORAGE_KEY);
        apiService.setApiKey('');
        throw new Error('Invalid API key');
      }

      // If we get here, the API key is valid
      console.log('API key verified successfully');

      // Create a simple user object
      const mockUser: User = {
        id: 'api-user',
        email: 'api-user@immich.app',
        name: 'API User',
      };

      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mockUser));

      // Update global state
      globalApiKey = apiKeyValue;
      globalUser = mockUser;

      // Update component state
      setUser(mockUser);
      setApiKey(apiKeyValue);

      return true;
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Failed to login');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = (): void => {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    apiService.setApiKey('');

    // Update global state
    globalApiKey = null;
    globalUser = null;

    // Update component state
    setApiKey(null);
    setUser(null);

    // Redirect to login page
    window.location.href = '/login';
  };

  return {
    apiKey,
    user,
    isLoading,
    error,
    isAuthenticated: !!apiKey && !!user,
    loginWithApiKey,
    logout,
  };
};

export default useAuth;
