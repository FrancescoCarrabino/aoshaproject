// src/components/character/sections/SkillsSection.jsx
import React from 'react';
import { SKILL_LIST } from '../../../utils/dndConstants';
import { Checkbox, Grid, Typography, Paper, Box, FormControlLabel, TextField } from '@mui/material';

function SkillsSection({
  skillProficiencies,
  skills, // calculated skill values (already includes misc mod)
  passivePerception,
  onSkillProfChange,
  skillMiscModifiers,
  onSkillMiscModifierChange,
}) {
  return (
    <>
      <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Typography variant="h6" component="h3" gutterBottom sx={{ fontFamily: '"Cinzel", serif', textAlign: 'center', mb: 2 }}>
          Skills
        </Typography>
        <Grid container spacing={1}>
          {SKILL_LIST.map((skillInfo) => (
            <Grid item xs={12} sm={6} key={skillInfo.id}>
              <Paper variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      id={`skill-prof-${skillInfo.id}`}
                      checked={skillProficiencies[skillInfo.id] || false}
                      onChange={(e) => onSkillProfChange(skillInfo.id, e.target.checked)}
                      color="primary"
                      sx={{ p: '4px' }}
                    />
                  }
                  label={
                    <>
                      {skillInfo.name}
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                        ({skillInfo.baseAbility.substring(0, 3).toUpperCase()})
                      </Typography>
                    </>
                  }
                  sx={{ flexGrow: 1, mr: 0.5 }}
                />
                <TextField
                  type="number"
                  size="small"
                  variant="outlined"
                  placeholder="±0"
                  value={skillMiscModifiers[skillInfo.id] || ""}
                  onChange={(e) => onSkillMiscModifierChange(skillInfo.id, e.target.value)}
                  inputProps={{ style: { textAlign: 'center', padding: '6px 4px' }, 'aria-label': `${skillInfo.name} misc modifier` }}
                  sx={{ width: '55px', mx: 0.5 }}
                />
                <Typography variant="body1" sx={{ fontWeight: 'bold', minWidth: '35px', textAlign: 'right', fontSize: '1.1rem' }}>
                  {skills[skillInfo.id] >= 0 ? `+${skills[skillInfo.id]}` : skills[skillInfo.id]}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Paper>
      <Paper elevation={2} sx={{ p: 2, textAlign: 'center', mb: 3 }}>
        <Typography variant="h6" component="p">
          Passive Wisdom (Perception): <Box component="span" sx={{ fontWeight: 'bold' }}>{passivePerception}</Box>
        </Typography>
      </Paper>
    </>
  );
}
export default SkillsSection;
