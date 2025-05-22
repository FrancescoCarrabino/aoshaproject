// src/components/character/sections/SpellsSection.jsx
import React, { useState, useEffect } from 'react'; // Added useEffect
import {
  TextField, Button, Grid, Typography, Paper, Box, IconButton,
  Select, MenuItem, FormControl, InputLabel, Checkbox, Divider,
  Accordion, AccordionSummary, AccordionDetails, Tooltip, FormControlLabel
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ABILITY_SCORE_IDS } from '../../../utils/dndConstants';

const SCHOOLS_OF_MAGIC = [ /* ... same as before ... */ "Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation", "Universal"];

function SpellsSection({
  spellcastingData, spellSaveDC, spellAttackBonus, handlers,
  newlyAddedSpellId, // New prop
  onClearNewlyAddedSpellId // New prop
}) {
  const { handleSpellcastingInfoChange, handleSpellSlotChange, handleSpellChange, addSpell, removeSpell } = handlers;
  const spellLevels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const spellsByLevel = spellLevels.map(level => ({
    level,
    spells: (spellcastingData.spells || []).filter(spell => parseInt(spell.level) === level).sort((a, b) => (a.name || "").localeCompare(b.name || ""))
  }));

  const [expandedLevelAccordion, setExpandedLevelAccordion] = useState(false);
  const [expandedSpellDetails, setExpandedSpellDetails] = useState({});

  // EFFECT for auto-expanding newly added spell
  useEffect(() => {
    if (newlyAddedSpellId) {
      // Find the level of the newly added spell
      const newSpell = (spellcastingData.spells || []).find(s => s.id === newlyAddedSpellId);
      if (newSpell) {
        setExpandedLevelAccordion(parseInt(newSpell.level, 10)); // Expand its level accordion
        setExpandedSpellDetails(prev => ({ ...prev, [newlyAddedSpellId]: true })); // Expand its details
      }
      onClearNewlyAddedSpellId(); // Clear the prop in the parent so this doesn't re-trigger
    }
  }, [newlyAddedSpellId, onClearNewlyAddedSpellId, spellcastingData.spells]);


  const handleAccordionChange = (level) => (event, isExpanded) => setExpandedLevelAccordion(isExpanded ? level : false);
  const toggleSpellDetails = (spellId) => setExpandedSpellDetails(prev => ({ ...prev, [spellId]: !prev[spellId] }));

  const renderSpellFields = (spell, originalIndex) => ( /* ... same as previous complete version ... */
    <Box sx={{ borderTop: 1, borderColor: 'divider', mt: 1.5, pt: 1.5 }}>
      <Grid container spacing={1.5}>
        <Grid item xs={12} sm={6} md={4}><TextField fullWidth label="Casting Time" size="small" variant="outlined" value={spell.castingTime || ''} onChange={(e) => handleSpellChange(originalIndex, 'castingTime', e.target.value)} /></Grid>
        <Grid item xs={12} sm={6} md={4}><TextField fullWidth label="Range" size="small" variant="outlined" value={spell.range || ''} onChange={(e) => handleSpellChange(originalIndex, 'range', e.target.value)} /></Grid>
        <Grid item xs={12} sm={6} md={4}><TextField fullWidth label="Components" size="small" variant="outlined" value={spell.components || ''} onChange={(e) => handleSpellChange(originalIndex, 'components', e.target.value)} helperText="e.g., V, S, M (desc)" /></Grid>
        <Grid item xs={12} sm={6} md={4}><TextField fullWidth label="Duration" size="small" variant="outlined" value={spell.duration || ''} onChange={(e) => handleSpellChange(originalIndex, 'duration', e.target.value)} /></Grid>
        <Grid item xs={12} sm={6} md={4}><FormControl fullWidth size="small" variant="outlined"><InputLabel id={`school-label-${spell.id}`}>School</InputLabel><Select labelId={`school-label-${spell.id}`} label="School" value={spell.school || ''} onChange={(e) => handleSpellChange(originalIndex, 'school', e.target.value)}><MenuItem value=""><em>None</em></MenuItem>{SCHOOLS_OF_MAGIC.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}</Select></FormControl></Grid>
        <Grid item xs={12} sm={6} md={4} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', pt: { xs: 1, sm: 0 } }}><FormControlLabel control={<Checkbox size="small" checked={spell.ritual || false} onChange={(e) => handleSpellChange(originalIndex, 'ritual', e.target.checked)} />} label="Ritual" /><FormControlLabel control={<Checkbox size="small" checked={spell.concentration || false} onChange={(e) => handleSpellChange(originalIndex, 'concentration', e.target.checked)} />} label="Conc." /></Grid>
        <Grid item xs={12}><TextField fullWidth label="Description" size="small" multiline rows={3} variant="outlined" value={spell.description || ''} onChange={(e) => handleSpellChange(originalIndex, 'description', e.target.value)} /></Grid>
        <Grid item xs={12}><TextField fullWidth label="At Higher Levels" size="small" multiline rows={2} variant="outlined" value={spell.higherLevels || ''} onChange={(e) => handleSpellChange(originalIndex, 'higherLevels', e.target.value)} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth label="Source" size="small" variant="outlined" value={spell.source || ''} onChange={(e) => handleSpellChange(originalIndex, 'source', e.target.value)} /></Grid>
        <Grid item xs={12} sm={6}><TextField fullWidth label="Page #" size="small" variant="outlined" value={spell.page || ''} onChange={(e) => handleSpellChange(originalIndex, 'page', e.target.value)} /></Grid>
      </Grid>
    </Box>
  );

  return ( /* ... MUI structure for SpellsSection, same as the previous complete version, using renderSpellFields ... */
    <Paper elevation={2} sx={{ p: { xs: 1, sm: 2 }, mb: 3 }}>
      <Typography variant="h6" component="h3" gutterBottom sx={{ fontFamily: '"Cinzel", serif', textAlign: 'center', mb: 2 }}>Spellcasting</Typography>
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={12} sm={6} md={4}> <TextField label="Spellcasting Class" fullWidth variant="outlined" size="small" value={spellcastingData.spellcastingClass || ''} onChange={(e) => handleSpellcastingInfoChange('spellcastingClass', e.target.value)} /> </Grid>
          <Grid item xs={12} sm={6} md={3}> <FormControl fullWidth size="small" variant="outlined"> <InputLabel>Spellcasting Ability</InputLabel> <Select label="Spellcasting Ability" value={spellcastingData.spellcastingAbility || 'intelligence'} onChange={(e) => handleSpellcastingInfoChange('spellcastingAbility', e.target.value)}> {ABILITY_SCORE_IDS.map(ability => (<MenuItem key={ability} value={ability}> {ability.charAt(0).toUpperCase() + ability.slice(1)} </MenuItem>))} </Select> </FormControl> </Grid>
          <Grid item xs={6} sm={3} md={2.5} sx={{ textAlign: 'center', pb: 0.5 }}> <Typography variant="caption" display="block" color="text.secondary">Save DC</Typography> <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{spellSaveDC}</Typography> </Grid>
          <Grid item xs={6} sm={3} md={2.5} sx={{ textAlign: 'center', pb: 0.5 }}> <Typography variant="caption" display="block" color="text.secondary">Attack Bonus</Typography> <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{spellAttackBonus >= 0 ? `+${spellAttackBonus}` : spellAttackBonus}</Typography> </Grid>
        </Grid>
      </Paper>
      {spellLevels.map((level) => (
        <Accordion key={`level-${level}-accordion`} expanded={expandedLevelAccordion === level} onChange={handleAccordionChange(level)} disableGutters elevation={0} sx={{ mb: 0.5, border: 1, borderColor: 'divider', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls={`level-${level}-content`} id={`level-${level}-header`} sx={{ backgroundColor: level === expandedLevelAccordion ? 'action.focus' : 'action.hover', minHeight: '48px', '&.Mui-expanded': { minHeight: '48px' } }}>
            <Grid container alignItems="center" spacing={1} onClick={(e) => e.stopPropagation()}>
              <Grid item xs={12} sm={level === 0 ? 12 : 4} md={level === 0 ? 12 : 3}><Typography sx={{ fontWeight: 'medium', cursor: 'pointer' }} onClick={() => handleAccordionChange(level)(null, !(expandedLevelAccordion === level))}>{level === 0 ? 'Cantrips' : `Level ${level} Spells`}</Typography></Grid>
              {level > 0 && (<Grid item xs={12} sm={8} md={9} sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', sm: 'flex-end' }, gap: 0.5, flexWrap: 'wrap' }}><Typography variant="caption" sx={{ mr: 0.5 }}>Slots:</Typography><TextField type="number" size="small" variant="outlined" inputProps={{ style: { textAlign: 'center', padding: '6.5px 8px' }, min: 0 }} sx={{ width: '55px' }} value={spellcastingData.spellSlots[level]?.expended || '0'} onClick={(e) => e.stopPropagation()} onChange={(e) => handleSpellSlotChange(level, 'expended', e.target.value)} /><Typography variant="body2" sx={{ mx: 0.5 }}>/</Typography><TextField type="number" size="small" variant="outlined" inputProps={{ style: { textAlign: 'center', padding: '6.5px 8px' }, min: 0 }} sx={{ width: '55px' }} value={spellcastingData.spellSlots[level]?.total || '0'} onClick={(e) => e.stopPropagation()} onChange={(e) => handleSpellSlotChange(level, 'total', e.target.value)} /></Grid>)}
            </Grid>
          </AccordionSummary>
          <AccordionDetails sx={{ p: { xs: 1, sm: 1.5 }, backgroundColor: 'background.default' }}>
            {(spellsByLevel.find(sbl => sbl.level === level)?.spells || []).map((spell) => {
              const oI = (spellcastingData.spells || []).findIndex(s => s.id === spell.id); if (oI === -1) return null; return (
                <Paper key={spell.id} variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
                  <Grid container spacing={1} alignItems="center">
                    {level > 0 && (<Grid item xs="auto"><Tooltip title="Prepared"><Checkbox sx={{ p: 0.5 }} size="small" checked={spell.prepared || false} onChange={(e) => handleSpellChange(oI, 'prepared', e.target.checked)} /></Tooltip></Grid>)}
                    <Grid item xs><TextField fullWidth label="Spell Name" size="small" variant="outlined" value={spell.name || ''} onChange={(e) => handleSpellChange(oI, 'name', e.target.value)} /></Grid>
                    <Grid item xs="auto"><Button size="small" variant="text" onClick={() => toggleSpellDetails(spell.id)} sx={{ mr: 0.5, minWidth: 'auto', p: '4px 8px' }}>{expandedSpellDetails[spell.id] ? "Hide" : "Details"}</Button><IconButton onClick={() => removeSpell(oI)} color="error" size="small" title="Remove spell"><RemoveCircleOutlineIcon /></IconButton></Grid>
                  </Grid>
                  {expandedSpellDetails[spell.id] && renderSpellFields(spell, oI)}
                </Paper>
              );
            })}
            <Box sx={{ textAlign: 'center', mt: 1.5 }}><Button size="small" variant="outlined" color="secondary" startIcon={<AddCircleOutlineIcon />} onClick={() => addSpell(level)}>Add {level === 0 ? 'Cantrip' : `Level ${level} Spell`}</Button></Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Paper>
  );
}
export default SpellsSection;
