// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  loginUser as apiLoginUser,
  setAuthToken,
  getCurrentUser as apiGetCurrentUser
} from '../services/apiService';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => localStorage.getItem('aoshaToken')); // Initialize from localStorage directly
  const [isLoading, setIsLoading] = useState(true); // To track initial auth check
  const navigate = useNavigate();

  console.log('[AuthContext] AuthProvider rendering/re-rendering. Initial isLoading:', isLoading, 'Token from state:', token);

  useEffect(() => {
    console.log('[AuthContext] useEffect for initializeAuth runs.');
    // setIsLoading(true); // Not needed here as it's true by default and this effect runs once.

    const initializeAuth = async () => {
      console.log('[AuthContext] initializeAuth started.');
      const storedToken = localStorage.getItem('aoshaToken');
      console.log('[AuthContext] Stored token from localStorage in initializeAuth:', storedToken);

      if (storedToken) {
        console.log("[AuthContext] Found token in localStorage, attempting to re-authenticate...");
        setAuthToken(storedToken); // Set token for API calls
        try {
          const currentUser = await apiGetCurrentUser(); // Fetch user details
          // If apiGetCurrentUser throws, this part is skipped.
          setUser(currentUser);
          setTokenState(storedToken); // Sync token state if needed, though localStorage is prime
          console.log("[AuthContext] User successfully re-authenticated:", currentUser);
        } catch (error) {
          console.error("[AuthContext] Failed to re-authenticate with stored token:", error.message || error);
          localStorage.removeItem('aoshaToken');
          setAuthToken(null); // Clear token from axios headers
          setUser(null);
          setTokenState(null);
          // No navigation here, ProtectedRoute will handle it.
        }
      } else {
        console.log("[AuthContext] No token found in localStorage during initializeAuth.");
        // Ensure user & token states are null if no token
        setUser(null);
        setTokenState(null);
        setAuthToken(null); // Ensure Axios token is also cleared if somehow set
      }

      setIsLoading(false); // Finished initial auth check, regardless of outcome
      console.log('[AuthContext] initializeAuth finished. Auth isLoading set to:', false);
    };

    initializeAuth();
  }, []); // Empty dependency array: Run only once on component mount

  const login = async (email, password) => {
    console.log('[AuthContext] login function called.');
    // LoginPage should handle its own button loading state.
    // AuthContext.isLoading is for the initial app load/auth check.
    try {
      const data = await apiLoginUser({ email, password }); // data = { message, token, user }
      localStorage.setItem('aoshaToken', data.token);
      setAuthToken(data.token);
      setUser(data.user);
      setTokenState(data.token);
      console.log("[AuthContext] Login successful, user set:", data.user, "Token set.");
      // navigate('/dashboard'); // Or let the LoginPage handle navigation on success
      return data.user;
    } catch (error) {
      console.error("[AuthContext] Login failed:", error.message || error);
      localStorage.removeItem('aoshaToken');
      setAuthToken(null);
      setUser(null);
      setTokenState(null);
      throw error;
    }
  };

  const logout = () => {
    console.log("[AuthContext] logout function called.");
    localStorage.removeItem('aoshaToken');
    setAuthToken(null);
    setUser(null);
    setTokenState(null);
    console.log("[AuthContext] User logged out, states cleared. Navigating to /login.");
    navigate('/login', { replace: true });
  };

  const contextValue = {
    user,
    token,
    isLoading, // This is the crucial state for App.jsx's global loader
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined || context === null) { // context could be undefined if not wrapped
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
