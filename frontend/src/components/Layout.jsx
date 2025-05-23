// src/components/Layout.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Button, Container, Box, IconButton,
  Menu, MenuItem, Avatar, Tooltip, Divider, CssBaseline,
  useMediaQuery,
  Dialog,
  Slide,
  Drawer, // For Mobile Nav Drawer
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ChatIcon from '@mui/icons-material/ChatBubbleOutline';
import MapIcon from '@mui/icons-material/Map';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu'; // Hamburger Icon

// Icons for Drawer Nav (replace with your preferred icons)
import DashboardIcon from '@mui/icons-material/Dashboard';
import BookIcon from '@mui/icons-material/MenuBook'; // For Story/Lore
import EventNoteIcon from '@mui/icons-material/EventNote'; // For Sessions
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary'; // For Asset Library
import PublicIcon from '@mui/icons-material/Explore'; // For Gazetteer or general world info
import SupervisorAccountIcon from '@mui/icons-material/Group'; // For NPCs
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'; // For Manage Maps (DM)

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import ChatPanel from './chat/ChatPanel';
import PartyMapDisplay from './maps/PartyMapDisplay';

const MAIN_CONTENT_DEFAULT_THREE_PANEL = 55;
const MAP_PANEL_DEFAULT_THREE_PANEL = 25;
const CHAT_PANEL_DEFAULT_THREE_PANEL = 20;
const MAIN_CONTENT_MIN_PERCENT = 30;
const SIDE_PANEL_MIN_PERCENT = 15;
const SIDE_PANEL_COLLAPSED_SIZE_PERCENT = 0;

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate(); // For Drawer navigation
  const [anchorElUser, setAnchorElUser] = useState(null);
  const panelGroupRef = useRef(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [isMapPanelForceCollapsed, setIsMapPanelForceCollapsed] = useState(() => localStorage.getItem('isMapPanelForceCollapsed_v1') === "true");
  const [lastOpenMapSize, setLastOpenMapSize] = useState(() => parseFloat(localStorage.getItem('lastOpenMapSize_v1')) || MAP_PANEL_DEFAULT_THREE_PANEL);
  const [isChatPanelForceCollapsed, setIsChatPanelForceCollapsed] = useState(() => localStorage.getItem('isChatPanelForceCollapsed_v2') === "true");
  const [lastOpenChatSize, setLastOpenChatSize] = useState(() => parseFloat(localStorage.getItem('lastOpenChatSize_v2')) || CHAT_PANEL_DEFAULT_THREE_PANEL);

  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [mobileNavDrawerOpen, setMobileNavDrawerOpen] = useState(false); // State for mobile nav drawer
  
  useEffect(() => { if (!isMobile) localStorage.setItem('isMapPanelForceCollapsed_v1', JSON.stringify(isMapPanelForceCollapsed)); }, [isMapPanelForceCollapsed, isMobile]);
  useEffect(() => { if (!isMobile) localStorage.setItem('lastOpenMapSize_v1', lastOpenMapSize.toString()); }, [lastOpenMapSize, isMobile]);
  useEffect(() => { if (!isMobile) localStorage.setItem('isChatPanelForceCollapsed_v2', JSON.stringify(isChatPanelForceCollapsed)); }, [isChatPanelForceCollapsed, isMobile]);
  useEffect(() => { if (!isMobile) localStorage.setItem('lastOpenChatSize_v2', lastOpenChatSize.toString()); }, [lastOpenChatSize, isMobile]);

  const showSideFeatures = user && location.pathname !== '/login';

  const applyDesktopLayout = useCallback(() => {
    if (panelGroupRef.current && showSideFeatures && !isMobile) {
      const mapSize = isMapPanelForceCollapsed ? SIDE_PANEL_COLLAPSED_SIZE_PERCENT : Math.max(SIDE_PANEL_MIN_PERCENT, lastOpenMapSize);
      const chatSize = isChatPanelForceCollapsed ? SIDE_PANEL_COLLAPSED_SIZE_PERCENT : Math.max(SIDE_PANEL_MIN_PERCENT, lastOpenChatSize);
      let mainSize = 100 - mapSize - chatSize;
      
      // Basic clamping for mainSize
      if (mainSize < MAIN_CONTENT_MIN_PERCENT) {
        mainSize = MAIN_CONTENT_MIN_PERCENT;
        // If mainSize was clamped, we might need to adjust side panels, but RPP's minSize should help
      }
      if (mainSize > (100 - SIDE_PANEL_MIN_PERCENT*2) && (!isMapPanelForceCollapsed || !isChatPanelForceCollapsed)) {
        // This case is complex: if main is too big and side panels are open, RPP might auto-adjust.
        // It's usually fine to let RPP handle this with its own constraints.
      }
      panelGroupRef.current.setLayout([mainSize, mapSize, chatSize]);
    } else if (panelGroupRef.current && !showSideFeatures && !isMobile) {
      panelGroupRef.current.setLayout([100]);
    }
  }, [isMobile, showSideFeatures, isMapPanelForceCollapsed, isChatPanelForceCollapsed, lastOpenMapSize, lastOpenChatSize]);

  useEffect(() => {
    if (!isMobile) {
      applyDesktopLayout();
    }
  }, [isMobile, applyDesktopLayout]);

  const toggleMapPanel = () => {
    if (isMobile) setMobileMapOpen(prev => !prev);
    else setIsMapPanelForceCollapsed(prev => !prev);
  };
  const toggleChatPanel = () => {
    if (isMobile) setMobileChatOpen(prev => !prev);
    else setIsChatPanelForceCollapsed(prev => !prev);
  };
  const toggleMobileNavDrawer = (open) => (event) => {
    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setMobileNavDrawerOpen(open);
  };

  const handleOpenUserMenu = (event) => setAnchorElUser(event.currentTarget);
  const handleCloseUserMenu = () => setAnchorElUser(null);
  const handleLogout = () => { handleCloseUserMenu(); logout(); };
  const handleProfile = () => { handleCloseUserMenu(); alert("Profile page placeholder"); };

  const mainNavLinks = [
    { path: "/dashboard", text: "Dashboard", requiresAuth: true, dmOnly: false, icon: <DashboardIcon /> },
    { path: "/story", text: "Story", requiresAuth: true, dmOnly: false, icon: <BookIcon /> },
    { path: "/sessions", text: "Sessions", requiresAuth: true, dmOnly: false, icon: <EventNoteIcon /> },
    { path: "/npcs", text: "NPCs", requiresAuth: true, dmOnly: false, icon: <SupervisorAccountIcon /> }, // Now visible to players
    { path: "/asset-library", text: "Asset Library", requiresAuth: true, dmOnly: false, icon: <PhotoLibraryIcon /> },
    { path: "/gazetteer", text: "Gazetteer", requiresAuth: true, dmOnly: false, icon: <PublicIcon /> },
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
                <ListItemIcon>{link.icon || <DashboardIcon />}</ListItemIcon>
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
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + (isMobile ? 0 : 1) }}> {/* Lower zIndex for mobile drawer */}
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            {isMobile && user && (
              <IconButton color="inherit" aria-label="open drawer" edge="start" onClick={toggleMobileNavDrawer(true)} sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant={isMobile ? "h6" : "h5"} noWrap component={RouterLink} to={user ? "/dashboard" : "/"} sx={{ mr: 2, fontFamily: '"Cinzel Decorative", "Cinzel", serif', fontWeight: 700, color: 'inherit', textDecoration: 'none', flexGrow: isMobile && user ? 1 : 0, display: (isMobile && !user) ? 'none' : 'flex' }}>
              AOSHA
            </Typography>
            
            {!isMobile && user && (
              <Box sx={{ flexGrow: 1, display: 'flex' }}>
                {mainNavLinks.map((link) => (link.dmOnly && user.role !== 'DM') ? null : (
                  <Button key={link.text} color="inherit" component={RouterLink} to={link.path} sx={{ my: 2, color: 'white', display: 'block' }}>{link.text}</Button>
                ))}
              </Box>
            )}
            {(!user && !isMobile) && <Box sx={{ flexGrow: 1 }} />} {/* Spacer for desktop when no user */}


            <Box sx={{ flexGrow: user && !isMobile ? 0 : (isMobile && user ? 0 : 1) }} /> {/* More nuanced spacer */}
            {showSideFeatures && (
              <>
                <Tooltip title={isMobile ? "Open Map" : (isMapPanelForceCollapsed ? "Show Map Panel" : "Hide Map Panel")}>
                  <IconButton color="inherit" onClick={toggleMapPanel} sx={{ ml: 1 }}>
                    <MapIcon /> 
                    {!isMobile && !isMapPanelForceCollapsed && <ChevronLeftIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={isMobile ? "Open Chat" : (isChatPanelForceCollapsed ? "Show Chat Panel" : "Hide Chat Panel")}>
                  <IconButton color="inherit" onClick={toggleChatPanel} sx={{ ml: 0.5 }}>
                    <ChatIcon />
                    {!isMobile && !isChatPanelForceCollapsed && <ChevronRightIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </>
            )}

            {user ? ( <Box sx={{ flexGrow: 0, ml: showSideFeatures ? 0.5 : 1 }}> <Tooltip title="Open settings"> <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}> <Avatar alt={user.username?.toUpperCase()} sx={{ bgcolor: 'secondary.main' }}>{user.username ? user.username[0].toUpperCase() : <AccountCircleIcon />}</Avatar> </IconButton> </Tooltip> <Menu sx={{ mt: '45px' }} id="menu-appbar-user" anchorEl={anchorElUser} anchorOrigin={{ vertical: 'top', horizontal: 'right' }} keepMounted transformOrigin={{ vertical: 'top', horizontal: 'right' }} open={Boolean(anchorElUser)} onClose={handleCloseUserMenu}> <MenuItem disabled><Typography textAlign="center" variant="subtitle2">{user.username} ({user.role})</Typography></MenuItem> <Divider /> <MenuItem onClick={() => {handleCloseUserMenu(); navigate('/profile'); /* TODO: Create profile page */ alert("Profile page placeholder");}}><Typography textAlign="center">Profile</Typography></MenuItem> <MenuItem onClick={handleLogout}><Typography textAlign="center" color="error.main">Logout</Typography></MenuItem> </Menu> </Box>
            ) : ((location.pathname !== '/login' && location.pathname !== '/') && <Button color="inherit" component={RouterLink} to="/login">Login</Button>)}
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Navigation Drawer */}
      {user && isMobile && (
        <Drawer anchor="left" open={mobileNavDrawerOpen} onClose={toggleMobileNavDrawer(false)}>
          {drawerNavList}
        </Drawer>
      )}

      <Box sx={{ display: 'flex', flexGrow: 1, mt: '64px', height: 'calc(100vh - 64px)' }}>
        {showSideFeatures && !isMobile ? (
          <PanelGroup direction="horizontal" style={{ width: '100%', height: '100%' }} id="aoshaproject-main-layout-desktop-v7" ref={panelGroupRef} >
            <Panel id="main-content-desktop" order={1} minSize={MAIN_CONTENT_MIN_PERCENT} defaultSize={lastOpenMapSize + lastOpenChatSize + MAIN_CONTENT_MIN_PERCENT > 100 ? 100 - (isMapPanelForceCollapsed ? 0 : lastOpenMapSize) - (isChatPanelForceCollapsed ? 0 : lastOpenChatSize) : MAIN_CONTENT_DEFAULT_THREE_PANEL}>
              <Container maxWidth={false} sx={{ height: '100%', overflowY: 'auto', py: 3, px: { xs: 1, sm: 2, md: 3 }, boxSizing: 'border-box' }}>
                <Outlet />
              </Container>
            </Panel>
            <PanelResizeHandle className="resize-handle-class" style={{ width: '8px', cursor: 'col-resize', backgroundColor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.300', display:'flex', alignItems:'center', justifyContent:'center', borderLeft: `1px solid ${theme.palette.divider}`, borderRight: `1px solid ${theme.palette.divider}`}}><Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>{Array(3).fill(0).map((_,i)=><Box key={`phd1-${i}`} sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} />)}</Box></PanelResizeHandle>
            <Panel id="party-map-desktop" order={2} collapsible={true} collapsedSize={SIDE_PANEL_COLLAPSED_SIZE_PERCENT} minSize={SIDE_PANEL_MIN_PERCENT} defaultSize={isMapPanelForceCollapsed ? SIDE_PANEL_COLLAPSED_SIZE_PERCENT : lastOpenMapSize} onCollapse={(c) => {if(isMapPanelForceCollapsed !==c) setIsMapPanelForceCollapsed(c)}} onResize={(s) => { if (s > SIDE_PANEL_COLLAPSED_SIZE_PERCENT){ setLastOpenMapSize(s); if(isMapPanelForceCollapsed) setIsMapPanelForceCollapsed(false); } else if (s === SIDE_PANEL_COLLAPSED_SIZE_PERCENT && !isMapPanelForceCollapsed) { setIsMapPanelForceCollapsed(true); } }} style={{ display: isMapPanelForceCollapsed ? 'none': 'flex', flexDirection: 'column', overflow:'hidden' }}>
              {!isMapPanelForceCollapsed && <PartyMapDisplay />}
            </Panel>
            {!isMapPanelForceCollapsed && !isChatPanelForceCollapsed && ( <PanelResizeHandle className="resize-handle-class" style={{ width: '8px', cursor: 'col-resize', backgroundColor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.300', display:'flex', alignItems:'center', justifyContent:'center', borderLeft: `1px solid ${theme.palette.divider}`, borderRight: `1px solid ${theme.palette.divider}`}}><Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>{Array(3).fill(0).map((_,i)=><Box key={`phd2-${i}`} sx={{ width: '3px', height: '3px', backgroundColor: 'text.disabled', borderRadius: '50%' }} />)}</Box></PanelResizeHandle> )}
            <Panel id="chat-panel-desktop" order={3} collapsible={true} collapsedSize={SIDE_PANEL_COLLAPSED_SIZE_PERCENT} minSize={SIDE_PANEL_MIN_PERCENT} defaultSize={isChatPanelForceCollapsed ? SIDE_PANEL_COLLAPSED_SIZE_PERCENT : lastOpenChatSize} onCollapse={(c) => {if(isChatPanelForceCollapsed !==c) setIsChatPanelForceCollapsed(c)}} onResize={(s) => { if (s > SIDE_PANEL_COLLAPSED_SIZE_PERCENT){ setLastOpenChatSize(s); if(isChatPanelForceCollapsed) setIsChatPanelForceCollapsed(false); } else if (s === SIDE_PANEL_COLLAPSED_SIZE_PERCENT && !isChatPanelForceCollapsed) { setIsChatPanelForceCollapsed(true); } }} style={{ display: isChatPanelForceCollapsed ? 'none': 'flex', flexDirection: 'column', overflow:'hidden', backgroundColor: theme.palette.background.paper }}>
              {!isChatPanelForceCollapsed && <ChatPanel />}
            </Panel>
          </PanelGroup>
        ) : (
          <Container component="main" sx={{ flexGrow: 1, py: 3, px: { xs: 1, sm: 2, md: 3 }, overflowY: 'auto', height: '100%' }}>
            <Outlet />
          </Container>
        )}
      </Box>

      {isMobile && showSideFeatures && (
        <Dialog fullScreen open={mobileMapOpen} onClose={() => setMobileMapOpen(false)} TransitionComponent={Transition}>
          <AppBar sx={{ position: 'relative' }}><Toolbar><IconButton edge="start" color="inherit" onClick={() => setMobileMapOpen(false)} aria-label="close map"><CloseIcon /></IconButton><Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">Party Map</Typography></Toolbar></AppBar>
          <Box sx={{flexGrow: 1, overflow: 'hidden', display:'flex'}}><PartyMapDisplay /></Box>
        </Dialog>
      )}
      {isMobile && showSideFeatures && (
        <Dialog fullScreen open={mobileChatOpen} onClose={() => setMobileChatOpen(false)} TransitionComponent={Transition}>
          <AppBar sx={{ position: 'relative' }}><Toolbar><IconButton edge="start" color="inherit" onClick={() => setMobileChatOpen(false)} aria-label="close chat"><CloseIcon /></IconButton><Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">Party Chat</Typography></Toolbar></AppBar>
          <Box sx={{display: 'flex', flexDirection: 'column', height: '100%', pt: {xs: '56px', sm: '64px'} /* AppBar height inside Dialog */, boxSizing:'border-box' }}><ChatPanel /></Box>
        </Dialog>
      )}
    </Box>
  );
}

export default Layout;
