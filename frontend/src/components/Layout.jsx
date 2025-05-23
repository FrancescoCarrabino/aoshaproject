// src/components/Layout.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Button, Container, Box, IconButton,
  Menu, MenuItem, Avatar, Tooltip, Divider, CssBaseline,
  useMediaQuery, // For responsive design
  Drawer,       // For Mobile Nav Drawer
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ChatIcon from '@mui/icons-material/ChatBubbleOutline';
import MapIcon from '@mui/icons-material/Map';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuIcon from '@mui/icons-material/Menu'; // Hamburger Icon

// Icons for Drawer Nav (replace with your preferred icons)
import DashboardIcon from '@mui/icons-material/Dashboard';
import BookIcon from '@mui/icons-material/MenuBook'; 
import EventNoteIcon from '@mui/icons-material/EventNote';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import PublicIconExplore from '@mui/icons-material/Explore'; // Renamed to avoid conflict with MapIcon
import SupervisorAccountIcon from '@mui/icons-material/Group';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useAuth } from '../context/AuthContext';
// import { useSocket } from '../context/SocketContext'; // activePartyMap not directly used in Layout display logic now
import ChatPanel from './chat/ChatPanel';
import PartyMapDisplay from './maps/PartyMapDisplay';

// --- Constants for Panel Sizes (Desktop) ---
const MAIN_CONTENT_DEFAULT_THREE_PANEL = 55; 
const MAP_PANEL_DEFAULT_THREE_PANEL = 25;    
const CHAT_PANEL_DEFAULT_THREE_PANEL = 20;   
const MAIN_CONTENT_MIN_PERCENT = 30; 
const SIDE_PANEL_MIN_PERCENT = 15;  
const SIDE_PANEL_COLLAPSED_SIZE_PERCENT = 0; 

function Layout() {
  const { user, logout } = useAuth();
  // const { activePartyMap } = useSocket(); 
  const location = useLocation();
  const navigate = useNavigate();
  const [anchorElUser, setAnchorElUser] = useState(null);
  const panelGroupRef = useRef(null);

  const theme = useTheme();
  // Using 'sm' breakpoint for mobile view. Adjust if 'md' was intended.
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); 

  // --- State for Desktop Panel Management ---
  const [isMapPanelForceCollapsed, setIsMapPanelForceCollapsed] = useState(() => localStorage.getItem('isMapPanelForceCollapsed_v1') === "true");
  const [lastOpenMapSize, setLastOpenMapSize] = useState(() => {
    const saved = localStorage.getItem('lastOpenMapSize_v1');
    const parsed = parseFloat(saved);
    return !isNaN(parsed) && parsed >= SIDE_PANEL_MIN_PERCENT ? parsed : MAP_PANEL_DEFAULT_THREE_PANEL;
  });
  const [isChatPanelForceCollapsed, setIsChatPanelForceCollapsed] = useState(() => localStorage.getItem('isChatPanelForceCollapsed_v2') === "true");
  const [lastOpenChatSize, setLastOpenChatSize] = useState(() => {
    const saved = localStorage.getItem('lastOpenChatSize_v2');
    const parsed = parseFloat(saved);
    return !isNaN(parsed) && parsed >= SIDE_PANEL_MIN_PERCENT ? parsed : CHAT_PANEL_DEFAULT_THREE_PANEL;
  });

  // State for mobile nav drawer
  const [mobileNavDrawerOpen, setMobileNavDrawerOpen] = useState(false);
  
  useEffect(() => { localStorage.setItem('isMapPanelForceCollapsed_v1', JSON.stringify(isMapPanelForceCollapsed)); }, [isMapPanelForceCollapsed]);
  useEffect(() => { localStorage.setItem('lastOpenMapSize_v1', lastOpenMapSize.toString()); }, [lastOpenMapSize]);
  useEffect(() => { localStorage.setItem('isChatPanelForceCollapsed_v2', JSON.stringify(isChatPanelForceCollapsed)); }, [isChatPanelForceCollapsed]);
  useEffect(() => { localStorage.setItem('lastOpenChatSize_v2', lastOpenChatSize.toString()); }, [lastOpenChatSize]);

  const showSidePanelsDesktop = user && location.pathname !== '/login' && !isMobile;

  const applyDesktopLayout = useCallback(() => {
    if (panelGroupRef.current && showSidePanelsDesktop) {
      const mapSize = isMapPanelForceCollapsed ? SIDE_PANEL_COLLAPSED_SIZE_PERCENT : Math.max(SIDE_PANEL_MIN_PERCENT, lastOpenMapSize);
      const chatSize = isChatPanelForceCollapsed ? SIDE_PANEL_COLLAPSED_SIZE_PERCENT : Math.max(SIDE_PANEL_MIN_PERCENT, lastOpenChatSize);
      let mainSize = 100 - mapSize - chatSize;
      
      if (mainSize < MAIN_CONTENT_MIN_PERCENT) {
        mainSize = MAIN_CONTENT_MIN_PERCENT;
      }
      // Ensure layout array sums to 100 or RPP might behave unexpectedly
      const totalAllocated = mainSize + mapSize + chatSize;
      if (totalAllocated > 100) {
        const overflow = totalAllocated - 100;
        // Prioritize reducing mainSize if it's above min, then other panels proportionally
        if (mainSize - overflow >= MAIN_CONTENT_MIN_PERCENT) {
            mainSize -= overflow;
        } else {
            // More complex proportional reduction needed if mainSize hits min
            // For now, this is a basic adjustment. RPP usually handles over-allocation gracefully.
        }
      } else if (totalAllocated < 100 && mainSize < (100 - mapSize - chatSize) ) {
        mainSize = 100 - mapSize - chatSize; // Ensure main takes remaining space
      }


      panelGroupRef.current.setLayout([mainSize, mapSize, chatSize]);
    } else if (panelGroupRef.current && !showSidePanelsDesktop && !isMobile) {
      panelGroupRef.current.setLayout([100]);
    }
  }, [showSidePanelsDesktop, isMapPanelForceCollapsed, isChatPanelForceCollapsed, lastOpenMapSize, lastOpenChatSize, isMobile]); // Added isMobile

  useEffect(() => {
    if (!isMobile) {
      applyDesktopLayout();
    }
  }, [isMobile, applyDesktopLayout]);

  const toggleMapPanelCollapse = () => setIsMapPanelForceCollapsed(prev => !prev);
  const toggleChatPanelCollapse = () => setIsChatPanelForceCollapsed(prev => !prev);
  const toggleMobileNavDrawer = (open) => (event) => {
    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setMobileNavDrawerOpen(open);
  };

  const handleOpenUserMenu = (event) => setAnchorElUser(event.currentTarget);
  const handleCloseUserMenu = () => setAnchorElUser(null);
  const handleLogout = () => { handleCloseUserMenu(); logout(); };
  const handleProfile = () => { handleCloseUserMenu(); navigate('/profile'); /* TODO: Create profile page */ };

  const mainNavLinks = [
    { path: "/dashboard", text: "Dashboard", requiresAuth: true, dmOnly: false, icon: <DashboardIcon /> },
    { path: "/story", text: "Story", requiresAuth: true, dmOnly: false, icon: <BookIcon /> },
    { path: "/sessions", text: "Sessions", requiresAuth: true, dmOnly: false, icon: <EventNoteIcon /> },
    { path: "/npcs", text: "NPCs", requiresAuth: true, dmOnly: false, icon: <SupervisorAccountIcon /> },
    { path: "/asset-library", text: "Asset Library", requiresAuth: true, dmOnly: false, icon: <PhotoLibraryIcon /> },
    { path: "/gazetteer", text: "Gazetteer", requiresAuth: true, dmOnly: false, icon: <PublicIconExplore /> },
    { path: "/maps-management", text: "Manage Maps", requiresAuth: true, dmOnly: true, icon: <MapOutlinedIcon /> },
  ];

  const drawerNavList = (
    <Box
      sx={{ width: 250 }}
      role="presentation"
      onClick={toggleMobileNavDrawer(false)}
      onKeyDown={toggleMobileNavDrawer(false)}
    >
      <List>
        {mainNavLinks.map((link) => {
          if (link.dmOnly && user?.role !== 'DM') return null;
          return (
            <ListItem key={link.text} disablePadding>
              <ListItemButton component={RouterLink} to={link.path}>
                <ListItemIcon>{link.icon || <DashboardIcon />}</ListItemIcon> {/* Fallback icon */}
                <ListItemText primary={link.text} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            {/* Hamburger Menu for Mobile */}
            {isMobile && user && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={toggleMobileNavDrawer(true)}
                sx={{ mr: 1 }}
              >
                <MenuIcon />
              </IconButton>
            )}

            {/* App Title/Brand */}
            <Typography 
              variant={isMobile ? "h6" : "h5"} 
              noWrap 
              component={RouterLink} 
              to={user ? "/dashboard" : "/"} 
              sx={{ 
                mr: 2, 
                fontFamily: '"Cinzel Decorative", "Cinzel", serif', 
                fontWeight: 700, 
                color: 'inherit', 
                textDecoration: 'none',
                flexGrow: (isMobile && user) ? 1 : 0, // Title takes space on mobile if drawer icon is there
                display: 'flex' // Always display title
              }}
            >
              AOSHA
            </Typography>
            
            {/* Desktop Navigation Links */}
            {!isMobile && user && (
              <Box sx={{ flexGrow: 1, display: 'flex' }}>
                {mainNavLinks.map((link) => (link.dmOnly && user.role !== 'DM') ? null : (
                  <Button key={link.text} color="inherit" component={RouterLink} to={link.path} sx={{ my: 2, color: 'white', display: 'block' }}>
                    {link.text}
                  </Button>
                ))}
              </Box>
            )}
            {/* Spacer if no user on desktop, or if mobile without user */}
            {(!user && !isMobile) && <Box sx={{ flexGrow: 1 }} />}


            {/* Panel Toggle Buttons - Desktop Only for this version */}
            {showSidePanelsDesktop && (
              <>
                <Tooltip title={isMapPanelForceCollapsed ? "Show Map Panel" : "Hide Map Panel"}>
                  <IconButton color="inherit" onClick={toggleMapPanelCollapse} sx={{ ml: 1 }}>
                    {isMapPanelForceCollapsed ? <MapIcon /> : <ChevronLeftIcon /> }
                  </IconButton>
                </Tooltip>
                <Tooltip title={isChatPanelForceCollapsed ? "Show Chat Panel" : "Hide Chat Panel"}>
                  <IconButton color="inherit" onClick={toggleChatPanelCollapse} sx={{ ml: 0.5 }}>
                    {isChatPanelForceCollapsed ? <ChatIcon /> : <ChevronRightIcon /> }
                  </IconButton>
                </Tooltip>
              </>
            )}

            {/* User Menu */}
            {user ? ( 
              <Box sx={{ flexGrow: 0, ml: (showSidePanelsDesktop || isMobile) ? 0.5 : 1 }}> {/* Adjust margin */}
                <Tooltip title="Open settings"> 
                  <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}> 
                    <Avatar alt={user.username?.toUpperCase()} sx={{ bgcolor: 'secondary.main' }}>
                      {user.username ? user.username[0].toUpperCase() : <AccountCircleIcon />}
                    </Avatar> 
                  </IconButton> 
                </Tooltip> 
                <Menu sx={{ mt: '45px' }} id="menu-appbar-user" anchorEl={anchorElUser} anchorOrigin={{ vertical: 'top', horizontal: 'right' }} keepMounted transformOrigin={{ vertical: 'top', horizontal: 'right' }} open={Boolean(anchorElUser)} onClose={handleCloseUserMenu}> 
                  <MenuItem disabled><Typography textAlign="center" variant="subtitle2">{user.username} ({user.role})</Typography></MenuItem> <Divider /> 
                  <MenuItem onClick={() => {handleCloseUserMenu(); navigate('/profile'); /* TODO: Profile page alert("Profile Placeholder")*/ }}><Typography textAlign="center">Profile</Typography></MenuItem> 
                  <MenuItem onClick={handleLogout}><Typography textAlign="center" color="error.main">Logout</Typography></MenuItem> 
                </Menu> 
              </Box>
            ) : (
              (location.pathname !== '/login' && location.pathname !== '/') && 
              <Button color="inherit" component={RouterLink} to="/login">Login</Button>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Navigation Drawer */}
      {user && ( // Drawer is part of the layout only if user is logged in
        <Drawer
          anchor="left"
          open={mobileNavDrawerOpen && isMobile} // Only open if isMobile is true
          onClose={toggleMobileNavDrawer(false)}
        >
          {drawerNavList}
        </Drawer>
      )}

      {/* Main Content Area with Resizable Panels (Desktop) or Simple Container (Mobile) */}
      <Box sx={{ display: 'flex', flexGrow: 1, mt: '64px', height: 'calc(100vh - 64px)' }}>
        {showSidePanelsDesktop ? ( // This implies !isMobile is also true
          <PanelGroup 
            direction="horizontal" 
            style={{ width: '100%', height: '100%' }} 
            id="aoshaproject-main-layout-desktop-v8" // Incremented version
            ref={panelGroupRef} 
          >
            <Panel id="main-content-desktop" order={1} minSize={MAIN_CONTENT_MIN_PERCENT} defaultSize={MAIN_CONTENT_DEFAULT_THREE_PANEL}>
              <Container maxWidth={false} sx={{ height: '100%', overflowY: 'auto', py: 3, px: { xs: 1, sm: 2, md: 3 }, boxSizing: 'border-box' }}>
                <Outlet />
              </Container>
            </Panel>
            <PanelResizeHandle className="resize-handle-class" style={{ width: '8px', cursor: 'col-resize', backgroundColor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.300', display:'flex', alignItems:'center', justifyContent:'center', borderLeft: `1px solid ${theme.palette.divider}`, borderRight: `1px solid ${theme.palette.divider}`}}><Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>{Array(3).fill(0).map((_,i)=><Box key={`phd1-${i}`} sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} />)}</Box></PanelResizeHandle>
            
            <Panel id="party-map-desktop" order={2} collapsible={true} collapsedSize={SIDE_PANEL_COLLAPSED_SIZE_PERCENT} minSize={SIDE_PANEL_MIN_PERCENT} defaultSize={isMapPanelForceCollapsed ? SIDE_PANEL_COLLAPSED_SIZE_PERCENT : lastOpenMapSize} 
              onCollapse={(collapsed) => {if(isMapPanelForceCollapsed !== collapsed) setIsMapPanelForceCollapsed(collapsed);}} 
              onResize={(size) => { if (size > SIDE_PANEL_COLLAPSED_SIZE_PERCENT){ setLastOpenMapSize(size); if(isMapPanelForceCollapsed) setIsMapPanelForceCollapsed(false); } else if (size === SIDE_PANEL_COLLAPSED_SIZE_PERCENT && !isMapPanelForceCollapsed) { setIsMapPanelForceCollapsed(true); } }} 
              style={{ display: isMapPanelForceCollapsed ? 'none': 'flex', flexDirection: 'column', overflow:'hidden' }}
            >
              {!isMapPanelForceCollapsed && <PartyMapDisplay />}
            </Panel>
            
            {(!isMapPanelForceCollapsed && !isChatPanelForceCollapsed) && ( 
                <PanelResizeHandle className="resize-handle-class" style={{ width: '8px', cursor: 'col-resize', backgroundColor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.300', display:'flex', alignItems:'center', justifyContent:'center', borderLeft: `1px solid ${theme.palette.divider}`, borderRight: `1px solid ${theme.palette.divider}`}}><Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>{Array(3).fill(0).map((_,i)=><Box key={`phd2-${i}`} sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} />)}</Box></PanelResizeHandle> 
            )}
            
            <Panel id="chat-panel-desktop" order={3} collapsible={true} collapsedSize={SIDE_PANEL_COLLAPSED_SIZE_PERCENT} minSize={SIDE_PANEL_MIN_PERCENT} defaultSize={isChatPanelForceCollapsed ? SIDE_PANEL_COLLAPSED_SIZE_PERCENT : lastOpenChatSize} 
              onCollapse={(collapsed) => {if(isChatPanelForceCollapsed !== collapsed) setIsChatPanelForceCollapsed(collapsed);}} 
              onResize={(size) => { if (s > SIDE_PANEL_COLLAPSED_SIZE_PERCENT){ setLastOpenChatSize(size); if(isChatPanelForceCollapsed) setIsChatPanelForceCollapsed(false); } else if (size === SIDE_PANEL_COLLAPSED_SIZE_PERCENT && !isChatPanelForceCollapsed) { setIsChatPanelForceCollapsed(true); } }} 
              style={{ display: isChatPanelForceCollapsed ? 'none': 'flex', flexDirection: 'column', overflow:'hidden', backgroundColor: theme.palette.background.paper }}
            >
              {!isChatPanelForceCollapsed && <ChatPanel />}
            </Panel>
          </PanelGroup>
        ) : (
          // Mobile or no side panels needed (e.g., login) - Simple Outlet Container
          <Container component="main" sx={{ flexGrow: 1, py: 3, px: { xs: 1, sm: 2, md: 3 }, overflowY: 'auto', height: '100%' }}>
            <Outlet />
          </Container>
        )}
      </Box>

      {/* 
        Mobile Full-Screen Dialogs for Map and Chat are REMOVED in this version 
        to go back to the simpler desktop panel layout + mobile nav drawer.
        The map/chat toggle buttons in AppBar will only affect desktop panels.
        For mobile, map/chat would be accessed via main navigation if they have dedicated pages,
        or this layout doesn't provide a direct toggle for them on mobile beyond main nav.
      */}
    </Box>
  );
}

export default Layout;
