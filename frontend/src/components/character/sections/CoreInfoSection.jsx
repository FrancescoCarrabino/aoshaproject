// src/components/character/sections/CoreInfoSection.jsx
import React from 'react';
import { TextField, Checkbox, FormControlLabel, Grid, Typography, Paper, IconButton } from '@mui/material';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';

function CoreInfoSection({ character, onInputChange, handlers, derivedValues }) {
  // Destructure the specific class change handler
  // This expects 'handlers' to be an object like { handleClassChange: function }
  const { handleClassChange } = handlers;
  const totalLevel = derivedValues.totalCharacterLevel;

  const clearSecondClass = () => {
    // Make sure handleClassChange is a function before calling
    if (typeof handleClassChange === 'function') {
      handleClassChange(1, 'className', '');
      handleClassChange(1, 'classLevel', '');
    } else {
      console.error("CoreInfoSection: handleClassChange is not a function in clearSecondClass");
    }
  };

  // Ensure onInputChange is a function before using it
  const handleGenericInputChange = (field, value, isNumeric = false, isCheckbox = false) => {
    if (typeof onInputChange === 'function') {
      onInputChange(field, value, isNumeric, isCheckbox);
    } else {
      console.error(`CoreInfoSection: onInputChange is not a function for field ${field}`);
    }
  };

  // Ensure handleClassChange is a function before using it
  const handleSpecificClassChange = (index, field, value) => {
    if (typeof handleClassChange === 'function') {
      handleClassChange(index, field, value);
    } else {
      console.error(`CoreInfoSection: handleClassChange is not a function for class ${index}, field ${field}`);
    }
  };


  return (
    <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Typography variant="h6" component="h3" gutterBottom sx={{ fontFamily: '"Cinzel", serif', textAlign: 'center', mb: 2 }}>
        Character Information
      </Typography>
      <Grid container spacing={2} alignItems="flex-end">
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Character Name" fullWidth variant="outlined" value={character.characterName || ''} onChange={(e) => handleGenericInputChange('characterName', e.target.value)} />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <TextField label="Class 1" fullWidth variant="outlined" value={character.classes[0]?.className || ''} onChange={(e) => handleSpecificClassChange(0, 'className', e.target.value)} />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <TextField label="Level 1" type="number" fullWidth variant="outlined" value={character.classes[0]?.classLevel || ''} onChange={(e) => handleSpecificClassChange(0, 'classLevel', e.target.value)} inputProps={{ min: 1 }} />
        </Grid>

        <Grid item xs={6} sm={3} md={3} sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', sm: 'center' }, pl: { xs: 1, sm: 0 }, pt: { xs: 2.5, sm: 0 } }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Total Lvl: {totalLevel}</Typography>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <TextField label="Class 2" fullWidth variant="outlined" value={character.classes[1]?.className || ''} onChange={(e) => handleSpecificClassChange(1, 'className', e.target.value)} helperText={!character.classes[1]?.className && character.classes[1]?.classLevel ? "Class name for Lvl 2" : ""} />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <TextField label="Level 2" type="number" fullWidth variant="outlined" value={character.classes[1]?.classLevel || ''} onChange={(e) => handleSpecificClassChange(1, 'classLevel', e.target.value)} inputProps={{ min: 1 }} />
        </Grid>
        <Grid item xs={6} sm={3} md={1} sx={{ display: 'flex', alignItems: 'center', pt: { xs: 2.5, sm: 0 } }}>
          {(character.classes[1]?.className || character.classes[1]?.classLevel) && (
            <IconButton onClick={clearSecondClass} color="error" size="small" title="Clear second class">
              <RemoveCircleOutlineIcon />
            </IconButton>
          )}
        </Grid>
        <Grid item xs={12} sm={6} md={6}></Grid> {/* Spacer for alignment */}


        <Grid item xs={12} sm={6} md={4}> <TextField label="Background" fullWidth variant="outlined" value={character.background || ''} onChange={(e) => handleGenericInputChange('background', e.target.value)} /> </Grid>
        <Grid item xs={12} sm={6} md={4}> <TextField label="Player Name" fullWidth variant="outlined" value={character.playerName || ''} onChange={(e) => handleGenericInputChange('playerName', e.target.value)} /> </Grid>
        <Grid item xs={12} sm={6} md={4}> <TextField label="Race" fullWidth variant="outlined" value={character.race || ''} onChange={(e) => handleGenericInputChange('race', e.target.value)} /> </Grid>
        <Grid item xs={12} sm={6} md={4}> <TextField label="Alignment" fullWidth variant="outlined" value={character.alignment || ''} onChange={(e) => handleGenericInputChange('alignment', e.target.value)} /> </Grid>
        <Grid item xs={12} sm={6} md={4}> <TextField label="Experience Points" type="number" fullWidth variant="outlined" value={character.experiencePoints === "" ? "" : Number(character.experiencePoints) || 0} onChange={(e) => handleGenericInputChange('experiencePoints', e.target.value, true)} /> </Grid>
        <Grid item xs={12} sm={6} md={4} sx={{ display: 'flex', alignItems: 'center' }}> <FormControlLabel control={<Checkbox checked={character.inspiration || false} onChange={(e) => handleGenericInputChange('inspiration', e.target.checked, false, true)} color="primary" />} label="Inspiration" /> </Grid>
      </Grid>
    </Paper>
  );
}
export default CoreInfoSection;
