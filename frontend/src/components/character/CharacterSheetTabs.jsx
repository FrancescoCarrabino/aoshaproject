// src/components/character/CharacterSheetTabs.jsx
import React, { useState } from 'react';
import { Tabs, Tab, Box, Typography } from '@mui/material'; // Typography might not be used directly here
import CoreInfoSection from './sections/CoreInfoSection';
import AbilitiesSection from './sections/AbilitiesSection';
import SkillsSection from './sections/SkillsSection';
import CombatStatsSection from './sections/CombatStatsSection';
import AttacksSection from './sections/AttacksSection';
import EquipmentSection from './sections/EquipmentSection';
import CharacterDetailsSection from './sections/CharacterDetailsSection';
import SpellsSection from './sections/SpellsSection';
import InventorySection from './sections/InventorySection';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`character-sheet-tabpanel-${index}`}
      aria-labelledby={`character-sheet-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index) {
  return {
    id: `character-sheet-tab-${index}`,
    'aria-controls': `character-sheet-tabpanel-${index}`,
  };
}

function CharacterSheetTabs({
  character,
  handlers, // This is the main object from CharacterSheet.jsx
  derivedValues,
  newlyAddedSpellId,
  onClearNewlyAddedSpellId
}) {
  const [activeTabValue, setActiveTabValue] = useState(0);
  const handleChange = (event, newValue) => setActiveTabValue(newValue);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', position: 'sticky', top: 0, backgroundColor: 'background.paper', zIndex: 1 }}>
        <Tabs value={activeTabValue} onChange={handleChange} aria-label="Character sheet sections" variant="scrollable" scrollButtons="auto">
          <Tab label="Core & Skills" {...a11yProps(0)} />
          <Tab label="Combat & Equipment" {...a11yProps(1)} />
          <Tab label="Details" {...a11yProps(2)} />
          <Tab label="Spells" {...a11yProps(3)} />
          <Tab label="Inventory" {...a11yProps(4)} />
        </Tabs>
      </Box>

      <TabPanel value={activeTabValue} index={0}>
        <>
          <CoreInfoSection
            character={character}
            // Pass the specific handlers CoreInfoSection expects:
            onInputChange={handlers.handleInputChange}
            handlers={{ handleClassChange: handlers.handleClassChange }} // Pass only 'handleClassChange' within 'handlers' prop
            derivedValues={derivedValues}
          />
          <AbilitiesSection
            abilityScores={character.abilityScores}
            abilityModifiers={derivedValues.abilityModifiers}
            savingThrowProficiencies={character.savingThrowProficiencies}
            savingThrows={derivedValues.savingThrows}
            proficiencyBonus={derivedValues.proficiencyBonus}
            onAbilityScoreChange={handlers.handleAbilityScoreChange}
            onSavingThrowProfChange={handlers.handleSavingThrowProfChange}
          />
          <SkillsSection
            skillProficiencies={character.skillProficiencies}
            skills={derivedValues.skills}
            passivePerception={derivedValues.passivePerception}
            onSkillProfChange={handlers.handleSkillProfChange}
            skillMiscModifiers={character.skillMiscModifiers}
            onSkillMiscModifierChange={handlers.handleSkillMiscModifierChange}
          />
        </>
      </TabPanel>

      <TabPanel value={activeTabValue} index={1}>
        <>
          <CombatStatsSection
            character={character}
            initiative={derivedValues.initiative}
            onInputChange={handlers.handleInputChange} // This component expects onInputChange directly
            onDeathSaveChange={handlers.handleDeathSaveChange}
          />
          <AttacksSection
            attacks={character.attacks}
            onAttackChange={handlers.handleAttackChange}
            onAddAttack={handlers.addAttack}
            onRemoveAttack={handlers.removeAttack}
          />
          <EquipmentSection
            currency={character.currency}
            equipmentList={character.equipmentList}
            onCurrencyChange={handlers.handleCurrencyChange}
            onInputChange={handlers.handleInputChange} // This component expects onInputChange directly
          />
        </>
      </TabPanel>

      <TabPanel value={activeTabValue} index={2}>
        <>
          <CharacterDetailsSection
            character={character}
            onInputChange={handlers.handleInputChange} // This component expects onInputChange directly
          />
        </>
      </TabPanel>

      <TabPanel value={activeTabValue} index={3}>
        <>
          <SpellsSection
            spellcastingData={character.spellcasting}
            spellSaveDC={derivedValues.spellSaveDC}
            spellAttackBonus={derivedValues.spellAttackBonus}
            handlers={handlers} // SpellsSection might expect the full 'handlers' object
            newlyAddedSpellId={newlyAddedSpellId}
            onClearNewlyAddedSpellId={onClearNewlyAddedSpellId}
          />
        </>
      </TabPanel>
      <TabPanel value={activeTabValue} index={4}>
        <InventorySection
          inventoryItems={character.inventoryItems}
          carryingCapacity={character.carryingCapacity}
          handlers={handlers} // InventorySection might expect the full 'handlers' object
        />
      </TabPanel>
    </Box>
  );
}
export default CharacterSheetTabs;
