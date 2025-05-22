// src/pages/StoryPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getStoryEntries, createStoryEntry, updateStoryEntry, deleteStoryEntry
} from '../services/apiService';
import {
  Typography, Box, CircularProgress, Alert, Button, Paper,
  List, ListItem, ListItemText, ListItemButton, IconButton, Divider,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  TextField as MuiTextField,
  Checkbox, FormControlLabel, Grid, FormControl, InputLabel, Select, MenuItem,
  Chip // Added Chip for displaying tags
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RichTextEditor from '../components/ui/RichTextEditor';
import TagInput from '../components/ui/TagInput'; // IMPORT YOUR TAGINPUT COMPONENT

// Helper function to build the tree structure (remains the same)
const buildTree = (items, parentId = null) => {
  return items
    .filter(item => item.parent_id === parentId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.title || "").localeCompare(b.title || ""))
    .map(item => ({
      ...item,
      children: buildTree(items, item.id)
    }));
};

// Recursive component to render story entries (remains largely the same, just ensure 'tags' are passed if needed for display here)
function StoryEntryItem({
  entry, onEdit, onDelete, userRole, depth = 0, onSelectEntry, isSelected,
  globallySelectedEntry
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 1);

  const handleToggleExpand = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const canHaveChildren = entry.children && entry.children.length > 0;

  return (
    <Box>
      <ListItem
        disablePadding
        sx={{
          borderLeft: depth > 0 ? `2px solid rgba(255,255,255,0.1)` : 'none',
          ml: depth > 0 ? 0 : -2
        }}
      >
        <ListItemButton
          selected={isSelected}
          onClick={() => onSelectEntry(entry)}
          sx={{
            pl: 1 + (depth * 2),
            backgroundColor: !entry.is_visible_to_players && userRole === 'DM' ? 'rgba(229, 131, 35, 0.08)' : (isSelected ? 'action.selected' : 'transparent'),
            '&:hover': {
              backgroundColor: !entry.is_visible_to_players && userRole === 'DM' ? 'rgba(229, 131, 35, 0.12)' : 'action.hover',
            }
          }}
        >
          {canHaveChildren ? (
            <IconButton onClick={handleToggleExpand} size="small" sx={{ mr: 0.5, p: 0.5 }}>
              {isExpanded ? <ExpandMoreIcon fontSize="inherit" /> : <ChevronRightIcon fontSize="inherit" />}
            </IconButton>
          ) : (
            <Box sx={{ width: 28, mr: 0.5 }} />
          )}
          <ListItemText
            primary={entry.title || "Untitled Entry"}
            secondary={!entry.is_visible_to_players && userRole === 'DM' ? "DM Only" : null}
            primaryTypographyProps={{ fontWeight: depth === 0 ? 'medium' : 'normal', noWrap: true, overflow: 'hidden', textOverflow: 'ellipsis' }}
            secondaryTypographyProps={{ fontSize: '0.75rem' }}
          />
          {userRole === 'DM' && (
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
              <IconButton edge="end" aria-label="edit" onClick={(e) => { e.stopPropagation(); onEdit(entry); }} size="small" sx={{ mr: 0.5 }}><EditIcon fontSize="inherit" /></IconButton>
              <IconButton edge="end" aria-label="delete" onClick={(e) => { e.stopPropagation(); onDelete(entry); }} size="small" color="error"><DeleteIcon fontSize="inherit" /></IconButton>
            </Box>
          )}
        </ListItemButton>
      </ListItem>
      {canHaveChildren && isExpanded && (
        <List component="div" disablePadding sx={{ borderLeft: depth >= 0 ? `2px solid rgba(255,255,255,0.05)` : 'none', ml: depth >= 0 ? 0 : -2 }}>
          {entry.children.map(child => (
            <StoryEntryItem
              key={child.id} entry={child} onEdit={onEdit} onDelete={onDelete} userRole={userRole}
              depth={depth + 1} onSelectEntry={onSelectEntry}
              isSelected={globallySelectedEntry?.id === child.id}
              globallySelectedEntry={globallySelectedEntry}
            />
          ))}
        </List>
      )}
    </Box>
  );
}


function StoryPage() {
  const { user } = useAuth();
  const [allStoryEntries, setAllStoryEntries] = useState([]);
  const [storyTree, setStoryTree] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [openStoryDialog, setOpenStoryDialog] = useState(false);
  const [currentStoryData, setCurrentStoryData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  // NEW STATE FOR TAGS IN DIALOG
  const [currentDialogTags, setCurrentDialogTags] = useState([]);

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);

  // State for tag filtering (optional for later, shown for completeness of API call)
  const [filterByTags, setFilterByTags] = useState([]);


  const fetchStory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Pass filterByTags to the API call
      const entries = await getStoryEntries(filterByTags.map(tag => typeof tag === 'object' ? tag.name : tag));
      setAllStoryEntries(entries);
      const tree = buildTree(entries);
      setStoryTree(tree);

      if (selectedEntry) {
        const findSelected = (nodes, id) => {
          for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
              const found = findSelected(node.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        const reselected = findSelected(tree, selectedEntry.id);
        setSelectedEntry(reselected);
        if (!reselected && tree.length > 0) setSelectedEntry(tree[0]);
        else if (!reselected && tree.length === 0) setSelectedEntry(null);
      } else if (tree.length > 0) {
        setSelectedEntry(tree[0]);
      } else {
        setSelectedEntry(null);
      }
    } catch (err) {
      setError(err.error || 'Could not load story');
    } finally {
      setIsLoading(false);
    }
  }, [user, filterByTags]); // Added filterByTags to dependency array

  useEffect(() => {
    if (user) fetchStory();
  }, [user, fetchStory]); // fetchStory itself now depends on filterByTags

  const handleOpenCreateDialog = (parentId = null) => {
    setIsEditing(false);
    setCurrentStoryData({ title: '', content: '', parent_id: parentId, sort_order: 0, is_visible_to_players: true });
    setCurrentDialogTags([]); // Reset tags for new entry
    setOpenStoryDialog(true);
  };

  const handleOpenEditDialog = (entry) => {
    setIsEditing(true);
    setCurrentStoryData({ ...entry });
    // Initialize dialog tags from entry.tags (which are {id, name} objects)
    setCurrentDialogTags(entry.tags ? entry.tags.map(tag => tag.name) : []);
    setOpenStoryDialog(true);
  };

  const handleCloseStoryDialog = () => {
    setOpenStoryDialog(false);
    setCurrentStoryData(null);
    setCurrentDialogTags([]); // Clear tags on close
    setError(null); // Clear dialog-specific errors
  };

  const handleSaveStoryEntry = async () => {
    if (!currentStoryData || !currentStoryData.title.trim()) {
      setError("Title is required."); // This error should ideally be shown in the dialog
      return;
    }
    const plainTextContent = currentStoryData.content?.replace(/<[^>]*>/g, '').trim();
    if (!plainTextContent && !isEditing) { // Allow empty content on edit if desired, but not create
      setError("Content cannot be empty for new entries.");
      return;
    }

    setActionLoading(true);
    setError(null); // Clear page-level error

    // Prepare data, including the currentDialogTags (array of strings)
    const payload = {
      ...currentStoryData,
      tags: currentDialogTags, // Send array of tag name strings
    };
    // Remove id from payload if creating a new entry, as it's auto-generated
    if (!isEditing) {
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;
      // if backend returns full object on create, we dont need to delete tags from payload
      // but if backend expects only new tags, we might adjust. For now, send all.
    }


    try {
      if (isEditing) {
        await updateStoryEntry(currentStoryData.id, payload);
      } else {
        await createStoryEntry(payload);
      }
      await fetchStory(); // Re-fetch the whole story list to get updated data including tags
      handleCloseStoryDialog();
    } catch (err) {
      console.error("Save story error:", err);
      setError(err.error || "Could not save story entry."); // Show error in dialog
    } finally {
      setActionLoading(false);
    }
  };

  const handleClickOpenDeleteDialog = (entry) => { setEntryToDelete(entry); setOpenDeleteDialog(true); };
  const handleCloseDeleteDialog = () => { setEntryToDelete(null); setOpenDeleteDialog(false); setError(null); };
  const handleDeleteConfirm = async () => { if (!entryToDelete) return; setActionLoading(true); setError(null); try { await deleteStoryEntry(entryToDelete.id); await fetchStory(); if (selectedEntry && selectedEntry.id === entryToDelete.id) setSelectedEntry(storyTree.length > 0 ? storyTree[0] : null); handleCloseDeleteDialog(); } catch (err) { setError(err.error || "Could not delete."); } finally { setActionLoading(false); } };
  const handleSelectEntry = (entry) => setSelectedEntry(entry);

  if (isLoading && allStoryEntries.length === 0) { return <Box display="flex" justifyContent="center" alignItems="center" sx={{ p: 3 }}><CircularProgress /></Box>; }

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, height: { xs: 'auto', md: 'calc(100vh - 64px - 48px - 24px)' }, gap: 2 }}>
      {/* Left Panel: Story Tree Navigation */}
      <Paper elevation={2} sx={{ width: { xs: '100%', md: '320px' }, p: 1.5, overflowY: 'auto', display: 'flex', flexDirection: 'column', mb: { xs: 2, md: 0 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" sx={{ fontFamily: '"Cinzel", serif' }}>Story Chapters</Typography>
          {user?.role === 'DM' && (<Button size="small" variant="outlined" color="secondary" startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenCreateDialog()}>New Entry</Button>)}
        </Box>
        <Divider sx={{ mb: 1 }} />

        {/* Tag Filter Input (Optional - for filtering the list) */}
        <Box sx={{ mb: 1.5 }}>
          <TagInput
            label="Filter by Tags"
            value={filterByTags.map(tag => typeof tag === 'object' ? tag.name : tag)} // Assuming filterByTags could store objects or strings
            onChange={(newTags) => setFilterByTags(newTags)} // newTags are strings
            placeholder="Filter chapters..."
          />
        </Box>

        {error && !openStoryDialog && !openDeleteDialog && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>{error}</Alert>}
        {storyTree.length === 0 && !isLoading && (<Typography color="text.secondary" textAlign="center" sx={{ mt: 2 }}>No story entries yet.</Typography>)}
        <List component="nav" dense sx={{ flexGrow: 1, overflowY: 'auto' }}>
          {storyTree.map(entry => (
            <StoryEntryItem
              key={entry.id}
              entry={entry}
              onEdit={handleOpenEditDialog}
              onDelete={handleClickOpenDeleteDialog}
              userRole={user?.role}
              onSelectEntry={handleSelectEntry}
              isSelected={selectedEntry?.id === entry.id}
              globallySelectedEntry={selectedEntry}
            />
          ))}
        </List>
      </Paper>

      {/* Right Panel: Selected Story Content */}
      <Paper elevation={2} sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {selectedEntry ? (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography variant="h4" component="h1" gutterBottom sx={{ fontFamily: '"Cinzel Decorative", serif', flexGrow: 1 }}> {selectedEntry.title} </Typography>
              {/* Edit button for selected entry - DM only */}
              {user?.role === 'DM' && (
                <IconButton onClick={() => handleOpenEditDialog(selectedEntry)} size="small" sx={{ ml: 1 }}>
                  <EditIcon />
                </IconButton>
              )}
            </Box>
            {user?.role === 'DM' && !selectedEntry.is_visible_to_players && (<Alert severity="info" sx={{ mb: 2 }}>This entry is currently hidden from players.</Alert>)}

            {/* DISPLAY TAGS for selectedEntry */}
            {selectedEntry.tags && selectedEntry.tags.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                {selectedEntry.tags.map((tag) => (
                  <Chip key={tag.id || tag.name} label={tag.name} size="small" variant="outlined" />
                ))}
              </Box>
            )}

            <Box className="tiptap-display-content"
              sx={{ flexGrow: 1, overflowY: 'auto', '& p': { lineHeight: 1.7, mb: 1.5 }, '& h1': { typography: 'h3', my: 2 }, '& h2': { typography: 'h4', my: 1.5 }, '& h3': { typography: 'h5', my: 1 }, '& h4': { typography: 'h6', my: 1 }, '& ul, & ol': { pl: 3 }, '& blockquote': { borderLeft: '4px solid', borderColor: 'divider', pl: 2, ml: 0, fontStyle: 'italic', color: 'text.secondary' } }}
              dangerouslySetInnerHTML={{ __html: selectedEntry.content || '<p><em>No content for this entry.</em></p>' }}
            />
          </>
        ) : (<Typography color="text.secondary" textAlign="center" sx={{ mt: 5 }}> {allStoryEntries.length > 0 ? "Select a chapter from the left to read." : (user?.role === 'DM' ? "Create your first story entry!" : "The story awaits...")} </Typography>)}
      </Paper>

      {/* Create/Edit Story Entry Dialog (DM Only) */}
      {user?.role === 'DM' && currentStoryData && (
        <Dialog open={openStoryDialog} onClose={handleCloseStoryDialog} fullWidth maxWidth="lg" PaperProps={{ sx: { height: '90vh' } }}>
          <DialogTitle sx={{ fontFamily: '"Cinzel", serif', borderBottom: 1, borderColor: 'divider' }}>{isEditing ? 'Edit Story Entry' : 'New Story Entry'}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', pt: '20px !important', pb: 1, overflowY: 'hidden' }}>
            <MuiTextField autoFocus margin="dense" id="title" label="Title" type="text" fullWidth variant="outlined" value={currentStoryData.title} onChange={(e) => setCurrentStoryData(prev => ({ ...prev, title: e.target.value }))} sx={{ mb: 1, flexShrink: 0 }} />

            {/* ADD TagInput COMPONENT HERE */}
            <Box sx={{ mb: 2, flexShrink: 0 }}>
              <TagInput
                label="Tags"
                value={currentDialogTags}
                onChange={(newTags) => setCurrentDialogTags(newTags)} // newTags is an array of strings
                placeholder="Add relevant tags..."
              />
            </Box>

            <RichTextEditor
              content={currentStoryData.content || ''}
              onChange={(htmlContent) => setCurrentStoryData(prev => ({ ...prev, content: htmlContent }))}
              placeholder="Narrate the story here..."
              editorStyle={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '300px' }}
            />
            <Grid container spacing={2} alignItems="center" sx={{ mt: 2, flexShrink: 0 }}>
              <Grid item xs={12} sm={5}><FormControl fullWidth size="small" variant="outlined"><InputLabel>Parent Entry</InputLabel><Select label="Parent Entry" value={currentStoryData.parent_id || ''} onChange={(e) => setCurrentStoryData(prev => ({ ...prev, parent_id: e.target.value === '' ? null : parseInt(e.target.value) }))}><MenuItem value=""><em>None (Top Level)</em></MenuItem>{allStoryEntries.filter(e => (!isEditing || e.id !== currentStoryData.id) && !isDescendant(e, currentStoryData, allStoryEntries)).map(entry => (<MenuItem key={entry.id} value={entry.id}>{entry.title}</MenuItem>))}</Select></FormControl></Grid>
              <Grid item xs={12} sm={3}><MuiTextField margin="dense" id="sortOrder" label="Sort Order" type="number" fullWidth variant="outlined" size="small" value={currentStoryData.sort_order || '0'} onChange={(e) => setCurrentStoryData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))} /></Grid>
              <Grid item xs={12} sm={4}><FormControlLabel control={<Checkbox checked={!!currentStoryData.is_visible_to_players} onChange={(e) => setCurrentStoryData(prev => ({ ...prev, is_visible_to_players: e.target.checked }))} />} label="Visible to Players" sx={{ mt: 1 }} /></Grid>
            </Grid>
            {/* Show dialog-specific error for title/content validation */}
            {error && openStoryDialog && <Alert severity="error" sx={{ mt: 1, flexShrink: 0 }} onClose={() => setError(null)}>{error}</Alert>}
          </DialogContent>
          <DialogActions sx={{ pb: 2, pr: 2, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
            <Button onClick={handleCloseStoryDialog} color="inherit">Cancel</Button>
            <Button onClick={handleSaveStoryEntry} variant="contained" color="primary" disabled={actionLoading || !currentStoryData?.title?.trim()}>
              {actionLoading ? <CircularProgress size={20} color="inherit" /> : (isEditing ? 'Save Changes' : 'Create Entry')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {user?.role === 'DM' && entryToDelete && (<Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}><DialogTitle sx={{ fontFamily: '"Cinzel",serif' }}>Confirm Deletion</DialogTitle><DialogContent><DialogContentText>Are you sure you want to delete "{entryToDelete.title}"? This will also delete any child entries.</DialogContentText>{error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}</DialogContent><DialogActions sx={{ pb: 2, pr: 2 }}><Button onClick={handleCloseDeleteDialog} color="inherit" disabled={actionLoading}>Cancel</Button><Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={actionLoading}>{actionLoading ? <CircularProgress size={20} /> : "Delete"}</Button></DialogActions></Dialog>)}
    </Box>
  );
}

// isDescendant function (remains the same)
const isDescendant = (potentialParent, entryToEdit, allEntries) => { if (!entryToEdit || !entryToEdit.id || !potentialParent || !potentialParent.id) return false; if (potentialParent.id === entryToEdit.id) return true; let c = potentialParent; while (c.parent_id !== null) { if (c.parent_id === entryToEdit.id) return true; const p = allEntries.find(e => e.id === c.parent_id); if (!p) break; c = p; } return false; };

export default StoryPage;
