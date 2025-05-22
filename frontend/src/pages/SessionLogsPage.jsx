// src/pages/SessionLogsPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getSessionLogs, createSessionLog, updateSessionLog, deleteSessionLog
} from '../services/apiService';
import {
  Typography, Box, CircularProgress, Alert, Button, Paper,
  IconButton, Divider, Fab,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  TextField as MuiTextField, Chip // Added Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RichTextEditor from '../components/ui/RichTextEditor';
import TagInput from '../components/ui/TagInput'; // IMPORT TAGINPUT

// SessionLogItem Component
function SessionLogItem({ log, onEdit, onDelete, currentUser }) {
  const canEdit = currentUser?.id === log.author_user_id || currentUser?.role === 'DM';
  const canDelete = currentUser?.role === 'DM';

  const formattedDate = log.session_date ? new Date(log.session_date).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' // Ensure UTC if dates are stored as such
  }) : 'Date not set';

  return (
    <Paper variant="outlined" sx={{ mb: 2.5, p: { xs: 1.5, sm: 2.5 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Box>
          <Typography variant="h5" component="h3" gutterBottom sx={{ fontFamily: '"Cinzel Decorative", serif' }}>
            {log.title || `Session: ${formattedDate}`}
          </Typography>
          {log.title && <Typography variant="body2" color="text.secondary" display="block" sx={{ mt: -1, mb: 0.5 }}>Date: {formattedDate}</Typography>}
          <Typography variant="caption" color="text.secondary"> Authored by: {log.author_username || "Unknown"} {log.created_at && ` on ${new Date(log.created_at).toLocaleDateString()}`} </Typography>
          {log.updated_at && log.updated_at !== log.created_at && (<Typography variant="caption" color="text.secondary" display="block" sx={{ fontStyle: 'italic' }}> Last updated: {new Date(log.updated_at).toLocaleDateString()} </Typography>)}
        </Box>
        <Box sx={{ whiteSpace: 'nowrap' }}>
          {canEdit && (<IconButton onClick={() => onEdit(log)} size="small" sx={{ mr: 0.5 }} title="Edit Log"> <EditIcon fontSize="small" /> </IconButton>)}
          {canDelete && (<IconButton onClick={() => onDelete(log)} size="small" color="error" title="Delete Log"> <DeleteIcon fontSize="small" /> </IconButton>)}
        </Box>
      </Box>
      <Divider sx={{ my: 1.5 }} />

      {/* DISPLAY SESSION LOG TAGS */}
      {log.tags && log.tags.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
          {log.tags.map((tag) => (
            <Chip key={tag.id || tag.name} label={tag.name} size="small" variant="outlined" />
          ))}
        </Box>
      )}

      <Box className="tiptap-display-content" sx={{ /* ... your styles ... */ whiteSpace: 'normal' }} dangerouslySetInnerHTML={{ __html: log.summary || '<p><em>No summary provided.</em></p>' }} />
    </Paper>
  );
}

function SessionLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null); // Page level error
  const [dialogError, setDialogError] = useState(null); // Dialog specific error
  const [actionLoading, setActionLoading] = useState(false);

  const [openLogDialog, setOpenLogDialog] = useState(false);
  const [currentLogData, setCurrentLogData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  // NEW STATE FOR TAGS IN DIALOG
  const [currentDialogLogTags, setCurrentDialogLogTags] = useState([]);

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [logToDelete, setLogToDelete] = useState(null);

  // State for tag filtering
  const [filterByLogTags, setFilterByLogTags] = useState([]);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Pass filterByLogTags (array of names) to getSessionLogs API call
      const fetchedLogs = await getSessionLogs(filterByLogTags.map(tag => typeof tag === 'object' ? tag.name : tag));
      setLogs(fetchedLogs);
    } catch (err) {
      setError(err.error || 'Could not load session logs.');
    } finally {
      setIsLoading(false);
    }
  }, [filterByLogTags]); // Added filterByLogTags

  useEffect(() => {
    if (user) fetchLogs();
  }, [user, fetchLogs]); // fetchLogs now depends on filterByLogTags

  const handleOpenCreateDialog = () => {
    setIsEditing(false);
    setCurrentLogData({ title: '', summary: '', session_date: new Date().toISOString().split('T')[0] });
    setCurrentDialogLogTags([]); // Reset tags
    setDialogError(null);
    setOpenLogDialog(true);
  };

  const handleOpenEditDialog = (log) => {
    setIsEditing(true);
    setCurrentLogData({ ...log, session_date: log.session_date ? new Date(log.session_date).toISOString().split('T')[0] : '' });
    // Initialize dialog tags from log.tags
    setCurrentDialogLogTags(log.tags ? log.tags.map(tag => tag.name) : []);
    setDialogError(null);
    setOpenLogDialog(true);
  };

  const handleCloseLogDialog = () => { setOpenLogDialog(false); setCurrentLogData(null); setCurrentDialogLogTags([]); setDialogError(null); };

  const handleSaveLog = async () => {
    if (!currentLogData || !currentLogData.session_date) { setDialogError("Session date is required."); return; }
    const plainTextSummary = currentLogData.summary?.replace(/<[^>]*>/g, '').trim();
    if (!plainTextSummary) { setDialogError("Summary cannot be empty."); return; }

    setActionLoading(true);
    setDialogError(null);

    const payload = {
      title: currentLogData.title || null,
      summary: currentLogData.summary,
      session_date: currentLogData.session_date,
      tags: currentDialogLogTags, // Include array of tag name strings
    };

    try {
      let savedLog;
      if (isEditing) {
        // Remove non-updatable fields or fields managed by backend from payload if necessary
        const updatePayload = { ...payload };
        // delete updatePayload.id; // id is in URL
        // delete updatePayload.author_user_id; // usually not changed by user
        // delete updatePayload.author_username; 
        // delete updatePayload.created_at;
        // delete updatePayload.updated_at;
        savedLog = await updateSessionLog(currentLogData.id, updatePayload);
        // setLogs(prevLogs => prevLogs.map(l => l.id === savedLog.id ? savedLog : l)); // fetchLogs will refresh
      } else {
        savedLog = await createSessionLog(payload);
        // setLogs(prevLogs => [savedLog, ...prevLogs].sort((a, b) => new Date(b.session_date) - new Date(a.session_date)));
      }
      await fetchLogs(); // Re-fetch to get latest data including any server-side changes to tags/timestamps
      handleCloseLogDialog();
    } catch (err) {
      setDialogError(err.error || "Could not save session log.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClickOpenDeleteDialog = (log) => { /* ... (remains the same) ... */ setLogToDelete(log); setOpenDeleteDialog(true); setDialogError(null); };
  const handleCloseDeleteDialog = () => { /* ... (remains the same) ... */ setLogToDelete(null); setOpenDeleteDialog(false); setDialogError(null); };
  const handleDeleteConfirm = async () => { /* ... (remains the same) ... */ if (!logToDelete) return; setActionLoading(true); setError(null); try { await deleteSessionLog(logToDelete.id); setLogs(prevLogs => prevLogs.filter(l => l.id !== logToDelete.id)); handleCloseDeleteDialog(); } catch (err) { setError(err.error || "Could not delete."); } finally { setActionLoading(false); } };

  if (isLoading && logs.length === 0) { return <Box display="flex" justifyContent="center" alignItems="center" sx={{ p: 3 }}><CircularProgress /></Box>; }

  return (
    <Box sx={{ position: 'relative', pb: '80px' }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontFamily: '"Cinzel", serif', mb: 3, textAlign: 'center' }}> Session Logs </Typography>

      {/* Tag Filter Input for Session Log List */}
      <Box sx={{ mb: 2, maxWidth: 500, mx: 'auto' }}>
        <TagInput
          label="Filter Logs by Tags"
          value={filterByLogTags.map(tag => typeof tag === 'object' ? tag.name : tag)}
          onChange={(newTags) => setFilterByLogTags(newTags)} // newTags are strings
          placeholder="Filter by tags..."
        />
      </Box>

      {error && !openLogDialog && !openDeleteDialog && (<Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>)}
      {logs.length === 0 && !isLoading && (<Typography color="text.secondary" textAlign="center" sx={{ mt: 5 }}> No session logs yet. Be the first to add one! </Typography>)}
      {logs.map(log => (<SessionLogItem key={log.id} log={log} onEdit={handleOpenEditDialog} onDelete={handleClickOpenDeleteDialog} currentUser={user} />))}
      {user && (<Fab color="primary" aria-label="add session log" onClick={handleOpenCreateDialog} sx={{ position: 'fixed', bottom: { xs: 72, sm: 32 }, right: { xs: 16, sm: 32 } }}> <AddIcon /> </Fab>)}

      {currentLogData && (
        <Dialog open={openLogDialog} onClose={handleCloseLogDialog} fullWidth maxWidth="md" PaperProps={{ sx: { height: '85vh' } }}>
          <DialogTitle sx={{ fontFamily: '"Cinzel", serif', borderBottom: 1, borderColor: 'divider' }}>{isEditing ? 'Edit Session Log' : 'New Session Log'}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', pt: '20px !important', pb: 1, overflowY: 'hidden' }}>
            <MuiTextField autoFocus margin="dense" id="session_date" label="Session Date" type="date" fullWidth variant="outlined" value={currentLogData.session_date} onChange={(e) => setCurrentLogData(prev => ({ ...prev, session_date: e.target.value }))} InputLabelProps={{ shrink: true }} sx={{ mb: 1, flexShrink: 0 }} />
            <MuiTextField margin="dense" id="title" label="Title (Optional)" type="text" fullWidth variant="outlined" value={currentLogData.title || ''} onChange={(e) => setCurrentLogData(prev => ({ ...prev, title: e.target.value }))} sx={{ mb: 1, flexShrink: 0 }} />

            {/* ADD TagInput FOR SESSION LOG DIALOG */}
            <Box sx={{ mb: 2, flexShrink: 0 }}>
              <TagInput
                label="Session Tags"
                value={currentDialogLogTags}
                onChange={(newTags) => setCurrentDialogLogTags(newTags)}
                placeholder="Add relevant tags..."
              />
            </Box>

            <RichTextEditor content={currentLogData.summary || ''} onChange={(htmlContent) => setCurrentLogData(prev => ({ ...prev, summary: htmlContent }))} placeholder="Write the session recap here..." editorStyle={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '250px' }} />
            {dialogError && <Alert severity="error" sx={{ mt: 1, flexShrink: 0 }} onClose={() => setDialogError(null)}>{dialogError}</Alert>}
          </DialogContent>
          <DialogActions sx={{ pb: 2, pr: 2, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
            <Button onClick={handleCloseLogDialog} color="inherit">Cancel</Button>
            <Button onClick={handleSaveLog} variant="contained" color="primary" disabled={actionLoading || !currentLogData?.summary?.replace(/<[^>]*>/g, '').trim() || !currentLogData?.session_date}>
              {actionLoading ? <CircularProgress size={20} color="inherit" /> : (isEditing ? 'Save Changes' : 'Create Log')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {logToDelete && (<Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}><DialogTitle sx={{ fontFamily: '"Cinzel",serif' }}>Confirm Deletion</DialogTitle><DialogContent><DialogContentText>Are you sure you want to delete this session log {logToDelete.title ? `titled "${logToDelete.title}"` : `from ${new Date(logToDelete.session_date).toLocaleDateString()}`}?</DialogContentText>{dialogError && <Alert severity="error" sx={{ mt: 1 }}>{dialogError}</Alert>}</DialogContent><DialogActions sx={{ pb: 2, pr: 2 }}><Button onClick={handleCloseDeleteDialog} color="inherit" disabled={actionLoading}>Cancel</Button><Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={actionLoading}>{actionLoading ? <CircularProgress size={20} /> : "Delete"}</Button></DialogActions></Dialog>)}
    </Box>
  );
}

export default SessionLogsPage;
