// src/App.jsx
import React from 'react'; // Removed useContext as it wasn't used directly here
import { Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext'; // useAuth is still needed
import { SocketProvider } from './context/SocketContext';
import { CssBaseline, Box, CircularProgress } from '@mui/material';

// Page Imports
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CharacterSheetPage from './pages/CharacterSheetPage';
import StoryPage from './pages/StoryPage';
import SessionLogsPage from './pages/SessionLogsPage';
import NPCsPage from './pages/NPCsPage';
import AssetLibraryPage from './pages/AssetLibraryPage';
import GazetteerPage from './pages/GazetteerPage';
import MapsManagementPage from './pages/MapsManagementPage'; // Your map management page
import MapEditorPage from './pages/MapEditorPage';       // Your map editor page
import NotFoundPage from './pages/NotFoundPage';

// Component Imports
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout'; // Your main layout component

function AppRoutes() {
  const { isLoading: isAuthLoading, user } = useAuth(); // Get user for role-based DM routes

  if (isAuthLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh"
        sx={{ backgroundColor: (theme) => theme.palette.background.default }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* All routes that should use the main layout go inside here */}
      <Route element={<Layout />}>
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/character/:characterId" element={<ProtectedRoute><CharacterSheetPage /></ProtectedRoute>} />
        <Route path="/story" element={<ProtectedRoute><StoryPage /></ProtectedRoute>} />
        <Route path="/sessions" element={<ProtectedRoute><SessionLogsPage /></ProtectedRoute>} />
        <Route path="/asset-library" element={<ProtectedRoute><AssetLibraryPage /></ProtectedRoute>} />
        <Route path="/gazetteer" element={<ProtectedRoute><GazetteerPage /></ProtectedRoute>} />

        {/* DM Only Routes - Ensure they are also children of Layout route */}
        {/* You can check user role here for the route itself, or let ProtectedRoute handle it if it supports `requiredRole` */}

        {/* NPCs Page (DM Only) */}
        <Route
          path="/npcs"
          element={
            <ProtectedRoute requiredRole="DM"> {/* Assuming ProtectedRoute handles requiredRole */}
              <NPCsPage />
            </ProtectedRoute>
          }
        />

        {/* Maps Management Page (DM Only) */}
        <Route
          path="/maps-management"
          element={
            <ProtectedRoute requiredRole="DM">
              <MapsManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Map Editor Page (DM Only) */}
        <Route
          path="/maps/:mapId/editor"
          element={
            <ProtectedRoute requiredRole="DM">
              <MapEditorPage />
            </ProtectedRoute>
          }
        />

        {/* Add other DM-only routes here, wrapped in Layout and ProtectedRoute */}

      </Route> {/* End of routes wrapped by Layout */}

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function App() {
  return (
    // StrictMode can be added here if not already in main.jsx
    // <React.StrictMode> 
    <AuthProvider>
      <SocketProvider>
        <CssBaseline />
        <AppRoutes />
      </SocketProvider>
    </AuthProvider>
    // </React.StrictMode>
  );
}

export default App;
