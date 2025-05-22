// src/components/character/sections/AbilitiesSection.jsx
import React from 'react';
import { ABILITY_SCORE_IDS } from '../../../utils/dndConstants'; // Adjust path
import { TextField, Checkbox, FormControlLabel, Grid, Typography, Paper, Box } from '@mui/material';

function AbilitiesSection({
  abilityScores,
  abilityModifiers,
  savingThrowProficiencies,
  savingThrows,
  proficiencyBonus,
  onAbilityScoreChange,
  onSavingThrowProfChange,
}) {
  return (
    <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Typography variant="h6" component="h3" gutterBottom sx={{ fontFamily: '"Cinzel", serif', textAlign: 'center' }}>
        Ability Scores & Saving Throws
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center" mb={2}>
        Proficiency Bonus: +{proficiencyBonus}
      </Typography>
      <Grid container spacing={2} justifyContent="center">
        {ABILITY_SCORE_IDS.map((id) => (
          <Grid item xs={6} sm={4} md={2} key={id}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Typography variant="button" component="h4" sx={{ textTransform: 'capitalize', fontWeight: 'bold', color: 'secondary.main' }}>
                {id}
              </Typography>
              <TextField
                type="number"
                aria-label={`${id} score`}
                value={abilityScores[id] || ''}
                onChange={(e) => onAbilityScoreChange(id, e.target.value)}
                inputProps={{ style: { textAlign: 'center', fontSize: '1.75rem', padding: '8px 0' }, min: 1, max: 30 }}
                variant="standard"
                sx={{ my: 0.5, width: '70px', '& .MuiInput-underline:before': { borderBottomColor: 'rgba(255,255,255,0.2)' } }}
              />
              <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', my: 0.5 }}>
                {abilityModifiers[id] >= 0 ? `+${abilityModifiers[id]}` : abilityModifiers[id]}
              </Typography>
              <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1, mt: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={savingThrowProficiencies[id] || false}
                      onChange={(e) => onSavingThrowProfChange(id, e.target.checked)}
                      color="primary"
                    />
                  }
                  label={<Typography variant="caption">Proficient</Typography>}
                  sx={{ ml: 0, mr: 0 }}
                />
                <Typography variant="body1" component="div">
                  Save: <Box component="span" sx={{ fontWeight: 'bold' }}>{savingThrows[id] >= 0 ? `+${savingThrows[id]}` : savingThrows[id]}</Box>
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}
export default AbilitiesSection;
