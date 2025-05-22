// src/components/character/CharacterSheetTabs.jsx
import React, { useState } from 'react';
import { Tabs, Tab, Box, Typography } from '@mui/material';
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
  handlers,
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
        <> {/* <--- ADD FRAGMENT HERE */}
          <CoreInfoSection character={character} handlers={handlers} derivedValues={derivedValues} />
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
        </> {/* <--- END FRAGMENT HERE */}
      </TabPanel>

      <TabPanel value={activeTabValue} index={1}>
        <> {/* <--- ADD FRAGMENT HERE */}
          <CombatStatsSection
            character={character}
            initiative={derivedValues.initiative}
            onInputChange={handlers.handleInputChange}
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
            onInputChange={handlers.handleInputChange}
          />
        </> {/* <--- END FRAGMENT HERE */}
      </TabPanel>

      <TabPanel value={activeTabValue} index={2}>
        {/* This one already had a single child, so it's fine, but adding fragment for consistency is okay */}
        <>
          <CharacterDetailsSection
            character={character}
            onInputChange={handlers.handleInputChange}
          />
        </>
      </TabPanel>

      <TabPanel value={activeTabValue} index={3}>
        <> {/* <--- ADD FRAGMENT HERE (if SpellsSection could potentially have siblings later) */}
          <SpellsSection
            spellcastingData={character.spellcasting}
            spellSaveDC={derivedValues.spellSaveDC}
            spellAttackBonus={derivedValues.spellAttackBonus}
            handlers={handlers}
            newlyAddedSpellId={newlyAddedSpellId}
            onClearNewlyAddedSpellId={onClearNewlyAddedSpellId}
          />
        </> {/* <--- END FRAGMENT HERE */}
      </TabPanel>
      <TabPanel value={activeTabValue} index={4}>
        <InventorySection
          inventoryItems={character.inventoryItems}
          carryingCapacity={character.carryingCapacity} // This now includes currentWeight
          handlers={handlers} // Pass all handlers; InventorySection will use what it needs
        // derivedValues={derivedValues} // Pass if InventorySection needs other derived values directly
        />
      </TabPanel>
    </Box>
  );
}
export default CharacterSheetTabs;
