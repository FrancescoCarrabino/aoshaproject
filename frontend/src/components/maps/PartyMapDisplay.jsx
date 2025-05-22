// src/components/maps/PartyMapDisplay.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import { useSocket } from '../../context/SocketContext';
import MapDisplay from './MapDisplay';

const PartyMapDisplay = () => {
  const { activePartyMap, isConnected } = useSocket();

  const [imageState, setImageState] = useState({
    urlAttempted: null, // The URL we are currently trying to load or have last tried
    naturalWidth: 0,
    naturalHeight: 0,
    isLoading: false,
    error: null,
  });

  // useRef to hold the Image object. This ensures the same Image instance is used across renders for loading.
  const imageLoader = useRef(null);
  const partyMapDisplayTransformWrapperRef = useRef(null);

  // Initialize the Image object once
  if (!imageLoader.current) {
    imageLoader.current = new Image();
  }

  useEffect(() => {
    const img = imageLoader.current; // Use the persistent Image object
    const targetUrl = activePartyMap?.mapAssetUrl || null;

    // console.log(`[PartyMapDisplay] useEffect running. TargetURL: ${targetUrl}, Current imageState.urlAttempted: ${imageState.urlAttempted}, isLoading: ${imageState.isLoading}`);

    // If the target URL is different from the one we last attempted to load,
    // OR if we are trying to reload the same URL that previously had an error.
    if (targetUrl && (targetUrl !== imageState.urlAttempted || (targetUrl === imageState.urlAttempted && imageState.error))) {
      console.log(`[PartyMapDisplay] Condition MET. Initiating load for: ${targetUrl}. Previous attempted: ${imageState.urlAttempted}`);

      // Update state to reflect the new loading attempt
      setImageState({
        urlAttempted: targetUrl,
        naturalWidth: 0,
        naturalHeight: 0,
        isLoading: true,
        error: null,
      });

      // Define handlers for THIS specific loading attempt.
      // These handlers will "capture" the current `targetUrl` in their closure.
      const handleLoad = () => {
        console.log(`[PartyMapDisplay] Onload triggered for img.src: ${img.src}. Expected target: ${targetUrl}`);
        // Only update state if this onload is for the URL we are currently interested in (targetUrl of this effect run)
        if (img.src.endsWith(targetUrl)) {
          console.log('[PartyMapDisplay] Onload MATCH! Dimensions:', img.naturalWidth, img.naturalHeight);
          setImageState({
            urlAttempted: targetUrl, // Confirm this URL was successful
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            isLoading: false,
            error: null,
          });
        } else {
          console.warn(`[PartyMapDisplay] Onload for STALE URL: ${img.src}. Current target: ${targetUrl}. Ignoring.`);
        }
      };

      const handleError = () => {
        console.error(`[PartyMapDisplay] Onerror triggered for img.src: ${img.src}. Expected target: ${targetUrl}`);
        if (img.src.endsWith(targetUrl)) {
          console.error('[PartyMapDisplay] Onerror MATCH! Failed to load:', targetUrl);
          setImageState({
            urlAttempted: targetUrl, // Confirm this URL attempt failed
            naturalWidth: 0,
            naturalHeight: 0,
            isLoading: false,
            error: `Failed to load map image: ${targetUrl}`,
          });
        } else {
          console.warn(`[PartyMapDisplay] Onerror for STALE URL: ${img.src}. Current target: ${targetUrl}. Ignoring.`);
        }
      };

      // Detach any previous handlers before attaching new ones to the same 'img' object
      img.onload = null;
      img.onerror = null;

      img.onload = handleLoad;
      img.onerror = handleError;

      console.log(`[PartyMapDisplay] Setting img.src = "${targetUrl}"`);
      img.src = targetUrl;

    } else if (!targetUrl && imageState.urlAttempted) {
      // No target URL, but there was a previous map. Reset state.
      console.log('[PartyMapDisplay] No active map. Resetting image state.');
      setImageState({ urlAttempted: null, naturalWidth: 0, naturalHeight: 0, isLoading: false, error: null });
      // It might also be good to clear img.src if the image object is reused,
      // though usually not strictly necessary if handlers are cleared.
      // img.src = ''; // Optional: to stop any ongoing load for the old URL
    }

    // The cleanup function for the useEffect hook.
    // This is important if activePartyMap.mapAssetUrl changes while an image is loading.
    // We want to ensure that the onload/onerror handlers from a *previous* effect run
    // (for a *previous* URL) don't interfere with the state of a *new* loading attempt.
    return () => {
      // console.log(`[PartyMapDisplay] Cleanup for useEffect. Current targetUrl in closure was: ${targetUrl}`);
      // By setting them to null, if an old image load completes after this cleanup,
      // its handlers won't execute or won't find their specific logic.
      // The new effect run will set its own handlers.
      img.onload = null;
      img.onerror = null;
    };

  }, [activePartyMap?.mapAssetUrl]); // Only dependency is the source URL from context

  // --- Render Logic ---

  if (!isConnected) { /* ... same ... */ }
  if (!activePartyMap) { /* ... same ... */ }

  if (imageState.isLoading) {
    return (
      <Paper sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>{activePartyMap.mapName || 'Loading Map...'}</Typography>
        <CircularProgress sx={{ my: 2 }} />
        <Typography variant="body2" color="text.secondary">Loading: {imageState.urlAttempted}</Typography>
      </Paper>
    );
  }

  if (imageState.error) {
    return (
      <Paper sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom color="error">{activePartyMap.mapName || 'Map Error'}</Typography>
        <Alert severity="error" sx={{ mt: 1 }}>{imageState.error}</Alert>
      </Paper>
    );
  }

  // Render MapDisplay if the attempted URL is set, we are not loading, there's no error, and we have dimensions
  if (imageState.urlAttempted && !imageState.isLoading && !imageState.error && imageState.naturalWidth > 0) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <MapDisplay
          mapImageUrl={imageState.urlAttempted}
          naturalWidth={imageState.naturalWidth}
          naturalHeight={imageState.naturalHeight}
          gridEnabled={activePartyMap.gridEnabled}
          gridSizePixels={activePartyMap.gridSizePixels}
          fogDataJsonString={activePartyMap.currentFogJsonString}
          elements={activePartyMap.currentElements}
          transformWrapperRef={partyMapDisplayTransformWrapperRef}
          isPanDisabled={false}
        />
      </Box>
    );
  }

  // Fallback / Initial state before any map is set, or if something unexpected happens
  // This might show briefly if activePartyMap is present but imageState.urlAttempted is not yet set by the effect.
  if (activePartyMap && !imageState.urlAttempted && !imageState.isLoading && !imageState.error) {
    return (
      <Paper sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>{activePartyMap.mapName}</Typography>
        <CircularProgress sx={{ my: 2 }} />
        <Typography variant="body2" color="text.secondary">Preparing map...</Typography>
      </Paper>
    );
  }

  // Default fallback if no other condition is met (e.g. activePartyMap is set, but targetUrl was null from it, and now imageState.urlAttempted is null)
  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
      <Typography variant="h6" gutterBottom>Party Map</Typography>
      <Typography variant="body1" color="text.secondary">Initializing map display...</Typography>
    </Paper>
  );
};

export default PartyMapDisplay;
