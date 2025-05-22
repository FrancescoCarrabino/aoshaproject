import React, { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Container, Typography, Button, Box, CircularProgress, Alert,
  List, ListItem, ListItemText, ListItemAvatar, Avatar, IconButton, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControlLabel, Checkbox, Select, MenuItem, InputLabel, FormControl, Grid
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ImageIcon from '@mui/icons-material/Image';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
// import VisibilityIcon from '@mui/icons-material/Visibility'; // For "View" or "Open Editor" later

import * as apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext';
// We'll need TagInput later if adding tags during creation/edit
// import TagInput from '../components/forms/TagInput';

const MapsManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [maps, setMaps] = useState([]);
  const [assets, setAssets] = useState([]); // For selecting map image
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newMapData, setNewMapData] = useState({
    name: '',
    map_asset_id: '',
    grid_enabled: false,
    grid_size_pixels: 50,
    // tags: [] // For TagInput later
  });

  // Fetch maps and assets (for the dropdown)
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [mapsResponse, assetsResponse] = await Promise.all([
        apiService.getGameMaps(), // Fetches DM's maps
        apiService.getAssets([], { params: { visibility: 'party_wide,dm_only', type: 'image' } }) // Assuming getAssets can filter by type & DM access
      ]);
      setMaps(mapsResponse || []);
      // Filter assets to only include image types if not done by API
      setAssets(assetsResponse.filter(asset => asset.mimetype && asset.mimetype.startsWith('image/')) || []);
    } catch (err) {
      console.error("Failed to fetch maps or assets:", err);
      setError(err.message || 'Failed to fetch data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'DM') {
      fetchData();
    } else {
      setIsLoading(false);
      setError("You are not authorized to manage maps.");
    }
  }, [fetchData, user]);

  const handleCreateDialogOpen = () => {
    setNewMapData({ name: '', map_asset_id: '', grid_enabled: false, grid_size_pixels: 50 });
    setOpenCreateDialog(true);
  };
  const handleCreateDialogClose = () => setOpenCreateDialog(false);

  const handleNewMapChange = (event) => {
    const { name, value, type, checked } = event.target;
    setNewMapData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCreateMap = async () => {
    if (!newMapData.name || !newMapData.map_asset_id) {
      alert('Map Name and Map Image Asset are required.');
      return;
    }
    setError(null);
    try {
      const createdMap = await apiService.createGameMap({
        ...newMapData,
        grid_size_pixels: newMapData.grid_enabled ? parseInt(newMapData.grid_size_pixels, 10) : null,
      });
      // setMaps(prev => [...prev, createdMap]); // The response from createGameMap should be the full map object
      fetchData(); // Refetch to get the latest list with proper asset URLs etc.
      handleCreateDialogClose();
    } catch (err) {
      console.error("Failed to create map:", err);
      setError(err.message || 'Failed to create map.');
      // Keep dialog open on error if desired, or close it
    }
  };

  const handleDeleteMap = async (mapId) => {
    if (window.confirm('Are you sure you want to delete this map? This cannot be undone.')) {
      setError(null);
      try {
        await apiService.deleteGameMap(mapId);
        setMaps(prev => prev.filter(map => map.id !== mapId));
      } catch (err) {
        console.error("Failed to delete map:", err);
        setError(err.message || 'Failed to delete map.');
      }
    }
  };

  // Placeholder for edit functionality
  const handleEditMap = (map) => {
    // navigate(`/maps/${map.id}/edit-details`); // Or open a similar dialog to 'create'
    alert(`Edit functionality for map "${map.name}" (ID: ${map.id}) is not yet implemented.`);
  };

  // Placeholder for navigating to a detail/editor view
  const handleViewMap = (mapId) => {
    navigate(`/maps/${mapId}/editor`); // This will be our interactive editor page later
  };


  if (isLoading) {
    return <Container sx={{ py: 3 }}><Box display="flex" justifyContent="center"><CircularProgress /></Box></Container>;
  }

  if (error && !openCreateDialog) { // Don't show main page error if dialog has its own error context
    return <Container sx={{ py: 3 }}><Alert severity="error">{error}</Alert></Container>;
  }

  if (user?.role !== 'DM') {
    return <Container sx={{ py: 3 }}><Alert severity="warning">You are not authorized to manage maps.</Alert></Container>;
  }

  return (
    <Container sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">Manage Maps</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateDialogOpen}
        >
          New Map
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {maps.length === 0 ? (
        <Typography>No maps created yet. Click "New Map" to get started.</Typography>
      ) : (
        <Paper elevation={2}>
          <List>
            {maps.map((map) => (
              <ListItem
                key={map.id}
                secondaryAction={
                  <>
                    <IconButton edge="end" aria-label="edit" onClick={() => handleEditMap(map)} sx={{ mr: 1 }}>
                      <EditIcon />
                    </IconButton>
                    <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteMap(map.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </>
                }
              >
                <ListItemAvatar>
                  <Avatar variant="rounded" src={map.mapAssetUrl || undefined} sx={{ bgcolor: 'primary.light' }}>
                    {!map.mapAssetUrl && <ImageIcon />}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={map.name}
                  secondary={`Grid: ${map.grid_enabled ? `Enabled (${map.grid_size_pixels}px)` : 'Disabled'} | Tags: ${map.tags.map(t => t.name).join(', ') || 'None'}`}
                  onClick={() => handleViewMap(map.id)} // Navigate to editor/viewer
                  sx={{ cursor: 'pointer' }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Create Map Dialog */}
      <Dialog open={openCreateDialog} onClose={handleCreateDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Map</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="Map Name"
            type="text"
            fullWidth
            variant="outlined"
            value={newMapData.name}
            onChange={handleNewMapChange}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
            <InputLabel id="map-asset-select-label">Map Image Asset</InputLabel>
            <Select
              labelId="map-asset-select-label"
              name="map_asset_id"
              value={newMapData.map_asset_id}
              label="Map Image Asset"
              onChange={handleNewMapChange}
            >
              {assets.length === 0 && <MenuItem value="" disabled>No image assets found</MenuItem>}
              {assets.map(asset => (
                <MenuItem key={asset.id} value={asset.id}>
                  {asset.filename_original} (ID: {asset.id})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Checkbox
                checked={newMapData.grid_enabled}
                onChange={handleNewMapChange}
                name="grid_enabled"
              />
            }
            label="Enable Grid"
            sx={{ mb: 1, display: 'block' }}
          />
          {newMapData.grid_enabled && (
            <TextField
              margin="dense"
              name="grid_size_pixels"
              label="Grid Size (pixels per square)"
              type="number"
              fullWidth
              variant="outlined"
              value={newMapData.grid_size_pixels}
              onChange={handleNewMapChange}
              sx={{ mb: 2 }}
            />
          )}
          {/* Add TagInput here later */}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreateDialogClose}>Cancel</Button>
          <Button onClick={handleCreateMap} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MapsManagementPage;
