// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, CircularProgress } from '@mui/material'; // For loading state

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth(); // Get user and isLoading state
  const location = useLocation();

  if (isLoading) {
    // This handles the case where auth state is still being determined
    // Useful if navigating directly to a protected route on app load
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="calc(100vh - 64px)"> {/* Adjust height if AppBar is fixed */}
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    // User not logged in, redirect to login page
    // Pass the current location so we can redirect back after login
    console.log("ProtectedRoute: User not found, redirecting to login from", location.pathname);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User is logged in, render the requested component
  return children;
}
export default ProtectedRoute;
