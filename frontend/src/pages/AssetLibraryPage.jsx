// src/pages/AssetLibraryPage.jsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  Container, Typography, Button, Grid, CircularProgress, Paper,
  TextField, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Select, MenuItem, FormControl, InputLabel, IconButton, Box, Card, CardMedia, CardContent, CardActions, Tooltip, Chip // Added Chip
} from '@mui/material'; // Make sure Chip is imported
import { AddPhotoAlternate as AddPhotoAlternateIcon, Edit as EditIcon, Delete as DeleteIcon, CloudUpload as CloudUploadIcon, Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon, Download as DownloadIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext'; // Using the hook
import * as apiService from '../services/apiService';
import TagInput from '../components/ui/TagInput'; // IMPORT TAGINPUT

// Simple Asset Card
const AssetCard = ({ asset, onEdit, onDelete, onToggleVisibility, isDM }) => {
  const isImage = asset.mimetype && asset.mimetype.startsWith('image/');
  const isPdf = asset.mimetype === 'application/pdf';

  const handleDownload = () => { /* ... (your existing download logic) ... */
    if (!asset.url) { console.error("Asset URL is missing."); return; }
    const link = document.createElement('a');
    link.href = asset.url;
    link.setAttribute('download', asset.filename_original);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {isImage ? (<CardMedia component="img" sx={{ height: 140, objectFit: 'contain', cursor: 'pointer' }} image={asset.url} alt={asset.filename_original} onClick={() => window.open(asset.url, '_blank')} />)
        : isPdf ? (<Box sx={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', cursor: 'pointer' }} onClick={() => window.open(asset.url, '_blank')} > <Typography variant="h5" color="textSecondary">PDF</Typography> </Box>)
          : (<Box sx={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e0e0e0' }}> <Typography variant="body2" color="textSecondary">.{asset.filename_original.split('.').pop()}</Typography> </Box>)}
      <CardContent sx={{ flexGrow: 1 }}>
        <Tooltip title={asset.filename_original}><Typography gutterBottom variant="subtitle2" noWrap>{asset.filename_original}</Typography></Tooltip>
        <Typography variant="body2" color="text.secondary" noWrap>{asset.description || 'No description'}</Typography>
        <Typography variant="caption" color="text.secondary">Size: {asset.filesize ? (asset.filesize / 1024 / 1024).toFixed(2) : 'N/A'} MB</Typography><br />
        <Typography variant="caption" color="text.secondary">Uploaded by: {asset.uploader_username || 'Unknown'}</Typography>

        {/* DISPLAY ASSET TAGS */}
        {asset.tags && asset.tags.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {asset.tags.map((tag) => (
              <Chip key={tag.id || tag.name} label={tag.name} size="small" variant="outlined" />
            ))}
          </Box>
        )}
      </CardContent>
      <CardActions>
        <Button size="small" onClick={handleDownload} startIcon={<DownloadIcon />}>Download</Button>
        {isDM && (<> <Tooltip title="Edit Metadata"><IconButton size="small" onClick={() => onEdit(asset)}><EditIcon /></IconButton></Tooltip> <Tooltip title={asset.visibility_scope === 'party_wide' ? "Visible to Party" : "DM Only"}><IconButton size="small" onClick={() => onToggleVisibility(asset)}>{asset.visibility_scope === 'party_wide' ? <VisibilityIcon /> : <VisibilityOffIcon />}</IconButton></Tooltip> <Tooltip title="Delete Asset"><IconButton size="small" color="error" onClick={() => onDelete(asset)}><DeleteIcon /></IconButton></Tooltip> </>)}
      </CardActions>
    </Card>
  );
};


const AssetLibraryPage = () => {
  const { user } = useAuth(); // Changed from useContext(AuthContext) to useAuth hook
  const [assets, setAssets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(''); // Page level error
  const [dialogError, setDialogError] = useState(''); // Dialog specific error

  // For Upload Dialog/Form
  const [openUploadDialog, setOpenUploadDialog] = useState(false);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadVisibility, setUploadVisibility] = useState('dm_only');
  const [uploadDialogTags, setUploadDialogTags] = useState([]); // NEW state for tags in upload dialog

  // For Edit Dialog
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState('dm_only');
  const [editDialogTags, setEditDialogTags] = useState([]); // NEW state for tags in edit dialog

  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState(null);

  const isDM = user?.role === 'DM';

  // State for tag filtering
  const [filterByAssetTags, setFilterByAssetTags] = useState([]);

  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      // Pass filterByAssetTags (array of names) to getAssets API call
      const data = await apiService.getAssets(filterByAssetTags.map(tag => typeof tag === 'object' ? tag.name : tag));
      setAssets(data || []);
    } catch (err) {
      setError(err.error || 'Failed to fetch assets.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [filterByAssetTags]); // Added filterByAssetTags to dependency

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]); // fetchAssets callback now includes filterByAssetTags

  const handleOpenUploadDialog = () => {
    setFileToUpload(null);
    setUploadDescription('');
    setUploadVisibility('dm_only');
    setUploadDialogTags([]); // Reset tags
    setDialogError(''); // Clear dialog error
    setOpenUploadDialog(true);
  };

  const handleFileChange = (event) => { /* ... (remains the same) ... */ if (event.target.files && event.target.files[0]) { setFileToUpload(event.target.files[0]); } };

  const handleUploadAsset = async () => {
    if (!fileToUpload) { setDialogError('Please select a file to upload.'); return; }
    // setIsLoading(true); // Using actionLoading for dialogs
    setDialogError('');
    const formData = new FormData();
    formData.append('assetfile', fileToUpload);
    formData.append('description', uploadDescription);
    formData.append('visibility_scope', uploadVisibility);
    // Append tags as a JSON string because FormData converts arrays to multiple entries
    if (uploadDialogTags.length > 0) {
      formData.append('tags', JSON.stringify(uploadDialogTags));
    }

    try {
      await apiService.uploadAsset(formData);
      setOpenUploadDialog(false);
      fetchAssets();
    } catch (err) {
      setDialogError(err.error || 'Upload failed.');
      console.error(err);
    } finally {
      // setIsLoading(false);
    }
  };

  const handleOpenEditDialog = (asset) => {
    setEditingAsset(asset);
    setEditDescription(asset.description || '');
    setEditVisibility(asset.visibility_scope || 'dm_only');
    // Initialize dialog tags from asset.tags (which are {id, name} objects)
    setEditDialogTags(asset.tags ? asset.tags.map(tag => tag.name) : []);
    setDialogError('');
    setOpenEditDialog(true);
  };

  const handleUpdateAsset = async () => {
    if (!editingAsset) return;
    // setIsLoading(true);
    setDialogError('');
    try {
      const payload = {
        description: editDescription,
        visibility_scope: editVisibility,
        tags: editDialogTags, // Send array of tag name strings
      };
      await apiService.updateAsset(editingAsset.id, payload);
      setOpenEditDialog(false);
      fetchAssets();
    } catch (err) {
      setDialogError(err.error || 'Update failed.');
      console.error(err);
    } finally {
      // setIsLoading(false);
    }
  };

  const handleToggleVisibility = async (asset) => { /* ... (remains the same) ... */ if (!asset) return; setIsLoading(true); const newVisibility = asset.visibility_scope === 'dm_only' ? 'party_wide' : 'dm_only'; try { await apiService.updateAsset(asset.id, { visibility_scope: newVisibility }); fetchAssets(); } catch (err) { setError(err.error || 'Visibility update failed.'); } finally { setIsLoading(false); } };
  const handleOpenDeleteConfirm = (asset) => { /* ... (remains the same) ... */ setAssetToDelete(asset); setOpenDeleteConfirm(true); setDialogError(''); };
  const handleDeleteAsset = async () => { /* ... (remains the same) ... */ if (!assetToDelete) return; setIsLoading(true); try { await apiService.deleteAsset(assetToDelete.id); setOpenDeleteConfirm(false); setAssetToDelete(null); fetchAssets(); } catch (err) { setError(err.error || 'Delete failed.'); } finally { setIsLoading(false); } };

  if (isLoading && assets.length === 0) { /* ... (remains the same) ... */ }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">Asset Library</Typography>
          {isDM && (<Button variant="contained" startIcon={<CloudUploadIcon />} onClick={handleOpenUploadDialog}>Upload Asset</Button>)}
        </Box>

        {/* Tag Filter Input for Asset List */}
        <Box sx={{ mb: 2, maxWidth: 500, mx: 'auto' }}>
          <TagInput
            label="Filter Assets by Tags"
            value={filterByAssetTags.map(tag => typeof tag === 'object' ? tag.name : tag)}
            onChange={(newTags) => setFilterByAssetTags(newTags)} // newTags are strings
            placeholder="Filter by tags..."
          />
        </Box>

        {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
        {isLoading && assets.length > 0 && <CircularProgress size={24} sx={{ mr: 1 }} />}
        {assets.length === 0 && !isLoading && (<Typography sx={{ mt: 3, textAlign: 'center' }}> No assets found. {isDM ? "Try uploading some!" : "The DM hasn't shared any assets yet."} </Typography>)}
        <Grid container spacing={3}> {assets.map((asset) => (<Grid item key={asset.id} xs={12} sm={6} md={4} lg={3}> <AssetCard asset={asset} onEdit={handleOpenEditDialog} onDelete={handleOpenDeleteConfirm} onToggleVisibility={handleToggleVisibility} isDM={isDM} /> </Grid>))} </Grid>
      </Paper>

      {/* Upload Dialog */}
      <Dialog open={openUploadDialog} onClose={() => { setOpenUploadDialog(false); setDialogError(''); }}>
        <DialogTitle>Upload New Asset</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}> Select a file to upload. You can also add a description, tags, and set its visibility. </DialogContentText>
          <Button variant="outlined" component="label" fullWidth startIcon={<AddPhotoAlternateIcon />} sx={{ mb: 2 }}> Choose File <input type="file" hidden onChange={handleFileChange} /> </Button>
          {fileToUpload && <Typography sx={{ mb: 2 }}>Selected: {fileToUpload.name}</Typography>}
          <TextField autoFocus margin="dense" id="description" label="Description (Optional)" type="text" fullWidth variant="outlined" value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} sx={{ mb: 2 }} />

          {/* ADD TagInput TO UPLOAD DIALOG */}
          <Box sx={{ mb: 2 }}>
            <TagInput
              label="Asset Tags"
              value={uploadDialogTags}
              onChange={(newTags) => setUploadDialogTags(newTags)}
              placeholder="Add relevant tags..."
            />
          </Box>

          {isDM && (<FormControl fullWidth margin="dense"> <InputLabel id="visibility-scope-label">Visibility</InputLabel> <Select labelId="visibility-scope-label" id="visibility_scope" value={uploadVisibility} label="Visibility" onChange={(e) => setUploadVisibility(e.target.value)}> <MenuItem value="dm_only">DM Only</MenuItem> <MenuItem value="party_wide">Party Wide</MenuItem> </Select> </FormControl>)}
          {dialogError && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setDialogError('')}>{dialogError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenUploadDialog(false); setDialogError(''); }}>Cancel</Button>
          <Button onClick={handleUploadAsset} variant="contained" disabled={!fileToUpload || isLoading}> {isLoading ? <CircularProgress size={24} /> : "Upload"} </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      {editingAsset && (
        <Dialog open={openEditDialog} onClose={() => { setOpenEditDialog(false); setDialogError(''); }}>
          <DialogTitle>Edit Asset: {editingAsset.filename_original}</DialogTitle>
          <DialogContent>
            <TextField autoFocus margin="dense" id="edit-description" label="Description" type="text" fullWidth variant="outlined" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} sx={{ mb: 1, mt: 1 }} />

            {/* ADD TagInput TO EDIT DIALOG */}
            <Box sx={{ my: 2 }}> {/* my:2 for margin top and bottom */}
              <TagInput
                label="Asset Tags"
                value={editDialogTags}
                onChange={(newTags) => setEditDialogTags(newTags)}
                placeholder="Add relevant tags..."
              />
            </Box>

            {isDM && (<FormControl fullWidth margin="dense"> <InputLabel id="edit-visibility-scope-label">Visibility</InputLabel> <Select labelId="edit-visibility-scope-label" id="edit_visibility_scope" value={editVisibility} label="Visibility" onChange={(e) => setEditVisibility(e.target.value)}> <MenuItem value="dm_only">DM Only</MenuItem> <MenuItem value="party_wide">Party Wide</MenuItem> </Select> </FormControl>)}
            {dialogError && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setDialogError('')}>{dialogError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setOpenEditDialog(false); setDialogError(''); }}>Cancel</Button>
            <Button onClick={handleUpdateAsset} variant="contained" disabled={isLoading}> {isLoading ? <CircularProgress size={24} /> : "Save Changes"} </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {assetToDelete && (<Dialog open={openDeleteConfirm} onClose={() => setOpenDeleteConfirm(false)}> <DialogTitle>Confirm Delete</DialogTitle> <DialogContent> <DialogContentText> Are you sure you want to delete the asset "{assetToDelete.filename_original}"? This action cannot be undone. </DialogContentText> </DialogContent> <DialogActions> <Button onClick={() => setOpenDeleteConfirm(false)}>Cancel</Button> <Button onClick={handleDeleteAsset} color="error" variant="contained" disabled={isLoading}> {isLoading ? <CircularProgress size={24} /> : "Delete"} </Button> </DialogActions> </Dialog>)}
    </Container>
  );
};

export default AssetLibraryPage;
