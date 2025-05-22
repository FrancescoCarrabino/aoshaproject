// src/pages/GazetteerPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Typography, Button, Grid, CircularProgress, Paper, Box, Fab,
  Dialog, DialogActions, DialogContent, DialogTitle, TextField as MuiTextField,
  Checkbox, FormControlLabel, Select, MenuItem, InputLabel, FormControl,
  IconButton, Tooltip, Chip, Card, CardContent, CardActions, CardMedia, Alert,
  Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { useAuth } from '../context/AuthContext';
import * as apiService from '../services/apiService';
import TagInput from '../components/ui/TagInput';
import RichTextEditor from '../components/ui/RichTextEditor'; // Assuming you have this

// API_BASE_URL_FOR_IMAGES might be needed if map_asset_details.url is relative
// and you don't have a Vite proxy for /uploads.
// If npc.image_url is already a full relative path like /uploads/assets/file.png,
// and Vite proxy is set for /uploads, this might not be strictly needed for display here.
// For consistency with NPCs, let's assume it's used if not an absolute URL.
const API_BASE_URL_FOR_IMAGES = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace('/api', '');


const LocationCard = ({ location, onEdit, onDelete, isDM }) => {
  // Backend's GET /api/locations should ideally join with assets table and provide asset.filepath as map_asset_url_path
  // For example: location.map_asset_details = { url: '/uploads/assets/map_image.jpg' }
  const rawMapImageUrl = location.map_asset_details?.url || location.map_asset_url_path; // Adapt to what backend sends

  const mapImageUrl = rawMapImageUrl ?
    (rawMapImageUrl.startsWith('http') ? rawMapImageUrl : `${API_BASE_URL_FOR_IMAGES}${rawMapImageUrl}`)
    : null;

  const handleImageError = (e) => {
    console.warn(`LocationCard: Image load failed for location "${location.name}". URL: ${e.target.src}`);
    if (e.target && e.target.style) e.target.style.display = 'none';
  };

  return (
    <Grid item xs={12} sm={6} md={4}>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 3, '&:hover': { boxShadow: 6 } }}>
        {mapImageUrl ? (
          <CardMedia
            component="img"
            height="160"
            image={mapImageUrl}
            alt={`${location.name || 'Location'} map`}
            sx={{ objectFit: 'cover' }}
            onError={handleImageError}
          />
        ) : (
          isDM && location.map_asset_id ?
            <Box sx={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'action.disabledBackground', borderBottom: '1px solid', borderColor: 'divider', p: 1, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">Map asset ID: {location.map_asset_id}<br />(Preview unavailable)</Typography>
            </Box>
            :
            <Box sx={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'grey.200' }}>
              <ImageIcon sx={{ fontSize: 60, color: 'text.disabled' }} />
            </Box>
        )}
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography gutterBottom variant="h6" component="div">{location.name || "Unnamed Location"}</Typography>
          {location.type && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Type: {location.type}</Typography>}

          <Accordion elevation={0} disableGutters sx={{ backgroundColor: 'transparent', '&:before': { display: 'none' }, '&.Mui-expanded': { margin: 0 } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ p: 0, minHeight: 'auto', '& .MuiAccordionSummary-content': { m: 0, alignItems: 'center' } }}>
              <Typography variant="subtitle2" color="text.primary">Public Description</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0, pt: 0.5 }}>
              {location.description_public && location.description_public.trim() !== '<p></p>' ? (
                <Box
                  dangerouslySetInnerHTML={{ __html: location.description_public }}
                  sx={{
                    maxHeight: '200px', overflowY: 'auto', fontSize: '0.875rem',
                    wordBreak: 'break-word', // Ensure long words break
                    '& p': { marginBlockStart: '0.5em', marginBlockEnd: '0.5em' }, // Adjust paragraph spacing
                    '& ul, & ol': { paddingInlineStart: '20px', marginBlockStart: '0.5em', marginBlockEnd: '0.5em' },
                    '& li': { marginBottom: '0.25em' }
                  }}
                />
              ) : (
                <Typography variant="body2" color="text.disabled" fontStyle="italic">No public description provided.</Typography>
              )}
            </AccordionDetails>
          </Accordion>

          {isDM && location.description_dm && location.description_dm.trim() !== '<p></p>' && (
            <Accordion elevation={0} disableGutters sx={{ backgroundColor: 'transparent', '&:before': { display: 'none' }, mt: 1, '&.Mui-expanded': { margin: 0 } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ p: 0, minHeight: 'auto', '& .MuiAccordionSummary-content': { m: 0, alignItems: 'center' } }}>
                <Tooltip title="DM Notes (visible only to you)">
                  <Typography variant="subtitle2" color="info.main" fontStyle="italic">DM Notes</Typography>
                </Tooltip>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0, pt: 0.5 }}>
                <Box
                  dangerouslySetInnerHTML={{ __html: location.description_dm }}
                  sx={{
                    maxHeight: '150px', overflowY: 'auto', fontSize: '0.8rem',
                    wordBreak: 'break-word',
                    '& p': { marginBlockStart: '0.5em', marginBlockEnd: '0.5em' },
                    '& ul, & ol': { paddingInlineStart: '20px', marginBlockStart: '0.5em', marginBlockEnd: '0.5em' },
                    '& li': { marginBottom: '0.25em' }
                  }}
                />
              </AccordionDetails>
            </Accordion>
          )}

          {location.tags && location.tags.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {location.tags.map(tag => <Chip key={tag.id || tag.name} label={tag.name} size="small" variant="outlined" />)}
            </Box>
          )}
        </CardContent>
        {isDM && (
          <CardActions sx={{ borderTop: 1, borderColor: 'divider', justifyContent: 'flex-end' }}>
            <Button size="small" startIcon={<EditIcon />} onClick={() => onEdit(location)}>Edit</Button>
            <Button size="small" startIcon={<DeleteIcon />} color="error" onClick={() => onDelete(location)}>Delete</Button>
          </CardActions>
        )}
      </Card>
    </Grid>
  );
};

const GazetteerPage = () => {
  const { user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [openLocationDialog, setOpenLocationDialog] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isEditingLocation, setIsEditingLocation] = useState(false);

  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('');
  const [formDescriptionPublic, setFormDescriptionPublic] = useState('');
  const [formDescriptionDM, setFormDescriptionDM] = useState('');
  const [formMapAssetId, setFormMapAssetId] = useState('');
  const [formIsVisible, setFormIsVisible] = useState(true);
  const [formTags, setFormTags] = useState([]);
  const [availableAssets, setAvailableAssets] = useState([]);

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState(null);

  const [filterTags, setFilterTags] = useState([]);
  const isDM = user?.role === 'DM';

  const fetchLocations = useCallback(async () => {
    setIsLoading(true); setError('');
    try {
      const fetchedLocations = await apiService.getLocations(filterTags.map(tag => typeof tag === 'object' ? tag.name : tag));
      setLocations(fetchedLocations || []);
    } catch (err) {
      setError(err.message || err.error || 'Failed to fetch locations.');
    } finally {
      setIsLoading(false);
    }
  }, [filterTags]);

  const fetchAssetsForDialog = useCallback(async () => {
    if (isDM) {
      try {
        const assets = await apiService.getAssets([], { params: { type: 'image' } }); // Assuming API can filter by type
        setAvailableAssets(assets.filter(asset => asset.mimetype && asset.mimetype.startsWith('image/')) || []);
      } catch (assetErr) {
        console.error("Failed to fetch assets for location dialog:", assetErr);
        setAvailableAssets([]);
      }
    }
  }, [isDM]);

  useEffect(() => {
    fetchLocations();
    // Assets for dialog are fetched when dialog is opened by DM
  }, [fetchLocations]);

  const resetForm = () => { setFormName(''); setFormType(''); setFormDescriptionPublic(''); setFormDescriptionDM(''); setFormMapAssetId(''); setFormIsVisible(true); setFormTags([]); setDialogError(''); };

  const handleOpenCreateLocationDialog = () => {
    setIsEditingLocation(false); setCurrentLocation(null); resetForm();
    fetchAssetsForDialog(); // Fetch assets when DM opens dialog
    setOpenLocationDialog(true);
  };

  const handleOpenEditLocationDialog = (location) => {
    setIsEditingLocation(true); setCurrentLocation(location);
    setFormName(location.name || '');
    setFormType(location.type || '');
    setFormDescriptionPublic(location.description_public || '');
    setFormDescriptionDM(isDM ? (location.description_dm || '') : ''); // Only set DM desc if DM
    setFormMapAssetId(location.map_asset_id || '');
    setFormIsVisible(location.is_visible_to_players === undefined ? true : location.is_visible_to_players);
    setFormTags(location.tags ? location.tags.map(tag => tag.name) : []);
    setDialogError('');
    fetchAssetsForDialog(); // Fetch assets when DM opens dialog
    setOpenLocationDialog(true);
  };

  const handleCloseLocationDialog = () => { setOpenLocationDialog(false); setCurrentLocation(null); };

  const handleSaveLocation = async () => {
    if (!formName.trim()) { setDialogError("Location name is required."); return; }
    setActionLoading(true); setDialogError('');
    const locationData = {
      name: formName.trim(),
      type: formType.trim() || null,
      description_public: formDescriptionPublic,
      description_dm: formDescriptionDM, // Backend should ignore this if user is not DM, or protect endpoint
      map_asset_id: formMapAssetId ? parseInt(formMapAssetId, 10) : null,
      is_visible_to_players: formIsVisible,
      tags: formTags,
    };
    try {
      if (isEditingLocation && currentLocation) {
        await apiService.updateLocation(currentLocation.id, locationData);
      } else {
        await apiService.createLocation(locationData);
      }
      fetchLocations(); handleCloseLocationDialog();
    } catch (err) {
      setDialogError(err.message || err.error || "Failed to save location.");
    } finally { setActionLoading(false); }
  };

  const handleClickOpenDeleteDialog = (location) => { setLocationToDelete(location); setOpenDeleteDialog(true); };
  const handleCloseDeleteDialog = () => { setLocationToDelete(null); setOpenDeleteDialog(false); };
  const handleDeleteLocationConfirm = async () => { if (!locationToDelete) return; setActionLoading(true); try { await apiService.deleteLocation(locationToDelete.id); fetchLocations(); handleCloseDeleteDialog(); } catch (err) { setError(err.message || err.error || "Failed to delete location."); } finally { setActionLoading(false); } };

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>;
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: { xs: 2, sm: 3 }, boxShadow: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h4" component="h1" sx={{ fontFamily: '"Cinzel Decorative", serif' }}>World Gazetteer</Typography>
          {isDM && (
            <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={handleOpenCreateLocationDialog}>
              Add Location
            </Button>
          )}
        </Box>

        <Box sx={{ mb: 3, p: 1.5, backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100', borderRadius: 1 }}>
          <TagInput
            label="Filter Locations by Tags"
            value={filterTags.map(tag => typeof tag === 'object' ? tag.name : tag)} // Ensure value is array of strings
            onChange={(newTags) => setFilterTags(newTags)} // newTags is array of strings
            placeholder="Type to filter by tags..."
            fullWidth
          />
        </Box>

        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

        {locations.length === 0 && !isLoading && (
          <Typography sx={{ mt: 3, textAlign: 'center', color: 'text.secondary' }}>
            No locations found{filterTags.length > 0 ? ' matching your filter' : ''}.
            {isDM ? " Start building your world!" : (user ? " The world map is yet to be revealed by your DM." : "")}
          </Typography>
        )}

        <Grid container spacing={3}>
          {locations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              onEdit={handleOpenEditLocationDialog} // Button won't show for players
              onDelete={handleClickOpenDeleteDialog} // Button won't show for players
              isDM={isDM}
            />
          ))}
        </Grid>
      </Paper>

      {/* Create/Edit Location Dialog - Only for DMs */}
      {isDM && openLocationDialog && (
        <Dialog open={openLocationDialog} onClose={handleCloseLocationDialog} fullWidth maxWidth="md">
          <DialogTitle sx={{ fontFamily: '"Cinzel", serif' }}>{isEditingLocation ? 'Edit Location' : 'Create New Location'}</DialogTitle>
          <DialogContent dividers>
            <MuiTextField autoFocus margin="dense" label="Location Name*" value={formName} onChange={(e) => setFormName(e.target.value)} fullWidth sx={{ mb: 2 }} />
            <MuiTextField margin="dense" label="Type (e.g., City, Dungeon, Forest)" value={formType} onChange={(e) => setFormType(e.target.value)} fullWidth sx={{ mb: 2 }} />

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 'bold' }}>Public Description:</Typography>
            <Paper variant="outlined" sx={{ p: 1, minHeight: 150, maxHeight: 300, overflowY: 'auto' }}>
              <RichTextEditor content={formDescriptionPublic} onChange={setFormDescriptionPublic} placeholder="Information visible to players..." />
            </Paper>

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 'bold' }}>DM Notes (Private):</Typography>
            <Paper variant="outlined" sx={{ p: 1, minHeight: 100, maxHeight: 250, overflowY: 'auto' }}>
              <RichTextEditor content={formDescriptionDM} onChange={setFormDescriptionDM} placeholder="Your secret notes, plot hooks, etc..." />
            </Paper>

            <Box sx={{ my: 2 }}>
              <TagInput label="Location Tags" value={formTags} onChange={(newTags) => setFormTags(newTags)} placeholder="Add relevant tags..." />
            </Box>

            <FormControl fullWidth margin="dense" sx={{ mb: 2 }}>
              <InputLabel id="map-asset-select-label">Associated Map Image (Optional)</InputLabel>
              <Select
                labelId="map-asset-select-label"
                label="Associated Map Image (Optional)"
                value={formMapAssetId}
                onChange={(e) => setFormMapAssetId(e.target.value)}
              >
                <MenuItem value=""><em>None</em></MenuItem>
                {availableAssets.map(asset => (
                  <MenuItem key={asset.id} value={asset.id}>
                    {asset.filename_original} (ID: {asset.id})
                  </MenuItem>
                ))}
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>Select an image asset from your Asset Library.</Typography>
            </FormControl>

            <FormControlLabel
              control={<Checkbox checked={formIsVisible} onChange={(e) => setFormIsVisible(e.target.checked)} />}
              label="Visible to Players"
              sx={{ mt: 1 }}
            />
            {dialogError && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setDialogError('')}>{dialogError}</Alert>}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
            <Button onClick={handleCloseLocationDialog} color="inherit">Cancel</Button>
            <Button onClick={handleSaveLocation} variant="contained" disabled={actionLoading || !formName.trim()}>
              {actionLoading ? <CircularProgress size={24} /> : (isEditingLocation ? 'Save Changes' : 'Create Location')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {isDM && locationToDelete && (
        <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
          <DialogTitle>Confirm Delete Location</DialogTitle>
          <DialogContent><DialogContentText>Are you sure you want to delete "{locationToDelete.name}"?</DialogContentText></DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDeleteDialog} color="inherit">Cancel</Button>
            <Button onClick={handleDeleteLocationConfirm} color="error" variant="contained" disabled={actionLoading}>
              {actionLoading ? <CircularProgress size={24} /> : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Container>
  );
};

export default GazetteerPage;
