// src/components/character/sections/EquipmentSection.jsx
import React from 'react';
import { TextField, Grid, Typography, Paper, Box } from '@mui/material';

function EquipmentSection({
  currency,
  equipmentList,
  onCurrencyChange,
  onInputChange,
}) {
  const currencyTypes = ['cp', 'sp', 'ep', 'gp', 'pp'];

  return (
    <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Typography variant="h6" component="h3" gutterBottom sx={{ fontFamily: '"Cinzel", serif', textAlign: 'center', mb: 2 }}>
        Equipment & Currency
      </Typography>
      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'medium', mb: 1 }}>Currency</Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {currencyTypes.map(type => (
          <Grid item xs={6} sm key={type} sx={{ minWidth: '80px' }}> {/* sm makes them distribute space */}
            <TextField
              label={type.toUpperCase()}
              type="number"
              fullWidth
              variant="outlined"
              size="small"
              value={currency[type] || ''}
              onChange={(e) => onCurrencyChange(type, e.target.value)}
            />
          </Grid>
        ))}
      </Grid>
      <TextField
        label="Equipment List"
        fullWidth
        multiline
        rows={8}
        variant="outlined"
        value={equipmentList || ''}
        onChange={(e) => onInputChange('equipmentList', e.target.value)}
        placeholder="List your equipment, treasure, and other items here..."
      />
    </Paper>
  );
}
export default EquipmentSection;
