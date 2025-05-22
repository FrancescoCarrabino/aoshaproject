// src/pages/CharacterSheetPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Box, CircularProgress, Alert, Button } from '@mui/material';
import CharacterSheet from '../components/character/CharacterSheet'; // The main component
import { getCharacterSheetById } from '../services/apiService';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

function CharacterSheetPage() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [sheetData, setSheetData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSheet = async () => {
      if (!characterId) {
        setError("No character ID provided.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const data = await getCharacterSheetById(characterId);
        setSheetData(data.character_data); // We need the character_data object
      } catch (err) {
        console.error(`Failed to fetch character sheet ${characterId}:`, err);
        setError(err.error || `Could not load character sheet ${characterId}.`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSheet();
  }, [characterId]);

  const handleSaveSuccess = () => {
    // Optionally re-fetch or just show success message (CharacterSheet handles its own save status display)
    console.log("Sheet save reported as successful by child.");
  };

  const handleSaveError = (errorMessage) => {
    // Optionally display a page-level error too, though CharacterSheet has its own
    console.error("Sheet save reported as failed by child:", errorMessage);
    // setError(`Save failed: ${errorMessage}`); // Could be too noisy if CharacterSheet already shows it
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" sx={{ p: 3, height: 'calc(100vh - 120px)' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading Character Sheet...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  if (!sheetData) {
    // This case might be covered by error if API returns 404 and it's caught
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Character sheet not found or data is unavailable.</Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* The sheet name could be displayed as a title here if sheetData included it separately */}
      {/* <Typography variant="h4" gutterBottom>{sheetData.sheet_name || 'Character Sheet'}</Typography> */}
      <CharacterSheet
        sheetId={characterId}
        initialData={sheetData}
        onSaveSuccess={handleSaveSuccess}
        onSaveError={handleSaveError}
      />
    </Box>
  );
}

export default CharacterSheetPage;
