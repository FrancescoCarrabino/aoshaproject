// src/pages/NPCsPage.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getNpcs, createNpc, updateNpc, deleteNpc, uploadNpcImage,
  getCharacterSheets,
  createCharacterSheet
} from '../services/apiService';
import {
  Typography, Box, CircularProgress, Alert, Button, Paper, Grid,
  Card, CardMedia, CardContent, CardActions, IconButton, Fab, Avatar,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  TextField as MuiTextField,
  Select, MenuItem, FormControl, InputLabel, Chip, Tooltip
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import ArticleIcon from '@mui/icons-material/Article';
// Import initialCharacterState dynamically when needed by DM
// import { initialCharacterState } from '../components/character/CharacterSheet'; 
import TagInput from '../components/ui/TagInput';

// This is used for constructing PREVIEW URLs in the dialog if needed,
// but NpcCard will use relative paths directly from npc.image_url if Vite proxy is set.
const API_BASE_URL_FOR_IMAGES = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace('/api', '');


function NpcCard({ npc, onEdit, onDelete, userRole }) {
  const isDM = userRole === 'DM'; // Use isDM for clarity

  // npc.image_url from the backend *should* be the correct relative path
  // e.g., /uploads/npc_images/filename.jpg
  // The browser requests this from current domain (e.g., localhost:5173),
  // Vite proxy (if /uploads is proxied) forwards to backend (localhost:5001)
  const imageUrl = npc.image_url;

  const handleImageError = (e) => {
    console.warn(`NpcCard: Image load failed for NPC "${npc.name}". Attempted URL: ${e.target.src}. Original DB path: "${npc.image_url}"`);
    if (e.target && e.target.style) {
      e.target.style.display = 'none';
    }
  };

  return (
    <Grid item xs={12} sm={6} md={4} lg={3}>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 3, '&:hover': { boxShadow: 6 } }}>
        {imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '' ? (
          <CardMedia
            component="img"
            height="200"
            image={imageUrl} // Use relative path directly
            alt={npc.name || "NPC Image"}
            onError={handleImageError}
            sx={{ objectFit: 'cover' }}
          />
        ) : (
          <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'grey.200' }}>
            <Avatar sx={{ width: 80, height: 80, fontSize: '2rem', bgcolor: 'secondary.light', color: 'white' }}>
              {npc.name ? npc.name[0].toUpperCase() : '?'}
            </Avatar>
          </Box>
        )}
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography gutterBottom variant="h5" component="div" sx={{ fontFamily: '"Cinzel Decorative", serif' }}>
            {npc.name || "Unnamed NPC"}
          </Typography>
          {npc.title && <Typography variant="subtitle1" color="text.secondary" gutterBottom>{npc.title}</Typography>}

          {/* Public Description - always visible */}
          <Typography variant="body2" color="text.secondary" sx={{ maxHeight: '100px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', my: 1 }}>
            {npc.description || "No public description."}
          </Typography>

          {/* Tags - always visible if they exist */}
          {npc.tags && npc.tags.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {npc.tags.map((tag) => (
                <Chip key={tag.id || tag.name} label={tag.name} size="small" variant="outlined" />
              ))}
            </Box>
          )}

          {/* DM Notes - only if isDM and notes_dm_only exists (backend won't send this field to players) */}
          {isDM && npc.notes_dm_only && (
            <Tooltip title="DM Notes (visible only to you)">
              <Typography variant="caption" color="info.main" sx={{ mt: 1, display: 'block', fontStyle: 'italic', maxHeight: '60px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderTop: '1px dashed', borderColor: 'divider', pt: 1 }}>
                DM Notes: {npc.notes_dm_only.substring(0, 100)}{npc.notes_dm_only.length > 100 ? '...' : ''}
              </Typography>
            </Tooltip>
          )}
        </CardContent>

        {/* Card Actions - only for DM */}
        {isDM && (
          <CardActions sx={{ justifyContent: 'space-between', pt: 0, borderTop: 1, borderColor: 'divider' }}>
            <Button size="small" startIcon={<EditIcon />} onClick={() => onEdit(npc)}>Edit</Button>
            {/* character_sheet_id won't exist on npc object for players */}
            {npc.character_sheet_id ? (
              <Button size="small" startIcon={<VisibilityIcon />} component={RouterLink} to={`/character/${npc.character_sheet_id}`} color="secondary">
                Sheet
              </Button>
            ) : (
              <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>No Sheet</Typography>
            )}
            <IconButton onClick={() => onDelete(npc)} color="error" size="small" aria-label="delete npc"><DeleteIcon /></IconButton>
          </CardActions>
        )}
      </Card>
    </Grid>
  );
}


function NPCsPage() {
  const { user } = useAuth();
  // const navigate = useNavigate(); // Not used if RouterLink is sufficient
  const [npcs, setNpcs] = useState([]);
  const [availableSheets, setAvailableSheets] = useState([]); // DM-only state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [openNpcDialog, setOpenNpcDialog] = useState(false);
  const [currentNpcData, setCurrentNpcData] = useState(null);
  const [isEditingNpc, setIsEditingNpc] = useState(false);
  const [currentDialogNpcTags, setCurrentDialogNpcTags] = useState([]);

  const imageFileRef = useRef(null); // For new File object
  const [imagePreview, setImagePreview] = useState(null); // For blob URL or existing relative path
  const fileInputDomRef = useRef(null);

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [npcToDelete, setNpcToDelete] = useState(null);

  const [filterByNpcTags, setFilterByNpcTags] = useState([]);
  const isDM = user?.role === 'DM';

  const fetchNpcsAndSheets = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      // Players will get sanitized NPCs (no DM notes, no sheet_id)
      const fetchedNpcs = await getNpcs(filterByNpcTags.map(tag => typeof tag === 'object' ? tag.name : tag));
      setNpcs(fetchedNpcs || []); // Ensure npcs is always an array

      if (isDM) { // Only DMs need to fetch and manage character sheets for linking
        const fetchedSheets = await getCharacterSheets();
        const npcSheetIds = (fetchedNpcs || []).map(npc => npc.character_sheet_id).filter(id => id != null);
        setAvailableSheets(fetchedSheets.filter(sheet => !npcSheetIds.includes(sheet.id)));
      } else {
        setAvailableSheets([]); // Players don't see this UI
      }
    } catch (err) {
      setError(err.message || err.error || 'Could not load NPC data.');
    } finally {
      setIsLoading(false);
    }
  }, [isDM, filterByNpcTags]); // isDM is a dependency now

  useEffect(() => {
    fetchNpcsAndSheets();
  }, [fetchNpcsAndSheets]);

  // --- DM-Only Action Handlers ---
  // These handlers will only be callable if the UI triggering them is visible (i.e., if isDM is true)
  const handleImageFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file instanceof File) {
      imageFileRef.current = file;
      setImagePreview(URL.createObjectURL(file));
    } else {
      imageFileRef.current = null;
      // If editing, preview shows existing image (relative path). If new, preview is null.
      setImagePreview(isEditingNpc && currentNpcData?.image_url ? currentNpcData.image_url : null);
    }
  };

  const resetImageSelection = () => {
    imageFileRef.current = null;
    setImagePreview(isEditingNpc && currentNpcData?.image_url ? currentNpcData.image_url : null);
    if (fileInputDomRef.current) {
      fileInputDomRef.current.value = "";
    }
  };

  const handleOpenCreateNpcDialog = () => {
    // This button (FAB) will only be rendered for DMs
    setIsEditingNpc(false);
    setCurrentNpcData({ name: '', title: '', description: '', notes_dm_only: '', image_url: null, character_sheet_id: null });
    setCurrentDialogNpcTags([]);
    resetImageSelection(); // imagePreview will be null
    setOpenNpcDialog(true);
  };

  const handleOpenEditNpcDialog = (npc) => {
    // This button on NpcCard will only be rendered for DMs
    setIsEditingNpc(true);
    setCurrentNpcData({ ...npc });
    setCurrentDialogNpcTags(npc.tags ? npc.tags.map(tag => tag.name) : []);
    imageFileRef.current = null;
    setImagePreview(npc.image_url); // Display existing image_url (relative path)

    // Fetch available sheets (DM only concern for the dialog)
    const currentNpcSheetId = npc.character_sheet_id;
    getCharacterSheets().then(allSheets => {
      const npcSheetIdsOtherNpcs = npcs.filter(n => n.id !== npc.id).map(n => n.character_sheet_id).filter(id => id != null);
      setAvailableSheets(allSheets.filter(sheet => !npcSheetIdsOtherNpcs.includes(sheet.id) || sheet.id === currentNpcSheetId));
    });
    setOpenNpcDialog(true);
  };

  const handleCloseNpcDialog = () => {
    setOpenNpcDialog(false);
    setCurrentNpcData(null);
    setCurrentDialogNpcTags([]);
    setError(null); // Clear dialog-specific errors
    resetImageSelection();
  };

  const handleSaveNpc = async () => {
    // This save button is inside the DM-only dialog
    if (!currentNpcData || !currentNpcData.name.trim()) { setError("NPC Name is required."); return; }
    setActionLoading(true); setError(null);
    try {
      const payload = {
        name: currentNpcData.name,
        title: currentNpcData.title || null,
        description: currentNpcData.description || null,
        notes_dm_only: currentNpcData.notes_dm_only || null, // DM only field
        character_sheet_id: currentNpcData.character_sheet_id === '' || currentNpcData.character_sheet_id === null ? null : parseInt(currentNpcData.character_sheet_id, 10), // DM only field
        tags: currentDialogNpcTags,
      };
      let npcResponse;
      if (isEditingNpc) {
        npcResponse = await updateNpc(currentNpcData.id, payload);
      } else {
        const { id, ...createPayload } = payload;
        npcResponse = await createNpc(createPayload);
      }
      if (imageFileRef.current && npcResponse && npcResponse.id) {
        if (imageFileRef.current instanceof File) {
          const formData = new FormData();
          formData.append('npcImage', imageFileRef.current, imageFileRef.current.name);
          await uploadNpcImage(npcResponse.id, formData);
        }
      }
      await fetchNpcsAndSheets();
      handleCloseNpcDialog();
    } catch (err) {
      setError(err.message || err.error || "Could not save NPC.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSheetForNpc = async () => {
    // This button is inside the DM-only dialog
    if (!currentNpcData || !currentNpcData.name) { alert("NPC Name is required to create a linked sheet."); return; }
    setActionLoading(true);
    try {
      const { initialCharacterState } = await import('../components/character/CharacterSheet');
      const sheetName = `${currentNpcData.name}'s Stats`;
      const newSheetPayload = { sheet_name: sheetName, character_data: JSON.stringify({ ...(initialCharacterState || {}), characterName: currentNpcData.name }) };
      const createdSheet = await createCharacterSheet(newSheetPayload);
      setCurrentNpcData(prev => ({ ...prev, character_sheet_id: createdSheet.id }));
      alert(`Sheet "${sheetName}" (ID: ${createdSheet.id}) created for ${currentNpcData.name}. Remember to SAVE the NPC to finalize the link.`);
      // Refresh available sheets for the dropdown
      const sheetsForDropdown = await getCharacterSheets();
      const currentNpcSheets = (npcs || []).map(npc => npc.character_sheet_id).filter(id => id != null);
      setAvailableSheets(sheetsForDropdown.filter(sheet => !currentNpcSheets.includes(sheet.id) || sheet.id === createdSheet.id));
    } catch (err) {
      setError(err.message || err.error || "Could not create character sheet.");
    } finally {
      setActionLoading(false);
    }
  };
  const handleUnlinkSheet = () => { setCurrentNpcData(prev => ({ ...prev, character_sheet_id: null })); }; // Inside DM dialog
  const handleClickOpenDeleteDialog = (npc) => { setNpcToDelete(npc); setOpenDeleteDialog(true); }; // Triggered by DM card action
  const handleCloseDeleteDialog = () => { setNpcToDelete(null); setOpenDeleteDialog(false); setError(null); };
  const handleDeleteNpcConfirm = async () => { if (!npcToDelete) return; setActionLoading(true); setError(null); try { await deleteNpc(npcToDelete.id); await fetchNpcsAndSheets(); handleCloseDeleteDialog(); } catch (err) { setError(err.message || err.error || "Could not delete NPC."); } finally { setActionLoading(false); } };

  // Page is now accessible to all authenticated users.
  // isLoading state handles initial load for everyone.
  if (isLoading && npcs.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ pb: '80px' }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontFamily: '"Cinzel", serif', mb: 3, textAlign: 'center' }}>
        Non-Player Characters
      </Typography>
      <Box sx={{ mb: 2, maxWidth: 600, mx: 'auto', p: 1, backgroundColor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
        <TagInput
          label="Filter NPCs by Tags"
          value={filterByNpcTags.map(tag => typeof tag === 'object' ? tag.name : tag)}
          onChange={(newTags) => setFilterByNpcTags(newTags)}
          placeholder="Type to filter by tags..."
          fullWidth
        />
      </Box>
      {error && !openNpcDialog && !openDeleteDialog &&
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2, maxWidth: 600, mx: 'auto' }}>{error}</Alert>
      }
      <Grid container spacing={3}>
        {npcs.map(npc => (
          <NpcCard
            key={npc.id}
            npc={npc}
            onEdit={handleOpenEditNpcDialog} // NpcCard will hide button for players
            onDelete={handleClickOpenDeleteDialog} // NpcCard will hide button for players
            userRole={user?.role}
          />
        ))}
      </Grid>
      {npcs.length === 0 && !isLoading &&
        <Typography color="text.secondary" textAlign="center" sx={{ mt: 3 }}>
          No NPCs found{filterByNpcTags.length > 0 ? ' matching your filter' : ' yet'}.
          {isDM && ' Click the "+" button to add one!'}
        </Typography>
      }

      {/* FAB for adding NPC - Only for DM */}
      {isDM && (
        <Fab
          color="primary"
          aria-label="add npc"
          onClick={handleOpenCreateNpcDialog}
          sx={{ position: 'fixed', bottom: { xs: 72, sm: 32 }, right: { xs: 16, sm: 32 } }}
        >
          <AddCircleOutlineIcon />
        </Fab>
      )}

      {/* NPC Create/Edit Dialog - Conditionally rendered and only fully functional for DMs */}
      {isDM && currentNpcData && (
        <Dialog open={openNpcDialog} onClose={handleCloseNpcDialog} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontFamily: '"Cinzel",serif' }}>{isEditingNpc ? 'Edit NPC' : 'Create New NPC'}</DialogTitle>
          <DialogContent>
            <MuiTextField autoFocus margin="dense" id="npcName" label="NPC Name*" type="text" fullWidth variant="outlined" value={currentNpcData.name || ''} onChange={(e) => setCurrentNpcData(prev => ({ ...prev, name: e.target.value }))} sx={{ mb: 1 }} />
            <Box sx={{ my: 2 }}>
              <TagInput label="NPC Tags" value={currentDialogNpcTags} onChange={(newTags) => setCurrentDialogNpcTags(newTags)} placeholder="Add relevant tags..." />
            </Box>
            <MuiTextField margin="dense" id="npcTitle" label="Title/Role" type="text" fullWidth variant="outlined" value={currentNpcData.title || ''} onChange={(e) => setCurrentNpcData(prev => ({ ...prev, title: e.target.value }))} sx={{ mb: 2 }} />

            <Box sx={{ textAlign: 'center', mb: 2, p: 1, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
              {imagePreview && ( // imagePreview will be a blob URL for new files, or relative path for existing
                <Box
                  component="img"
                  src={imagePreview} // Use directly; browser handles blob: or relative /uploads/... (via proxy)
                  alt="NPC Preview"
                  sx={{ maxHeight: 150, maxWidth: '100%', mb: 1, borderRadius: 1 }}
                  onError={(e) => { e.target.style.display = 'none'; console.warn("Error loading image preview in dialog:", e.target.src); }}
                />
              )}
              <Button variant="outlined" component="label" size="small" startIcon={<AddPhotoAlternateIcon />}>
                {imageFileRef.current ? "Change Selected" : (isEditingNpc && currentNpcData.image_url ? "Change Image" : "Upload Image")}
                <input type="file" hidden accept="image/*" ref={fileInputDomRef} onChange={handleImageFileChange} />
              </Button>
              {(imageFileRef.current || (isEditingNpc && currentNpcData.image_url)) &&
                <Button size="small" color="inherit" onClick={resetImageSelection} sx={{ ml: 1 }}>
                  {imageFileRef.current ? "Clear Selection" : "Revert/Clear"}
                </Button>
              }
              {isEditingNpc && currentNpcData.image_url && !imageFileRef.current && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Current: {currentNpcData.image_url.split('/').pop()}
                </Typography>
              )}
            </Box>

            <MuiTextField margin="dense" id="npcDescription" label="Public Description" multiline rows={4} fullWidth variant="outlined" value={currentNpcData.description || ''} onChange={(e) => setCurrentNpcData(prev => ({ ...prev, description: e.target.value }))} sx={{ mb: 2 }} />
            <MuiTextField margin="dense" id="npcDmNotes" label="DM Notes (Private)" multiline rows={3} fullWidth variant="outlined" value={currentNpcData.notes_dm_only || ''} onChange={(e) => setCurrentNpcData(prev => ({ ...prev, notes_dm_only: e.target.value }))} sx={{ mb: 2 }} />
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>Character Sheet:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <FormControl fullWidth size="small" variant="outlined" sx={{ flexGrow: 1, minWidth: '200px' }}>
                <InputLabel id="link-sheet-label">Link Existing Sheet</InputLabel>
                <Select
                  labelId="link-sheet-label"
                  label="Link Existing Sheet"
                  value={currentNpcData.character_sheet_id || ''}
                  onChange={(e) => setCurrentNpcData(prev => ({ ...prev, character_sheet_id: e.target.value === '' ? null : parseInt(e.target.value) }))}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {/* Logic to display currently linked sheet if it's not in the filtered 'availableSheets' list */}
                  {isEditingNpc && currentNpcData.character_sheet_id &&
                    !availableSheets.find(s => s.id === currentNpcData.character_sheet_id) &&
                    (() => {
                      // Try to find the sheet name from the npcs list if not in availableSheets
                      // This is a fallback, ideally availableSheets would be managed to always include it
                      const originalNpc = npcs.find(n => n.id === currentNpcData.id);
                      const sheetNameIfKnown = originalNpc?.character_sheet_data?.sheet_name; // Assuming you might fetch sheet_name with NPC for DM
                      return <MenuItem key={currentNpcData.character_sheet_id} value={currentNpcData.character_sheet_id}>Currently Linked: {sheetNameIfKnown || `Sheet ID ${currentNpcData.character_sheet_id}`}</MenuItem>;
                    })()
                  }
                  {availableSheets.map(sheet => (
                    <MenuItem key={sheet.id} value={sheet.id}>{sheet.sheet_name} (ID: {sheet.id})</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {currentNpcData.character_sheet_id && (
                <Tooltip title="Unlink Sheet"><IconButton onClick={handleUnlinkSheet} size="small"><LinkOffIcon /></IconButton></Tooltip>
              )}
            </Box>
            <Button
              size="small" variant="text"
              startIcon={<ArticleIcon />}
              onClick={handleCreateSheetForNpc}
              disabled={actionLoading || !currentNpcData?.name?.trim()}
              sx={{ mt: 1, display: 'block', mx: 'auto' }}
            >
              Create New Sheet for NPC
            </Button>
            {error && openNpcDialog && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          </DialogContent>
          <DialogActions sx={{ pb: 2, pr: 2 }}>
            <Button onClick={handleCloseNpcDialog} color="inherit" disabled={actionLoading}>Cancel</Button>
            <Button onClick={handleSaveNpc} variant="contained" color="primary" disabled={actionLoading || !currentNpcData?.name?.trim()}>
              {actionLoading ? <CircularProgress size={20} color="inherit" /> : (isEditingNpc ? 'Save Changes' : 'Create NPC')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {isDM && npcToDelete && (
        <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
          <DialogTitle sx={{ fontFamily: '"Cinzel",serif' }}>Confirm Deletion</DialogTitle>
          <DialogContent><DialogContentText>Are you sure you want to delete NPC "{npcToDelete.name}"?</DialogContentText>
            {error && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>{error}</Alert>}
          </DialogContent>
          <DialogActions sx={{ pb: 2, pr: 2 }}>
            <Button onClick={handleCloseDeleteDialog} color="inherit" disabled={actionLoading}>Cancel</Button>
            <Button onClick={handleDeleteNpcConfirm} color="error" variant="contained" disabled={actionLoading}>
              {actionLoading ? <CircularProgress size={20} /> : "Delete"}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

export default NPCsPage;
