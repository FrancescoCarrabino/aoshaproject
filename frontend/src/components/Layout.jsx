// src/components/Layout.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Button, Container, Box, IconButton,
  Menu, MenuItem, Avatar, Tooltip, Divider, CssBaseline
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ChatIcon from '@mui/icons-material/ChatBubbleOutline';
import MapIcon from '@mui/icons-material/Map'; // Icon for Map Panel
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'; // For collapsing leftmost of side panels
import ChevronRightIcon from '@mui/icons-material/ChevronRight'; // For collapsing rightmost panel

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext'; // To check for activePartyMap
import ChatPanel from './chat/ChatPanel';
import PartyMapDisplay from './maps/PartyMapDisplay'; // Import PartyMapDisplay

// --- Constants for Panel Sizes (adjust as needed) ---
// Two-panel (only Chat)
const MAIN_CONTENT_DEFAULT_TWO_PANEL = 75;
const CHAT_PANEL_DEFAULT_TWO_PANEL = 25;

// Three-panel (Map and Chat)
const MAIN_CONTENT_DEFAULT_THREE_PANEL = 60; // Or 50
const MAP_PANEL_DEFAULT_THREE_PANEL = 20;    // Or 25
const CHAT_PANEL_DEFAULT_THREE_PANEL = 20;   // Or 25

const MAIN_CONTENT_MIN_PERCENT = 30; // Min size for main content
const SIDE_PANEL_MIN_PERCENT = 10;  // Min size for side panels (map or chat)
const SIDE_PANEL_COLLAPSED_SIZE_PERCENT = 0; // Size when collapsed

function Layout() {
  const { user, logout } = useAuth();
  const { activePartyMap } = useSocket(); // Get activePartyMap to conditionally render map panel content effectively
  const location = useLocation();
  const [anchorElUser, setAnchorElUser] = useState(null);
  const panelGroupRef = useRef(null);

  // --- State for Map Panel ---
  const [isMapPanelForceCollapsed, setIsMapPanelForceCollapsed] = useState(() => {
    const saved = localStorage.getItem('isMapPanelForceCollapsed_v1'); // Use new key for new logic
    return saved === "true"; // Default to false (open) if nothing saved or if it's "false"
  });
  const [lastOpenMapSize, setLastOpenMapSize] = useState(() => {
    const saved = localStorage.getItem('lastOpenMapSize_v1');
    const parsed = parseFloat(saved);
    return !isNaN(parsed) && parsed >= SIDE_PANEL_MIN_PERCENT ? parsed : MAP_PANEL_DEFAULT_THREE_PANEL;
  });

  // --- State for Chat Panel (existing) ---
  const [isChatPanelForceCollapsed, setIsChatPanelForceCollapsed] = useState(() => {
    const saved = localStorage.getItem('isChatPanelForceCollapsed_v2'); // Keep existing key
    return saved === "true";
  });
  const [lastOpenChatSize, setLastOpenChatSize] = useState(() => {
    const saved = localStorage.getItem('lastOpenChatSize_v2');
    const parsed = parseFloat(saved);
    // If only chat is open, it might take more space
    return !isNaN(parsed) && parsed >= SIDE_PANEL_MIN_PERCENT ? parsed : CHAT_PANEL_DEFAULT_TWO_PANEL;
  });

  // --- Effects for persisting panel states ---
  useEffect(() => {
    localStorage.setItem('isMapPanelForceCollapsed_v1', JSON.stringify(isMapPanelForceCollapsed));
  }, [isMapPanelForceCollapsed]);
  useEffect(() => {
    localStorage.setItem('lastOpenMapSize_v1', lastOpenMapSize.toString());
  }, [lastOpenMapSize]);
  useEffect(() => {
    localStorage.setItem('isChatPanelForceCollapsed_v2', JSON.stringify(isChatPanelForceCollapsed));
  }, [isChatPanelForceCollapsed]);
  useEffect(() => {
    localStorage.setItem('lastOpenChatSize_v2', lastOpenChatSize.toString());
  }, [lastOpenChatSize]);

  // Determine if side panels should be shown based on auth and route
  const showSidePanels = user && location.pathname !== '/login';
  // The map panel should ideally only try to take space if there's an active map,
  // but its collapsed state is user-controlled. PartyMapDisplay itself handles "no active map".
  const canShowMapPanel = showSidePanels; // Always allow toggling if side panels are generally shown

  const applyLayout = () => {
    if (panelGroupRef.current && showSidePanels) {
      const mapSize = isMapPanelForceCollapsed ? SIDE_PANEL_COLLAPSED_SIZE_PERCENT : lastOpenMapSize;
      const chatSize = isChatPanelForceCollapsed ? SIDE_PANEL_COLLAPSED_SIZE_PERCENT : lastOpenChatSize;

      let mainSize;
      let layoutArray;

      if (canShowMapPanel) { // Three panels active (even if one or both are collapsed by user)
        mainSize = 100 - mapSize - chatSize;
        // Ensure mainSize doesn't go below its minimum if map and chat are large
        if (mainSize < MAIN_CONTENT_MIN_PERCENT) {
          const deficit = MAIN_CONTENT_MIN_PERCENT - mainSize;
          // Reduce map and chat proportionally, or just one if the other is already at min/collapsed
          // This can get complex; for now, let RPP handle constraints as much as possible
          // by setting minSize on panels.
        }
        layoutArray = [mainSize, mapSize, chatSize];
      } else { // Only two panels (Main and Chat)
        mainSize = 100 - chatSize;
        layoutArray = [mainSize, chatSize]; // Assuming chat is the only other panel
      }
      panelGroupRef.current.setLayout(layoutArray);
    } else if (panelGroupRef.current && !showSidePanels) {
      panelGroupRef.current.setLayout([100]); // Only main content
    }
  };

  // Apply layout when collapsed states or last open sizes change
  useEffect(() => {
    applyLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapPanelForceCollapsed, isChatPanelForceCollapsed, lastOpenMapSize, lastOpenChatSize, showSidePanels, canShowMapPanel]);


  const toggleMapPanelCollapse = () => setIsMapPanelForceCollapsed(prev => !prev);
  const toggleChatPanelCollapse = () => setIsChatPanelForceCollapsed(prev => !prev);

  const handleOpenUserMenu = (event) => setAnchorElUser(event.currentTarget);
  const handleCloseUserMenu = () => setAnchorElUser(null);
  const handleLogout = () => { handleCloseUserMenu(); logout(); };
  const handleProfile = () => { handleCloseUserMenu(); /* navigate to profile */ };

  const mainNavLinks = [ /* ... your existing nav links ... */
    { path: "/dashboard", text: "Dashboard", requiresAuth: true, dmOnly: false },
    { path: "/story", text: "Story", requiresAuth: true, dmOnly: false },
    { path: "/sessions", text: "Sessions", requiresAuth: true, dmOnly: false },
    { path: "/asset-library", text: "Asset Library", requiresAuth: true, dmOnly: false },
    { path: "/gazetteer", text: "Gazetteer", requiresAuth: true, dmOnly: false },
    { path: "/maps-management", text: "Manage Maps", requiresAuth: true, dmOnly: true },
    { path: "/npcs", text: "NPCs", requiresAuth: true, dmOnly: false },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            {/* ... (AOSHA Title and User Menu - existing code) ... */}
            <Typography variant="h5" noWrap component={RouterLink} to={user ? "/dashboard" : "/"} sx={{ mr: 2, display: { xs: 'none', md: 'flex' }, fontFamily: '"Cinzel Decorative", "Cinzel", serif', fontWeight: 700, letterSpacing: '.1rem', color: 'inherit', textDecoration: 'none' }}> AOSHA </Typography>
            <Typography variant="h5" noWrap component={RouterLink} to={user ? "/dashboard" : "/"} sx={{ mr: 2, display: { xs: 'flex', md: 'none' }, flexGrow: 1, fontFamily: '"Cinzel Decorative", "Cinzel", serif', fontWeight: 700, letterSpacing: '.1rem', color: 'inherit', textDecoration: 'none' }}> AOSHA </Typography>

            {user && (<Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
              {mainNavLinks.map((link) => {
                if (link.dmOnly && user.role !== 'DM') return null;
                return (<Button key={link.text} color="inherit" component={RouterLink} to={link.path} > {link.text} </Button>);
              })}
            </Box>)}
            {!user && <Box sx={{ flexGrow: 1 }} />} {/* Spacer if no user */}


            {/* Panel Toggle Buttons - Grouped to the right, before user menu */}
            <Box sx={{ flexGrow: user ? 0 : 1 }} /> {/* Adjusted flexGrow */}
            {showSidePanels && (
              <>
                {canShowMapPanel && (
                  <Tooltip title={isMapPanelForceCollapsed ? "Show Map" : "Hide Map"}>
                    <IconButton color="inherit" onClick={toggleMapPanelCollapse} sx={{ ml: 1 }}>
                      {isMapPanelForceCollapsed ? <MapIcon /> : <ChevronLeftIcon /> /* Icon indicates action to expand/collapse relative to main content */}
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={isChatPanelForceCollapsed ? "Show Chat" : "Hide Chat"}>
                  <IconButton color="inherit" onClick={toggleChatPanelCollapse} sx={{ ml: canShowMapPanel ? 0.5 : 1 }}>
                    {isChatPanelForceCollapsed ? <ChatIcon /> : <ChevronRightIcon />}
                  </IconButton>
                </Tooltip>
              </>
            )}

            {user ? (
              <Box sx={{ flexGrow: 0, ml: showSidePanels ? 0.5 : 1 }}>
                <Tooltip title="Open settings">
                  <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                    <Avatar alt={user.username?.toUpperCase()} sx={{ bgcolor: 'secondary.main' }}>
                      {user.username ? user.username[0].toUpperCase() : <AccountCircleIcon />}
                    </Avatar>
                  </IconButton>
                </Tooltip>
                <Menu /* ... user menu items ... */ sx={{ mt: '45px' }} id="menu-appbar-user" anchorEl={anchorElUser} anchorOrigin={{ vertical: 'top', horizontal: 'right' }} keepMounted transformOrigin={{ vertical: 'top', horizontal: 'right' }} open={Boolean(anchorElUser)} onClose={handleCloseUserMenu} >
                  <MenuItem disabled> <Typography textAlign="center" variant="subtitle2">{user.username} ({user.role})</Typography> </MenuItem> <Divider />
                  <MenuItem onClick={handleProfile}> <Typography textAlign="center">Profile</Typography> </MenuItem>
                  <MenuItem onClick={handleLogout}> <Typography textAlign="center" color="error.main">Logout</Typography> </MenuItem>
                </Menu>
              </Box>
            ) : ((location.pathname !== '/login' && location.pathname !== '/') && <Button color="inherit" component={RouterLink} to="/login">Login</Button>)}
          </Toolbar>
        </Container>
      </AppBar>

      <Box sx={{ display: 'flex', flexGrow: 1, mt: '64px', /* AppBar height */ height: 'calc(100vh - 64px)' }}>
        {showSidePanels ? (
          <PanelGroup
            direction="horizontal"
            style={{ width: '100%', height: '100%' }}
            id="aoshaproject-main-layout-v6" // Incremented version for localStorage keys
            ref={panelGroupRef}
            autoSaveId="aoshaproject-panels-v6" // autoSaveId for RPP's internal persistence (optional if managing manually)
          >
            {/* Panel 1: Main Content */}
            <Panel
              id="main-content-panel-v6"
              order={1}
              minSize={MAIN_CONTENT_MIN_PERCENT}
              defaultSize={canShowMapPanel ? MAIN_CONTENT_DEFAULT_THREE_PANEL : MAIN_CONTENT_DEFAULT_TWO_PANEL}
            >
              <Container maxWidth={false} sx={{ height: '100%', overflowY: 'auto', py: 3, px: { xs: 2, sm: 3 }, boxSizing: 'border-box' }}>
                <Outlet />
              </Container>
            </Panel>

            {/* Divider 1 (between Main and Map/Chat) */}
            {(!isMapPanelForceCollapsed || !isChatPanelForceCollapsed) && ( // Only show divider if at least one side panel is open
              <PanelResizeHandle className="resize-handle-class" style={{ width: '8px', cursor: 'col-resize', /* ... other styles ... */ borderLeft: (theme) => `1px solid ${theme.palette.divider}`, borderRight: (theme) => `1px solid ${theme.palette.divider}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}> <Box sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} /> <Box sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} /> <Box sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} /> </Box>
              </PanelResizeHandle>
            )}

            {/* Panel 2: Party Map Display (conditionally rendered if canShowMapPanel) */}
            {canShowMapPanel && (
              <>
                <Panel
                  id="party-map-panel-v6"
                  order={2}
                  collapsible={true}
                  collapsedSize={SIDE_PANEL_COLLAPSED_SIZE_PERCENT}
                  minSize={SIDE_PANEL_MIN_PERCENT}
                  defaultSize={isMapPanelForceCollapsed ? SIDE_PANEL_COLLAPSED_SIZE_PERCENT : lastOpenMapSize}
                  onCollapse={(collapsed) => {
                    // RPP's onCollapse is reliable for when it *becomes* collapsed/expanded by its internal logic (e.g. double click handle)
                    // We use our own isMapPanelForceCollapsed for the toggle button
                    if (isMapPanelForceCollapsed !== collapsed) setIsMapPanelForceCollapsed(collapsed);
                  }}
                  onResize={(size, prevSize) => { // prevSize might be null on first load
                    if (size > SIDE_PANEL_COLLAPSED_SIZE_PERCENT && !isMapPanelForceCollapsed) {
                      setLastOpenMapSize(size);
                    } else if (size > SIDE_PANEL_COLLAPSED_SIZE_PERCENT && isMapPanelForceCollapsed) {
                      // If resized open while our state thought it was collapsed, sync state
                      setIsMapPanelForceCollapsed(false);
                      setLastOpenMapSize(size);
                    } else if (size === SIDE_PANEL_COLLAPSED_SIZE_PERCENT && !isMapPanelForceCollapsed && prevSize && prevSize > SIDE_PANEL_COLLAPSED_SIZE_PERCENT) {
                      // If RPP collapsed it (e.g. drag to 0), sync our state
                      setIsMapPanelForceCollapsed(true);
                    }
                  }}
                  style={{ backgroundColor: (theme) => theme.palette.background.default, display: 'flex', flexDirection: 'column', overflow: 'hidden', visibility: (isMapPanelForceCollapsed && lastOpenMapSize === SIDE_PANEL_COLLAPSED_SIZE_PERCENT) ? 'hidden' : 'visible' }}
                >
                  {!isMapPanelForceCollapsed && <PartyMapDisplay />}
                </Panel>

                {/* Divider 2 (between Map and Chat) - only if both map & chat could be open */}
                {(!isMapPanelForceCollapsed && !isChatPanelForceCollapsed) && (
                  <PanelResizeHandle className="resize-handle-class" style={{ width: '8px', cursor: 'col-resize', /* ... other styles ... */ borderLeft: (theme) => `1px solid ${theme.palette.divider}`, borderRight: (theme) => `1px solid ${theme.palette.divider}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}> <Box sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} /> <Box sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} /> <Box sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} /> </Box>
                  </PanelResizeHandle>
                )}
              </>
            )}

            {/* Panel 3: Chat Panel */}
            <Panel
              id="chat-panel-v6"
              order={canShowMapPanel ? 3 : 2} // Order changes based on map panel presence
              collapsible={true}
              collapsedSize={SIDE_PANEL_COLLAPSED_SIZE_PERCENT}
              minSize={SIDE_PANEL_MIN_PERCENT}
              defaultSize={isChatPanelForceCollapsed ? SIDE_PANEL_COLLAPSED_SIZE_PERCENT : (canShowMapPanel ? lastOpenChatSize : CHAT_PANEL_DEFAULT_TWO_PANEL)}
              onCollapse={(collapsed) => {
                if (isChatPanelForceCollapsed !== collapsed) setIsChatPanelForceCollapsed(collapsed);
              }}
              onResize={(size, prevSize) => {
                if (size > SIDE_PANEL_COLLAPSED_SIZE_PERCENT && !isChatPanelForceCollapsed) {
                  setLastOpenChatSize(size);
                } else if (size > SIDE_PANEL_COLLAPSED_SIZE_PERCENT && isChatPanelForceCollapsed) {
                  setIsChatPanelForceCollapsed(false);
                  setLastOpenChatSize(size);
                } else if (size === SIDE_PANEL_COLLAPSED_SIZE_PERCENT && !isChatPanelForceCollapsed && prevSize && prevSize > SIDE_PANEL_COLLAPSED_SIZE_PERCENT) {
                  setIsChatPanelForceCollapsed(true);
                }
              }}
              style={{ backgroundColor: (theme) => theme.palette.background.paper, display: 'flex', flexDirection: 'column', overflow: 'hidden', visibility: (isChatPanelForceCollapsed && lastOpenChatSize === SIDE_PANEL_COLLAPSED_SIZE_PERCENT) ? 'hidden' : 'visible' }}
            >
              {!isChatPanelForceCollapsed && <ChatPanel />}
            </Panel>

          </PanelGroup>
        ) : (
          // Only Main Content if side panels are not shown (e.g., login page)
          <Container component="main" sx={{ flexGrow: 1, py: 3, px: { xs: 2, sm: 3 }, overflowY: 'auto', height: '100%' }}>
            <Outlet />
          </Container>
        )}
      </Box>
    </Box>
  );
}

export default Layout;
