// src/context/SocketContext.jsx
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext'; // Ensure this path is correct

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';

export const SocketProvider = ({ children }) => {
  const { token, user, isLoading: isAuthLoading } = useAuth();
  const socketRef = useRef(null); // Authoritative reference to the socket instance

  // States to reflect socket status for consumers
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticatedOnSocket, setIsAuthenticatedOnSocket] = useState(false);

  // State for the active party map data
  const [activePartyMap, setActivePartyMap] = useState(null);
  // Example structure for activePartyMap:
  // {
  //   mapId: number,
  //   mapName: string,
  //   mapAssetUrl: string,
  //   gridEnabled: boolean,
  //   gridSizePixels: number,
  //   naturalWidth: number, // Will be set by PartyMapDisplay/MapEditor after image loads
  //   naturalHeight: number, // Will be set by PartyMapDisplay/MapEditor
  //   currentFogJsonString: string, 
  //   currentElements: [], // Array of element objects
  // }

  useEffect(() => {
    // Only attempt to connect if auth is not loading, and token & user exist
    if (!isAuthLoading && token && user) {
      // If there's no current socket instance, or if it's there but disconnected, create a new one.
      if (!socketRef.current || !socketRef.current.connected) {
        // If there's an old, disconnected socket instance, explicitly disconnect and clean up listeners.
        if (socketRef.current) {
          console.log('[SocketProvider] Cleaning up old, disconnected socket:', socketRef.current.id);
          socketRef.current.removeAllListeners(); // Remove all listeners from the old socket
          socketRef.current.disconnect();
        }

        console.log('[SocketProvider] Attempting to create and connect new socket...');
        const newSocket = io(SOCKET_URL, {
          // Consider adding transports if you face issues, e.g., ['websocket', 'polling']
          // reconnectionAttempts: 5, // Example: attempt to reconnect 5 times
        });
        socketRef.current = newSocket; // Assign new socket to ref

        // --- Standard Socket.IO Connection Events ---
        newSocket.on('connect', () => {
          console.log('[SocketProvider] Socket connected:', newSocket.id);
          setIsConnected(true);
          console.log('[SocketProvider] Emitting authenticate with token.');
          newSocket.emit('authenticate', token); // Authenticate immediately upon connection
        });

        newSocket.on('authenticated', (data) => {
          console.log('[SocketProvider] Socket authenticated:', data.message || 'Success');
          setIsAuthenticatedOnSocket(true);
        });

        newSocket.on('unauthorized', (data) => {
          console.error('[SocketProvider] Socket authentication failed:', data.error);
          setIsAuthenticatedOnSocket(false);
          // Optionally, disconnect if unauthorized to prevent further emits/listens on a bad state
          // newSocket.disconnect(); 
        });

        newSocket.on('disconnect', (reason) => {
          console.log('[SocketProvider] Socket disconnected:', reason, '(ID was:', newSocket.id, ')');
          setIsConnected(false);
          setIsAuthenticatedOnSocket(false);
          setActivePartyMap(null); // Clear active map data on disconnect
          // If the disconnected socket is the one in our ref, nullify the ref.
          // This handles cases where an old socket disconnects after a new one is already in place.
          if (socketRef.current && socketRef.current.id === newSocket.id) {
            socketRef.current = null;
          }
        });

        newSocket.on('connect_error', (err) => {
          console.error('[SocketProvider] Socket connection error:', err.message, '(Attempted ID:', newSocket.id, ')');
          setIsConnected(false);
          setIsAuthenticatedOnSocket(false);
          setActivePartyMap(null);
          if (socketRef.current && socketRef.current.id === newSocket.id) {
            socketRef.current = null;
          }
        });

        // --- AOSHA-Specific Custom Event Listeners (Chat, Dice - you might have these elsewhere or add them here) ---
        // Example: newSocket.on('chat_message_party_new', (message) => { /* handle party chat */ });
        // Example: newSocket.on('dice_roll_public_new', (roll) => { /* handle public roll */ });

        // --- Interactive Map Event Listeners ---
        newSocket.on('party_active_map_changed', (data) => {
          console.log('[SocketProvider] Event: party_active_map_changed - Data:', data);
          if (data && data.mapId) {
            setActivePartyMap({
              mapId: data.mapId,
              mapName: data.mapName,
              mapAssetUrl: data.mapAssetUrl,
              gridEnabled: data.gridEnabled,
              gridSizePixels: data.gridSizePixels,
              currentFogJsonString: data.initialFogDataJson || JSON.stringify([]), // Ensure string
              currentElements: data.initialElements || [], // Ensure array
              // naturalWidth/Height will be set by the component rendering the map
            });
          } else {
            setActivePartyMap(null); // If invalid data, clear map
          }
        });

        newSocket.on('map_fog_updated', (data) => {
          // data: { mapId, fogDataJson }
          console.log('[SocketProvider] Event: map_fog_updated - Data:', data);
          setActivePartyMap(prevMap => {
            if (prevMap && prevMap.mapId === data.mapId) {
              return { ...prevMap, currentFogJsonString: data.fogDataJson };
            }
            return prevMap; // No change if mapId doesn't match or no active map
          });
        });

        newSocket.on('map_element_added_or_updated', (data) => {
          // data: { mapId, elementData }
          console.log('[SocketProvider] Event: map_element_added_or_updated - Data:', data);
          setActivePartyMap(prevMap => {
            if (prevMap && prevMap.mapId === data.mapId && data.elementData) {
              const newElements = [...prevMap.currentElements];
              const index = newElements.findIndex(el => el.id === data.elementData.id);
              if (index > -1) {
                newElements[index] = data.elementData; // Update existing
              } else {
                newElements.push(data.elementData); // Add new
              }
              return { ...prevMap, currentElements: newElements };
            }
            return prevMap;
          });
        });

        newSocket.on('map_element_deleted', (data) => {
          // data: { mapId, elementId }
          console.log('[SocketProvider] Event: map_element_deleted - Data:', data);
          setActivePartyMap(prevMap => {
            if (prevMap && prevMap.mapId === data.mapId) {
              return {
                ...prevMap,
                currentElements: prevMap.currentElements.filter(el => el.id !== data.elementId)
              };
            }
            return prevMap;
          });
        });

        newSocket.on('map_error', (errorData) => {
          console.error('[SocketProvider] Received map_error from server:', errorData.error || errorData);
          // TODO: Consider displaying a user-facing notification/toast for map errors
        });
      }
    } else {
      // This block handles cases where:
      // 1. Auth is still loading.
      // 2. No token or user is available (e.g., logged out).
      // If there's an active socket, it should be disconnected.
      if (socketRef.current) {
        console.log('[SocketProvider] Conditions for connection not met (auth loading, no token/user). Disconnecting existing socket:', socketRef.current.id);
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null; // Clear the ref
      }
      // Ensure local state reflects the disconnected status
      if (isConnected) setIsConnected(false);
      if (isAuthenticatedOnSocket) setIsAuthenticatedOnSocket(false);
      if (activePartyMap) setActivePartyMap(null);
    }

    // Effect cleanup function
    return () => {
      if (socketRef.current) {
        console.log('[SocketProvider] useEffect cleanup: Disconnecting socket:', socketRef.current.id);
        socketRef.current.removeAllListeners(); // Good practice to remove listeners
        socketRef.current.disconnect();
        socketRef.current = null; // Clear the ref on component unmount or before effect re-runs
      }
    };
  }, [token, user, isAuthLoading]); // Dependencies for re-running the effect

  // --- Emitter Functions (wrapped with useCallback for performance and stable references) ---

  // Generic helper to emit events if socket is ready
  const emitAuthenticatedEvent = useCallback((eventName, data) => {
    if (socketRef.current && socketRef.current.connected && isAuthenticatedOnSocket) {
      socketRef.current.emit(eventName, data);
    } else {
      console.warn(
        `[SocketProvider] Socket not ready to emit '${eventName}'. Connected: ${isConnected}, Authenticated: ${isAuthenticatedOnSocket}`
      );
    }
  }, [isConnected, isAuthenticatedOnSocket]); // socketRef.current is stable due to useRef

  // Map specific emitters
  const emitDmSetPartyMap = useCallback((mapId) => {
    if (typeof mapId !== 'number') {
      console.error('[SocketProvider] emitDmSetPartyMap: mapId must be a number.');
      return;
    }
    emitAuthenticatedEvent('dm_set_active_map_for_party', { mapId });
  }, [emitAuthenticatedEvent]);

  const emitDmUpdateMapFog = useCallback((mapId, newFogDataJsonString) => {
    if (typeof mapId !== 'number' || typeof newFogDataJsonString !== 'string') {
      console.error('[SocketProvider] emitDmUpdateMapFog: Invalid parameters.');
      return;
    }
    emitAuthenticatedEvent('dm_update_map_fog', { mapId, newFogDataJson: newFogDataJsonString });
  }, [emitAuthenticatedEvent]);

  const emitDmUpdateMapElement = useCallback((mapId, elementData) => {
    // elementData should be the full, validated element object (typically after DB save)
    if (typeof mapId !== 'number' || !elementData || typeof elementData.id !== 'number') {
      console.error('[SocketProvider] emitDmUpdateMapElement: Invalid parameters.');
      return;
    }
    emitAuthenticatedEvent('dm_update_map_element', { mapId, elementData });
  }, [emitAuthenticatedEvent]);

  const emitDmDeleteMapElement = useCallback((mapId, elementId) => {
    if (typeof mapId !== 'number' || typeof elementId !== 'number') {
      console.error('[SocketProvider] emitDmDeleteMapElement: Invalid parameters.');
      return;
    }
    emitAuthenticatedEvent('dm_delete_map_element', { mapId, elementId });
  }, [emitAuthenticatedEvent]);

  // --- Add other emitters for chat, dice rolls etc. using emitAuthenticatedEvent ---
  // Example Chat Emitter:
  // const emitChatMessageParty = useCallback((messageText) => {
  //   if (typeof messageText !== 'string' || messageText.trim() === '') return;
  //   emitAuthenticatedEvent('chat_message_party', { text: messageText });
  // }, [emitAuthenticatedEvent]);


  // Value provided by the context
  const contextValue = {
    socket: socketRef.current, // Direct access to the socket instance (use with caution)
    isConnected,
    isAuthenticatedOnSocket,

    activePartyMap, // The currently active map's data for the party
    // Method to update parts of activePartyMap locally if needed (e.g. natural dimensions from component)
    // This is useful if a component (like PartyMapDisplay) determines image dimensions
    // and wants to store them in the context's activePartyMap state.
    updateActivePartyMapDetails: useCallback((details) => {
      setActivePartyMap(prev => prev ? { ...prev, ...details } : null);
    }, []),

    // Map Emitters
    emitDmSetPartyMap,
    emitDmUpdateMapFog,
    emitDmUpdateMapElement,
    emitDmDeleteMapElement,

    // Generic emitter (or specific ones like emitChatMessageParty)
    // emitEvent: emitAuthenticatedEvent, // You can expose the generic one if preferred
    // emitChatMessageParty, // example
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};
