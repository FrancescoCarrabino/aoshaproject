// src/components/character/sections/CharacterDetailsSection.jsx
import React from 'react';
import { TextField, Grid, Typography, Paper } from '@mui/material';

function CharacterDetailsSection({
  character,
  onInputChange,
}) {
  const detailFields = [
    { id: 'personalityTraits', label: 'Personality Traits', rows: 5 },
    { id: 'ideals', label: 'Ideals', rows: 5 },
    { id: 'bonds', label: 'Bonds', rows: 5 },
    { id: 'flaws', label: 'Flaws', rows: 5 },
  ];

  const largeDetailFields = [
    { id: 'featuresAndTraits', label: 'Features & Traits', rows: 8 },
    { id: 'otherProficienciesAndLanguages', label: 'Other Proficiencies & Languages', rows: 5 },
  ];

  return (
    <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Typography variant="h6" component="h3" gutterBottom sx={{ fontFamily: '"Cinzel", serif', textAlign: 'center', mb: 2 }}>
        Character Details
      </Typography>
      <Grid container spacing={3}>
        {detailFields.map(field => (
          <Grid item xs={12} sm={6} key={field.id}>
            <TextField
              label={field.label}
              fullWidth
              multiline
              rows={field.rows}
              variant="outlined"
              value={character[field.id] || ''}
              onChange={(e) => onInputChange(field.id, e.target.value)}
            />
          </Grid>
        ))}
        {largeDetailFields.map(field => (
          <Grid item xs={12} key={field.id}>
            <TextField
              label={field.label}
              fullWidth
              multiline
              rows={field.rows}
              variant="outlined"
              value={character[field.id] || ''}
              onChange={(e) => onInputChange(field.id, e.target.value)}
            />
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}
export default CharacterDetailsSection;
