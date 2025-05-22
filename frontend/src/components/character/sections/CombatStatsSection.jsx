// src/components/character/sections/CombatStatsSection.jsx
import React from 'react';
import { TextField, Checkbox, FormControlLabel, Grid, Typography, Paper, Box, IconButton } from '@mui/material';
// import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'; // for death save success
// import HeartBrokenOutlinedIcon from '@mui/icons-material/HeartBrokenOutlined'; // for death save failure

function CombatStatsSection({
  character,
  initiative,
  onInputChange,
  onDeathSaveChange,
}) {
  const statBoxStyle = { p: 1.5, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' };
  const statLabelStyle = { typography: 'caption', color: 'text.secondary', mb: 0.5 };
  const statValueStyle = { typography: 'h5', fontWeight: 'bold' };
  const inputStyle = { width: '70px', textAlign: 'center', '& input': { textAlign: 'center' } };


  return (
    <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Typography variant="h6" component="h3" gutterBottom sx={{ fontFamily: '"Cinzel", serif', textAlign: 'center', mb: 2 }}>
        Combat Information
      </Typography>
      <Grid container spacing={2} alignItems="stretch">
        {/* AC, Initiative, Speed */}
        <Grid item xs={4} sm={4}> <Paper variant="outlined" sx={statBoxStyle}> <Typography sx={statLabelStyle}>Armor Class</Typography> <TextField variant="standard" type="number" sx={inputStyle} InputProps={{ sx: { fontSize: 'h5.fontSize', fontWeight: 'bold' } }} value={character.armorClass || ''} onChange={(e) => onInputChange('armorClass', e.target.value, true)} /> </Paper> </Grid>
        <Grid item xs={4} sm={4}> <Paper variant="outlined" sx={statBoxStyle}> <Typography sx={statLabelStyle}>Initiative</Typography> <Typography sx={statValueStyle}>{initiative >= 0 ? `+${initiative}` : initiative}</Typography> </Paper> </Grid>
        <Grid item xs={4} sm={4}> <Paper variant="outlined" sx={statBoxStyle}> <Typography sx={statLabelStyle}>Speed</Typography> <TextField variant="standard" sx={inputStyle} InputProps={{ sx: { fontSize: 'h5.fontSize', fontWeight: 'bold' } }} value={character.speed || ''} onChange={(e) => onInputChange('speed', e.target.value)} /> </Paper> </Grid>

        {/* Hit Points */}
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
            <Typography sx={statLabelStyle}>Hit Points</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 1 }}>
              <TextField label="Current" variant="outlined" size="small" type="number" sx={{ width: '80px' }} value={character.currentHp || ''} onChange={(e) => onInputChange('currentHp', e.target.value, true)} />
              <Typography>/</Typography>
              <TextField label="Max" variant="outlined" size="small" type="number" sx={{ width: '80px' }} value={character.maxHp || ''} onChange={(e) => onInputChange('maxHp', e.target.value, true)} />
            </Box>
            <TextField label="Temporary HP" variant="outlined" size="small" type="number" sx={{ width: '120px', mt: 1.5 }} value={character.temporaryHp || ''} onChange={(e) => onInputChange('temporaryHp', e.target.value, true)} />
          </Paper>
        </Grid>

        {/* Hit Dice & Death Saves */}
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Hit Dice:</Typography>
              <Box>
                <TextField variant="outlined" size="small" sx={{ width: '80px', mr: 0.5 }} placeholder="e.g. 1d8" value={character.hitDiceTotal || ''} onChange={(e) => onInputChange('hitDiceTotal', e.target.value)} />
                <TextField variant="outlined" size="small" type="number" sx={{ width: '60px' }} placeholder="Current" value={character.hitDiceCurrent || ''} onChange={(e) => onInputChange('hitDiceCurrent', e.target.value, true)} />
              </Box>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" component="div" sx={{ mb: 0.5 }}>Death Saves</Typography>
              <Box>
                <Typography variant="caption" sx={{ mr: 0.5 }}>Successes:</Typography>
                {character.deathSaves.successes.map((checked, index) => (<Checkbox key={`ds-succ-${index}`} size="small" checked={checked} onChange={(e) => onDeathSaveChange('successes', index, e.target.checked)} />))}
              </Box>
              <Box>
                <Typography variant="caption" sx={{ mr: 1.5 }}>Failures:</Typography>
                {character.deathSaves.failures.map((checked, index) => (<Checkbox key={`ds-fail-${index}`} size="small" checked={checked} onChange={(e) => onDeathSaveChange('failures', index, e.target.checked)} />))}
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Paper>
  );
}
export default CombatStatsSection;
