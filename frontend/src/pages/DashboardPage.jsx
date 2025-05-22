// src/pages/DashboardPage.jsx
import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCharacterSheets, createCharacterSheet, deleteCharacterSheet } from '../services/apiService'; // Added deleteCharacterSheet
import {
  Typography,
  Button,
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemSecondaryAction, // For delete button
  Paper,
  Alert,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField as MuiTextField,
  Tooltip // For delete button tooltip
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ArticleIcon from '@mui/icons-material/Article';
import DeleteIcon from '@mui/icons-material/Delete'; // Delete icon

import { initialCharacterState } from '../components/character/CharacterSheet';

function DashboardPage() {
  const { user } = useAuth();
  const [sheets, setSheets] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // For initial sheet loading
  const [actionLoading, setActionLoading] = useState(false); // For create/delete actions
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');

  // State for delete confirmation
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [sheetToDelete, setSheetToDelete] = useState(null); // { id, name }

  const fetchSheets = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const fetchedSheets = await getCharacterSheets();
      setSheets(fetchedSheets);
    } catch (err) {
      console.error("Failed to fetch character sheets:", err);
      setError(err.error || 'Could not load character sheets.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSheets();
  }, [user]); // Re-fetch if user changes (e.g., after login)

  const handleOpenCreateDialog = () => {
    setNewSheetName(user && user.role === 'Player' ? `${user.username}'s Character` : 'New Character');
    setOpenCreateDialog(true);
  };

  const handleCloseCreateDialog = () => {
    setOpenCreateDialog(false);
    setNewSheetName('');
  };

  const handleCreateCharacter = async () => {
    if (!newSheetName.trim()) {
      setError("Sheet name cannot be empty.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const newSheetData = {
        sheet_name: newSheetName,
        character_data: { ...initialCharacterState, characterName: newSheetName }
      };
      const createdSheet = await createCharacterSheet(newSheetData);
      handleCloseCreateDialog();
      navigate(`/character/${createdSheet.id}`);
    } catch (err) {
      console.error("Failed to create character sheet:", err);
      setError(err.error || "Could not create character sheet.");
    } finally {
      setActionLoading(false);
    }
  };

  // --- Delete Sheet Logic ---
  const handleClickOpenDeleteDialog = (sheet) => {
    setSheetToDelete(sheet);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setSheetToDelete(null);
  };

  const handleDeleteSheet = async () => {
    if (!sheetToDelete) return;
    setActionLoading(true);
    setError(null);
    try {
      await deleteCharacterSheet(sheetToDelete.id);
      setSheets(prevSheets => prevSheets.filter(s => s.id !== sheetToDelete.id)); // Update UI immediately
      handleCloseDeleteDialog();
      // Optionally show a success snackbar/toast
    } catch (err) {
      console.error(`Failed to delete character sheet ${sheetToDelete.id}:`, err);
      setError(err.error || `Could not delete sheet "${sheetToDelete.sheet_name}".`);
      // Keep dialog open to show error or close it
      // handleCloseDeleteDialog(); 
    } finally {
      setActionLoading(false);
    }
  };


  if (isLoading && sheets.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" sx={{ p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, backgroundColor: 'background.paper' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" sx={{ fontFamily: '"Cinzel", serif' }}>
          {user?.username}'s Dashboard
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutlineIcon />}
          onClick={handleOpenCreateDialog}
          disabled={actionLoading}
        >
          New Character
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}

      {sheets.length === 0 && !isLoading && (
        <Typography variant="subtitle1" color="text.secondary" textAlign="center" sx={{ mt: 3 }}>
          You have no character sheets yet. Create one to get started!
        </Typography>
      )}

      {sheets.length > 0 && (
        <List>
          {sheets.map((sheet) => (
            <ListItem
              key={sheet.id}
              disablePadding
              sx={{
                mb: 1,
                '&:hover': { backgroundColor: 'action.hover' },
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}
              secondaryAction={ // Use secondaryAction for items at the end of ListItem
                <Tooltip title="Delete Sheet">
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleClickOpenDeleteDialog(sheet)}
                    disabled={actionLoading}
                    color="error" // Use error color for delete
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              }
            >
              <ListItemButton component={RouterLink} to={`/character/${sheet.id}`} sx={{ pr: '56px' /* Add padding to avoid overlap with secondary action */ }}>
                <IconButton edge="start" sx={{ mr: 2, color: 'secondary.main' }} aria-hidden="true">
                  <ArticleIcon />
                </IconButton>
                <ListItemText
                  primary={sheet.sheet_name}
                  secondary={`Last updated: ${new Date(sheet.updated_at).toLocaleDateString()}`}
                  primaryTypographyProps={{ fontWeight: 'medium' }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}

      {/* Create New Character Dialog */}
      <Dialog open={openCreateDialog} onClose={handleCloseCreateDialog} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontFamily: '"Cinzel", serif' }}>Create New Character Sheet</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Enter a name for your new character sheet.
          </DialogContentText>
          <MuiTextField
            autoFocus
            margin="dense"
            id="sheetName"
            label="Sheet Name"
            type="text"
            fullWidth
            variant="outlined"
            value={newSheetName}
            onChange={(e) => setNewSheetName(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter' && newSheetName.trim()) handleCreateCharacter(); }}
          />
        </DialogContent>
        <DialogActions sx={{ pb: 2, pr: 2 }}>
          <Button onClick={handleCloseCreateDialog} color="inherit">Cancel</Button>
          <Button onClick={handleCreateCharacter} variant="contained" color="primary" disabled={actionLoading || !newSheetName.trim()}>
            {actionLoading ? <CircularProgress size={20} color="inherit" /> : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={handleCloseDeleteDialog}
        aria-labelledby="alert-dialog-delete-title"
        aria-describedby="alert-dialog-delete-description"
      >
        <DialogTitle id="alert-dialog-delete-title" sx={{ fontFamily: '"Cinzel", serif' }}>
          Confirm Deletion
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-delete-description">
            Are you sure you want to delete the character sheet "{sheetToDelete?.sheet_name || 'this sheet'}"? This action cannot be undone.
          </DialogContentText>
          {error && sheetToDelete && ( // Show error within the dialog if delete fails
            <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ pb: 2, pr: 2 }}>
          <Button onClick={handleCloseDeleteDialog} color="inherit" disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={handleDeleteSheet} color="error" variant="contained" autoFocus disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={20} color="inherit" /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default DashboardPage;
