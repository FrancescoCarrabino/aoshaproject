// src/components/Layout.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'; // Added useNavigate
import {
  AppBar, Toolbar, Typography, Button, Container, Box, IconButton,
  Menu, MenuItem, Avatar, Tooltip, Divider, CssBaseline,
  Drawer, List, ListItem, ListItemButton, ListItemText // Added for Mobile Drawer
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ChatIcon from '@mui/icons-material/ChatBubbleOutline';
import MapIcon from '@mui/icons-material/Map';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuIcon from '@mui/icons-material/Menu'; // Added for Mobile Menu Toggle

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import ChatPanel from './chat/ChatPanel';
import PartyMapDisplay from './maps/PartyMapDisplay';

// --- Constants for Panel Sizes ---
const MAIN_CONTENT_DEFAULT_TWO_PANEL = 75;
const CHAT_PANEL_DEFAULT_TWO_PANEL = 25;
const MAIN_CONTENT_DEFAULT_THREE_PANEL = 60;
const MAP_PANEL_DEFAULT_THREE_PANEL = 20;
const CHAT_PANEL_DEFAULT_THREE_PANEL = 20;
const MAIN_CONTENT_MIN_PERCENT = 30;
const SIDE_PANEL_MIN_PERCENT = 10;
const SIDE_PANEL_COLLAPSED_SIZE_PERCENT = 0;

const drawerWidth = 240; // For mobile navigation drawer

function Layout() {
  const { user, logout } = useAuth();
  const { activePartyMap } = useSocket();
  const location = useLocation();
  const navigate = useNavigate(); // For navigation from profile action
  const [anchorElUser, setAnchorElUser] = useState(null);
  const panelGroupRef = useRef(null);

  // --- State for Mobile Navigation Drawer ---
  const [mobileOpen, setMobileOpen] = useState(false);

  // --- State for Map Panel ---
  const [isMapPanelForceCollapsed, setIsMapPanelForceCollapsed] = useState(() => {
    const saved = localStorage.getItem('isMapPanelForceCollapsed_v1');
    return saved === "true";
  });
  const [lastOpenMapSize, setLastOpenMapSize] = useState(() => {
    const saved = localStorage.getItem('lastOpenMapSize_v1');
    const parsed = parseFloat(saved);
    return !isNaN(parsed) && parsed >= SIDE_PANEL_MIN_PERCENT ? parsed : MAP_PANEL_DEFAULT_THREE_PANEL;
  });

  // --- State for Chat Panel ---
  const [isChatPanelForceCollapsed, setIsChatPanelForceCollapsed] = useState(() => {
    const saved = localStorage.getItem('isChatPanelForceCollapsed_v2');
    return saved === "true";
  });
  const [lastOpenChatSize, setLastOpenChatSize] = useState(() => {
    const saved = localStorage.getItem('lastOpenChatSize_v2');
    const parsed = parseFloat(saved);
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

  const showSidePanels = user && location.pathname !== '/login';
  const canShowMapPanel = showSidePanels;

  const applyLayout = () => {
    if (panelGroupRef.current && showSidePanels) {
      const mapSize = isMapPanelForceCollapsed ? SIDE_PANEL_COLLAPSED_SIZE_PERCENT : lastOpenMapSize;
      const chatSize = isChatPanelForceCollapsed ? SIDE_PANEL_COLLAPSED_SIZE_PERCENT : lastOpenChatSize;
      let mainSize;
      let layoutArray;
      if (canShowMapPanel) {
        mainSize = 100 - mapSize - chatSize;
        layoutArray = [mainSize, mapSize, chatSize];
      } else {
        mainSize = 100 - chatSize;
        layoutArray = [mainSize, chatSize];
      }
      panelGroupRef.current.setLayout(layoutArray);
    } else if (panelGroupRef.current && !showSidePanels) {
      panelGroupRef.current.setLayout([100]);
    }
  };

  useEffect(() => {
    applyLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapPanelForceCollapsed, isChatPanelForceCollapsed, lastOpenMapSize, lastOpenChatSize, showSidePanels, canShowMapPanel]);

  const toggleMapPanelCollapse = () => setIsMapPanelForceCollapsed(prev => !prev);
  const toggleChatPanelCollapse = () => setIsChatPanelForceCollapsed(prev => !prev);

  const handleOpenUserMenu = (event) => setAnchorElUser(event.currentTarget);
  const handleCloseUserMenu = () => setAnchorElUser(null);
  
  const handleLogout = () => {
    handleCloseUserMenu();
    if (mobileOpen) handleDrawerToggle(); // Close mobile drawer if open
    logout();
  };
  
  const handleProfile = () => {
    handleCloseUserMenu();
    if (mobileOpen) handleDrawerToggle(); // Close mobile drawer if open
    navigate('/profile'); // Navigate to profile page - ensure this route exists
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const mainNavLinks = [
    { path: "/dashboard", text: "Dashboard", requiresAuth: true, dmOnly: false },
    { path: "/story", text: "Story", requiresAuth: true, dmOnly: false },
    { path: "/sessions", text: "Sessions", requiresAuth: true, dmOnly: false },
    { path: "/asset-library", text: "Asset Library", requiresAuth: true, dmOnly: false },
    { path: "/gazetteer", text: "Gazetteer", requiresAuth: true, dmOnly: false },
    { path: "/maps-management", text: "Manage Maps", requiresAuth: true, dmOnly: true },
    { path: "/npcs", text: "NPCs", requiresAuth: true, dmOnly: false },
  ];

  // Content for the mobile navigation drawer
  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
      <Typography variant="h6" sx={{ my: 2, fontFamily: '"Cinzel Decorative", "Cinzel", serif' }}>
        AOSHA
      </Typography>
      <Divider />
      <List>
        {mainNavLinks.map((link) => {
          if (!user || (link.dmOnly && user.role !== 'DM')) return null;
          return (
            <ListItem key={link.text} disablePadding>
              <ListItemButton component={RouterLink} to={link.path}>
                <ListItemText primary={link.text} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider sx={{ my: 1 }}/>
      <List>
        <ListItem disablePadding>
            <ListItemButton onClick={handleProfile}>
                <ListItemText primary="Profile" />
            </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
            <ListItemButton onClick={handleLogout}>
                <ListItemText primary="Logout" sx={{ color: 'error.main' }}/>
            </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            {/* Mobile Menu Icon - visible on xs, hidden on md, only if user is logged in */}
            {user && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 1, display: { xs: 'flex', md: 'none' } }}
              >
                <MenuIcon />
              </IconButton>
            )}

            {/* Desktop Brand */}
            <Typography variant="h5" noWrap component={RouterLink} to={user ? "/dashboard" : "/"} sx={{ mr: 2, display: { xs: 'none', md: 'flex' }, fontFamily: '"Cinzel Decorative", "Cinzel", serif', fontWeight: 700, letterSpacing: '.1rem', color: 'inherit', textDecoration: 'none' }}> AOSHA </Typography>
            
            {/* Mobile Brand - takes remaining space on mobile */}
            <Typography variant="h5" noWrap component={RouterLink} to={user ? "/dashboard" : "/"} sx={{ display: { xs: 'flex', md: 'none' }, flexGrow: 1, fontFamily: '"Cinzel Decorative", "Cinzel", serif', fontWeight: 700, letterSpacing: '.1rem', color: 'inherit', textDecoration: 'none', justifyContent: 'center' /* Center if it's the main growing element */ }}> AOSHA </Typography>

            {/* Desktop Nav Links - takes remaining space on desktop if user */}
            {user && (
              <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
                {mainNavLinks.map((link) => {
                  if (link.dmOnly && user.role !== 'DM') return null;
                  return (<Button key={link.text} color="inherit" component={RouterLink} to={link.path} > {link.text} </Button>);
                })}
              </Box>
            )}
            
            {/* Spacer: if no user & on desktop & not on login/home, to push Login button to far right */}
            {!user && (location.pathname !== '/login' && location.pathname !== '/') && (
              <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }} />
            )}


            {/* Panel Toggle Buttons - Grouped to the right, before user menu */}
            {showSidePanels && (
              <>
                {canShowMapPanel && (
                  <Tooltip title={isMapPanelForceCollapsed ? "Show Map" : "Hide Map"}>
                    <IconButton color="inherit" onClick={toggleMapPanelCollapse} sx={{ ml: 1 }}>
                      {isMapPanelForceCollapsed ? <MapIcon /> : <ChevronLeftIcon />}
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

            {/* User Menu / Login Button */}
            {user ? (
              <Box sx={{ flexGrow: 0, ml: showSidePanels ? 0.5 : 1 }}>
                <Tooltip title="Open settings">
                  <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                    <Avatar alt={user.username?.toUpperCase()} sx={{ bgcolor: 'secondary.main' }}>
                      {user.username ? user.username[0].toUpperCase() : <AccountCircleIcon />}
                    </Avatar>
                  </IconButton>
                </Tooltip>
                <Menu sx={{ mt: '45px' }} id="menu-appbar-user" anchorEl={anchorElUser} anchorOrigin={{ vertical: 'top', horizontal: 'right' }} keepMounted transformOrigin={{ vertical: 'top', horizontal: 'right' }} open={Boolean(anchorElUser)} onClose={handleCloseUserMenu} >
                  <MenuItem disabled> <Typography textAlign="center" variant="subtitle2">{user.username} ({user.role})</Typography> </MenuItem> <Divider />
                  <MenuItem onClick={handleProfile}> <Typography textAlign="center">Profile</Typography> </MenuItem>
                  <MenuItem onClick={handleLogout}> <Typography textAlign="center" color="error.main">Logout</Typography> </MenuItem>
                </Menu>
              </Box>
            ) : (
              (location.pathname !== '/login' && location.pathname !== '/') && 
              <Button color="inherit" component={RouterLink} to="/login" sx={{ ml: 1 }}>Login</Button>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Navigation Drawer */}
      {user && (
        <Box component="nav">
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile.
            }}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
            }}
          >
            {drawer}
          </Drawer>
        </Box>
      )}

      {/* Main Content Area with Resizable Panels */}
      <Box sx={{ display: 'flex', flexGrow: 1, mt: '64px', height: 'calc(100vh - 64px)' }}>
        {showSidePanels ? (
          <PanelGroup
            direction="horizontal"
            style={{ width: '100%', height: '100%' }}
            id="aoshaproject-main-layout-v6"
            ref={panelGroupRef}
            autoSaveId="aoshaproject-panels-v6"
          >
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

            {(!isMapPanelForceCollapsed || !isChatPanelForceCollapsed) && (
              <PanelResizeHandle className="resize-handle-class" style={{ width: '8px', cursor: 'col-resize', borderLeft: (theme) => `1px solid ${theme.palette.divider}`, borderRight: (theme) => `1px solid ${theme.palette.divider}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}> <Box sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} /> <Box sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} /> <Box sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} /> </Box>
              </PanelResizeHandle>
            )}

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
                    if (isMapPanelForceCollapsed !== collapsed) setIsMapPanelForceCollapsed(collapsed);
                  }}
                  onResize={(size, prevSize) => {
                    if (size > SIDE_PANEL_COLLAPSED_SIZE_PERCENT && !isMapPanelForceCollapsed) {
                      setLastOpenMapSize(size);
                    } else if (size > SIDE_PANEL_COLLAPSED_SIZE_PERCENT && isMapPanelForceCollapsed) {
                      setIsMapPanelForceCollapsed(false);
                      setLastOpenMapSize(size);
                    } else if (size === SIDE_PANEL_COLLAPSED_SIZE_PERCENT && !isMapPanelForceCollapsed && prevSize && prevSize > SIDE_PANEL_COLLAPSED_SIZE_PERCENT) {
                      setIsMapPanelForceCollapsed(true);
                    }
                  }}
                  style={{ backgroundColor: (theme) => theme.palette.background.default, display: 'flex', flexDirection: 'column', overflow: 'hidden', visibility: (isMapPanelForceCollapsed && lastOpenMapSize === SIDE_PANEL_COLLAPSED_SIZE_PERCENT) ? 'hidden' : 'visible' }}
                >
                  {!isMapPanelForceCollapsed && <PartyMapDisplay />}
                </Panel>

                {(!isMapPanelForceCollapsed && !isChatPanelForceCollapsed) && (
                  <PanelResizeHandle className="resize-handle-class" style={{ width: '8px', cursor: 'col-resize', borderLeft: (theme) => `1px solid ${theme.palette.divider}`, borderRight: (theme) => `1px solid ${theme.palette.divider}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}> <Box sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} /> <Box sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} /> <Box sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} /> </Box>
                  </PanelResizeHandle>
                )}
              </>
            )}

            <Panel
              id="chat-panel-v6"
              order={canShowMapPanel ? 3 : 2}
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
          <Container component="main" sx={{ flexGrow: 1, py: 3, px: { xs: 2, sm: 3 }, overflowY: 'auto', height: '100%' }}>
            <Outlet />
          </Container>
        )}
      </Box>
    </Box>
  );
}

export default Layout;
