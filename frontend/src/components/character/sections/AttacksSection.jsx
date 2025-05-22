// src/components/character/sections/AttacksSection.jsx
import React from 'react';
import { TextField, Button, Grid, Typography, Paper, IconButton, Box } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';

function AttacksSection({
  attacks,
  onAttackChange,
  onAddAttack,
  onRemoveAttack,
}) {
  return (
    <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Typography variant="h6" component="h3" gutterBottom sx={{ fontFamily: '"Cinzel", serif', textAlign: 'center', mb: 2 }}>
        Attacks & Spellcasting
      </Typography>
      {attacks.map((attack, index) => (
        <Paper key={attack.id} variant="outlined" sx={{ p: 1.5, mb: 1.5, '&:last-child': { mb: 0 } }}>
          <Grid container spacing={1} alignItems="center">
            <Grid item xs={12} sm={5}>
              <TextField
                label="Attack Name"
                fullWidth
                variant="outlined"
                size="small"
                value={attack.name || ''}
                onChange={(e) => onAttackChange(index, 'name', e.target.value)}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                label="Atk Bonus"
                fullWidth
                variant="outlined"
                size="small"
                value={attack.atkBonus || ''}
                onChange={(e) => onAttackChange(index, 'atkBonus', e.target.value)}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                label="Damage/Type"
                fullWidth
                variant="outlined"
                size="small"
                value={attack.damage || ''}
                onChange={(e) => onAttackChange(index, 'damage', e.target.value)}
              />
            </Grid>
            {attacks.length > 1 && ( // Only show remove button if more than one attack
              <Grid item xs={12} sm="auto" sx={{ textAlign: { xs: 'right', sm: 'left' }, mt: { xs: 1, sm: 0 } }}>
                <IconButton onClick={() => onRemoveAttack(index)} color="error" size="small" aria-label="Remove attack">
                  <RemoveCircleOutlineIcon />
                </IconButton>
              </Grid>
            )}
          </Grid>
        </Paper>
      ))}
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<AddCircleOutlineIcon />}
          onClick={onAddAttack}
        >
          Add Attack
        </Button>
      </Box>
    </Paper>
  );
}
export default AttacksSection;
