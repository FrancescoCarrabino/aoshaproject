// src/components/character/CharacterSheet.jsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { SKILL_LIST, ABILITY_SCORE_IDS } from '../../utils/dndConstants';
import { getProficiencyBonus, calculateAbilityModifier } from '../../utils/dndCalculations';
import CharacterSheetTabs from './CharacterSheetTabs';
import { Button, Box, CircularProgress, Alert } from '@mui/material';
import { updateCharacterSheet } from '../../services/apiService';

// Define default shape for a new spell, used in addSpell and mergeStates
const defaultNewSpellObject = {
  id: "", // Will be overridden
  level: 0, name: "", prepared: false,
  castingTime: "1 Action", range: "", components: "V, S", duration: "",
  description: "", higherLevels: "", school: "",
  ritual: false, concentration: false, source: "", page: ""
};
const defaultNewInventoryItem = {
  id: "", // Will be overridden
  name: "",
  quantity: 1,
  weight: 0,
  description: "",
  equipped: false,
  location: "Carried"
};

export const initialCharacterState = {
  characterName: "",
  classes: [{ className: "", classLevel: "" }, { className: "", classLevel: "" }],
  background: "", playerName: "", race: "", alignment: "", experiencePoints: 0, inspiration: false,
  abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
  savingThrowProficiencies: ABILITY_SCORE_IDS.reduce((acc, id) => { acc[id] = false; return acc; }, {}),
  skillProficiencies: SKILL_LIST.reduce((acc, skill) => { acc[skill.id] = false; return acc; }, {}),
  skillMiscModifiers: SKILL_LIST.reduce((acc, skill) => { acc[skill.id] = ""; return acc; }, {}),
  armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: "30 ft.",
  hitDiceTotal: "", hitDiceCurrent: 0,
  deathSaves: { successes: [false, false, false], failures: [false, false, false] },
  attacks: [{ id: crypto.randomUUID(), name: "", atkBonus: "", damage: "" }],
  currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  equipmentList: "", personalityTraits: "", ideals: "", bonds: "", flaws: "",
  featuresAndTraits: "", otherProficienciesAndLanguages: "",
  spellcasting: {
    spellcastingClass: "", spellcastingAbility: "intelligence",
    spellSlots: Array(10).fill(null).map(() => ({ total: 0, expended: 0 })),
    spells: [], // Initially empty, addSpell populates it
  },
  inventoryItems: [], // Array of item objects
  // Example of an item object structure:
  // {
  //   id: crypto.randomUUID(),
  //   name: "",
  //   quantity: 1,
  //   weight: 0, // Weight per item
  //   description: "", // Optional description or notes
  //   equipped: false, // If it's armor, weapon, etc.
  //   location: "Backpack" // Where it's stored
  // }

  carryingCapacity: {
    currentWeight: 0, // This will be derived
    maxRegular: 0,    // Could be derived from STR (STR * 15) or input
    encumberedThreshold: 0, // STR * 5
    heavilyEncumberedThreshold: 0, // STR * 10
    pushDragLift: 0,  // STR * 30
    // These thresholds could also be direct inputs if you don't want to auto-calculate
  },
};

// --- REFINED mergeStates FUNCTION ---
function mergeStates(defaultState, loadedState) {
  // Start with a deep clone of the default state to ensure all base structure is present
  const merged = JSON.parse(JSON.stringify(defaultState));

  if (!loadedState) {
    // If there's no loaded state (e.g., creating a new character), ensure default arrays
    // that need initial items have them (already handled by initialCharacterState definition)
    if (!merged.attacks || merged.attacks.length === 0) {
      merged.attacks = [{ id: crypto.randomUUID(), name: "", atkBonus: "", damage: "" }];
    }
    // Ensure classes has two empty slots if not defined or too short
    if (!merged.classes || merged.classes.length < 2) {
      const currentClasses = merged.classes || [];
      merged.classes = [
        { ...(defaultState.classes[0] || {}), ...(currentClasses[0] || {}) },
        { ...(defaultState.classes[1] || {}), ...(currentClasses[1] || {}) }
      ];
      while (merged.classes.length < 2) merged.classes.push({ className: "", classLevel: "" });
    }
    // Ensure spellcasting object and its arrays exist
    if (!merged.spellcasting) merged.spellcasting = JSON.parse(JSON.stringify(defaultState.spellcasting));
    if (!merged.spellcasting.spells) merged.spellcasting.spells = [];
    if (!merged.spellcasting.spellSlots || merged.spellcasting.spellSlots.length !== 10) {
      merged.spellcasting.spellSlots = Array(10).fill(null).map(() => ({ total: 0, expended: 0 }));
    }
    // Ensure inventoryItems array exists
    if (!merged.inventoryItems) merged.inventoryItems = [];
    if (!merged.carryingCapacity) merged.carryingCapacity = JSON.parse(JSON.stringify(defaultState.carryingCapacity));

    return merged;
  }

  // Iterate over keys in the loaded state to merge them into the default structure
  for (const key in loadedState) {
    if (loadedState.hasOwnProperty(key) && merged.hasOwnProperty(key)) { // Only merge known keys
      const loadedValue = loadedState[key];
      const defaultValueForKey = defaultState[key]; // From our complete initialCharacterState

      if (key === 'classes' && Array.isArray(loadedValue)) {
        merged.classes = [
          { ...(defaultValueForKey?.[0] || { className: "", classLevel: "" }), ...(loadedValue[0] || {}) },
          { ...(defaultValueForKey?.[1] || { className: "", classLevel: "" }), ...(loadedValue[1] || {}) }
        ];
        while (merged.classes.length < 2) merged.classes.push({ className: "", classLevel: "" });
      } else if (key === 'attacks' && Array.isArray(loadedValue)) {
        merged.attacks = loadedValue.length > 0 ?
          loadedValue.map(attack => ({
            id: attack.id || crypto.randomUUID(),
            name: attack.name || "",
            atkBonus: attack.atkBonus || "",
            damage: attack.damage || "",
          })) :
          [{ id: crypto.randomUUID(), name: "", atkBonus: "", damage: "" }]; // Default if empty array loaded
      } else if (key === 'spellcasting' && typeof loadedValue === 'object' && loadedValue !== null) {
        merged.spellcasting = { ...(defaultValueForKey || {}), ...loadedValue }; // Merge top-level spellcasting props

        // Merge spellSlots array carefully
        merged.spellcasting.spellSlots = (defaultValueForKey?.spellSlots || Array(10).fill(null).map(() => ({ total: 0, expended: 0 })))
          .map((defaultSlot, i) => ({
            ...defaultSlot,
            ...(loadedValue.spellSlots?.[i] || {})
          }));
        // Ensure it has 10 slots if loaded data was shorter
        while (merged.spellcasting.spellSlots.length < 10) merged.spellcasting.spellSlots.push({ total: 0, expended: 0 });


        // Merge spells array (array of objects)
        merged.spellcasting.spells = (loadedValue.spells || []).map(loadedSpell => ({
          ...defaultNewSpellObject, // Ensure all fields from default shape are present
          id: loadedSpell.id || crypto.randomUUID(), // Ensure ID
          ...loadedSpell, // Override with loaded data
          level: parseInt(loadedSpell.level, 10) || 0,
          prepared: typeof loadedSpell.prepared === 'boolean' ? loadedSpell.prepared : ((parseInt(loadedSpell.level, 10) || 0) === 0),
          ritual: typeof loadedSpell.ritual === 'boolean' ? loadedSpell.ritual : false,
          concentration: typeof loadedSpell.concentration === 'boolean' ? loadedSpell.concentration : false,
        }));
      } else if (key === 'inventoryItems' && Array.isArray(loadedValue)) {
        // Merge inventoryItems array
        merged.inventoryItems = loadedValue.map(loadedItem => ({
          ...defaultNewInventoryItem, // Ensure all fields from default shape are present
          id: loadedItem.id || crypto.randomUUID(), // Ensure ID
          ...loadedItem, // Override with loaded data
          quantity: parseFloat(loadedItem.quantity) || 1, // Ensure numbers
          weight: parseFloat(loadedItem.weight) || 0,
          equipped: typeof loadedItem.equipped === 'boolean' ? loadedItem.equipped : false,
        }));
      } else if (key === 'carryingCapacity' && typeof loadedValue === 'object' && loadedValue !== null) {
        // Merge carryingCapacity object
        merged.carryingCapacity = { ...(defaultValueForKey || {}), ...loadedValue };
      } else if (typeof loadedValue === 'object' && loadedValue !== null && !Array.isArray(loadedValue) && defaultValueForKey) {
        // Generic object merge (e.g., abilityScores, skillProficiencies, currency)
        merged[key] = { ...defaultValueForKey, ...loadedValue };
      } else if (loadedValue !== undefined) {
        // Primitives or arrays not specifically handled above (e.g. skillProficiencies which is an object of booleans)
        merged[key] = loadedValue;
      }
    }
  }

  // Final checks again to ensure core array structures have at least default items if somehow still empty
  if (!merged.attacks || merged.attacks.length === 0) {
    merged.attacks = [{ id: crypto.randomUUID(), name: "", atkBonus: "", damage: "" }];
  }
  if (!merged.classes || merged.classes.length < 2) {
    const currentClasses = merged.classes || [];
    merged.classes = [
      currentClasses[0] || { className: "", classLevel: "" },
      currentClasses[1] || { className: "", classLevel: "" }
    ];
  }
  if (!merged.inventoryItems) merged.inventoryItems = []; // Ensure it's at least an empty array
  if (!merged.spellcasting) merged.spellcasting = JSON.parse(JSON.stringify(defaultState.spellcasting));
  if (!merged.spellcasting.spells) merged.spellcasting.spells = [];
  if (!merged.spellcasting.spellSlots || merged.spellcasting.spellSlots.length !== 10) {
    merged.spellcasting.spellSlots = Array(10).fill(null).map(() => ({ total: 0, expended: 0 }));
  }


  return merged;
}

function CharacterSheet({ sheetId, initialData, onSaveSuccess, onSaveError }) {
  const [character, setCharacter] = useState(() => mergeStates(initialCharacterState, initialData));
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ message: '', severity: '' });
  const [newlyAddedSpellId, setNewlyAddedSpellId] = useState(null); // For auto-expanding new spell

  useEffect(() => {
    setCharacter(mergeStates(initialCharacterState, initialData));
    setNewlyAddedSpellId(null); // Reset when new data is loaded
  }, [initialData, sheetId]);

  const handleInputChange = useCallback((field, value, isNumeric = false, isCheckbox = false) => {/* ... */ setCharacter(prev => { let pV = value; if (isCheckbox) pV = value; else if (isNumeric) { if (value === "") pV = ""; else { pV = parseInt(value, 10); if (isNaN(pV)) pV = prev[field] === "" ? "" : (prev[field] || 0); } } return { ...prev, [field]: pV }; }); }, []);
  const handleClassChange = useCallback((index, field, value) => {/* ... */ setCharacter(prev => { const nC = prev.classes.map((c, i) => { if (i === index) { const uC = { ...c, [field]: value }; if (field === 'classLevel') { uC[field] = value === "" ? "" : (isNaN(parseInt(value, 10)) ? "" : parseInt(value, 10)); } return uC; } return c; }); while (nC.length < 2) nC.push({ className: "", classLevel: "" }); return { ...prev, classes: nC.slice(0, 2) }; }); }, []);
  const handleAbilityScoreChange = useCallback((abilityId, value) => {/* ... */ setCharacter(prev => ({ ...prev, abilityScores: { ...prev.abilityScores, [abilityId]: value === "" ? "" : (isNaN(parseInt(value, 10)) ? prev.abilityScores[abilityId] : parseInt(value, 10)), }, })); }, []);
  const handleSavingThrowProfChange = useCallback((abilityId, isProficient) => {/* ... */ setCharacter(prev => ({ ...prev, savingThrowProficiencies: { ...prev.savingThrowProficiencies, [abilityId]: isProficient }, })); }, []);
  const handleSkillProfChange = useCallback((skillId, isProficient) => {/* ... */ setCharacter(prev => ({ ...prev, skillProficiencies: { ...prev.skillProficiencies, [skillId]: isProficient }, })); }, []);
  const handleSkillMiscModifierChange = useCallback((skillId, value) => {/* ... */ setCharacter(prev => ({ ...prev, skillMiscModifiers: { ...prev.skillMiscModifiers, [skillId]: value } })); }, []);
  const handleDeathSaveChange = useCallback((type, index, isChecked) => {/* ... */ setCharacter(prev => { const nS = [...prev.deathSaves[type]]; nS[index] = isChecked; return { ...prev, deathSaves: { ...prev.deathSaves, [type]: nS } }; }); }, []);
  const handleAttackChange = useCallback((index, field, value) => {/* ... */ setCharacter(prev => ({ ...prev, attacks: prev.attacks.map((a, i) => i === index ? { ...a, [field]: value } : a) })); }, []);
  const addAttack = useCallback(() => {/* ... */ setCharacter(prev => ({ ...prev, attacks: [...prev.attacks, { id: crypto.randomUUID(), name: "", atkBonus: "", damage: "" }] })); }, []);
  const removeAttack = useCallback((index) => {/* ... */ setCharacter(prev => ({ ...prev, attacks: prev.attacks.filter((_, i) => i !== index) })); }, []);
  const handleCurrencyChange = useCallback((currencyType, value) => {/* ... */ setCharacter(prev => ({ ...prev, currency: { ...prev.currency, [currencyType]: value === "" ? "" : (isNaN(parseInt(value, 10)) ? prev.currency[currencyType] : parseInt(value, 10)) } })); }, []);

  const handleSpellcastingInfoChange = useCallback((field, value) => setCharacter(prev => ({ ...prev, spellcasting: { ...prev.spellcasting, [field]: value } })), []);
  const handleSpellSlotChange = useCallback((level, type, value) => { const nV = parseInt(value, 10); setCharacter(prev => { const nSS = [...prev.spellcasting.spellSlots]; nSS[level] = { ...nSS[level], [type]: isNaN(nV) ? 0 : nV }; if (type === 'total' && nSS[level].expended > nSS[level].total) nSS[level].expended = nSS[level].total; if (type === 'expended' && nSS[level].expended > nSS[level].total) nSS[level].expended = nSS[level].total; if (nSS[level].expended < 0) nSS[level].expended = 0; return { ...prev, spellcasting: { ...prev.spellcasting, spellSlots: nSS } }; }); }, []);
  const handleSpellChange = useCallback((index, field, value) => setCharacter(prev => ({ ...prev, spellcasting: { ...prev.spellcasting, spells: prev.spellcasting.spells.map((s, i) => i === index ? { ...s, [field]: value } : s) } })), []);
  const addSpell = useCallback((level = 0) => {
    const newSpellId = crypto.randomUUID();
    setCharacter(prev => ({
      ...prev,
      spellcasting: {
        ...prev.spellcasting,
        spells: [...(prev.spellcasting.spells || []), { ...defaultNewSpellObject, id: newSpellId, level: parseInt(level, 10) || 0, prepared: (parseInt(level, 10) || 0) === 0 ? true : false }]
      }
    }));
    setNewlyAddedSpellId(newSpellId); // Set ID to trigger auto-expansion in child
  }, []);
  const removeSpell = useCallback((index) => setCharacter(prev => ({ ...prev, spellcasting: { ...prev.spellcasting, spells: (prev.spellcasting.spells || []).filter((_, i) => i !== index) } })), []);

  const handleInventoryItemChange = useCallback((index, field, value) => {
    setCharacter(prev => ({
      ...prev,
      inventoryItems: prev.inventoryItems.map((item, i) => {
        if (i === index) {
          let processedValue = value;
          if (field === 'quantity' || field === 'weight') {
            processedValue = value === "" ? "" : (isNaN(parseFloat(value)) ? item[field] : parseFloat(value));
          } else if (field === 'equipped') {
            processedValue = typeof value === 'boolean' ? value : false;
          }
          return { ...item, [field]: processedValue };
        }
        return item;
      }),
    }));
  }, []);

  const addInventoryItem = useCallback(() => {
    setCharacter(prev => ({
      ...prev,
      inventoryItems: [
        ...(prev.inventoryItems || []),
        { // Default new item structure
          id: crypto.randomUUID(),
          name: "",
          quantity: 1,
          weight: 0,
          description: "",
          equipped: false,
          location: "Carried"
        }
      ]
    }));
  }, []);

  const removeInventoryItem = useCallback((index) => {
    setCharacter(prev => ({
      ...prev,
      inventoryItems: (prev.inventoryItems || []).filter((_, i) => i !== index)
    }));
  }, []);

  const handleCarryingCapacityChange = useCallback((field, value) => {
    setCharacter(prev => ({
      ...prev,
      carryingCapacity: {
        ...prev.carryingCapacity,
        [field]: value === "" ? "" : (isNaN(parseFloat(value)) ? prev.carryingCapacity[field] : parseFloat(value))
      }
    }));
  }, []);

  const handlers = {
    handleInputChange, handleClassChange, handleAbilityScoreChange, handleSavingThrowProfChange,
    handleSkillProfChange, handleSkillMiscModifierChange, handleDeathSaveChange,
    handleAttackChange, addAttack, removeAttack, handleCurrencyChange,
    handleSpellcastingInfoChange, handleSpellSlotChange, handleSpellChange, addSpell, removeSpell, handleInventoryItemChange, addInventoryItem, removeInventoryItem, handleCarryingCapacityChange
  };

  const totalCharacterLevel = useMemo(() => character.classes.reduce((s, c) => (s + (parseInt(c.classLevel, 10) || 0)), 0) || 1, [character.classes]);
  const proficiencyBonus = useMemo(() => getProficiencyBonus(totalCharacterLevel), [totalCharacterLevel]);
  const abilityModifiers = useMemo(() => { const m = {}; ABILITY_SCORE_IDS.forEach(id => m[id] = calculateAbilityModifier(character.abilityScores[id] || 0)); return m; }, [character.abilityScores]);
  const savingThrows = useMemo(() => { const s = {}; ABILITY_SCORE_IDS.forEach(id => s[id] = (abilityModifiers[id] || 0) + (character.savingThrowProficiencies[id] ? proficiencyBonus : 0)); return s; }, [abilityModifiers, character.savingThrowProficiencies, proficiencyBonus]);
  const skills = useMemo(() => { const cS = {}; SKILL_LIST.forEach(sI => { const bAM = abilityModifiers[sI.baseAbility] || 0; const pBAI = character.skillProficiencies[sI.id] ? proficiencyBonus : 0; const mSC = parseInt(character.skillMiscModifiers[sI.id], 10) || 0; cS[sI.id] = bAM + pBAI + mSC; }); return cS; }, [abilityModifiers, character.skillProficiencies, proficiencyBonus, character.skillMiscModifiers]);
  const passivePerception = useMemo(() => 10 + (skills.perception || 0), [skills.perception]);
  const initiative = useMemo(() => abilityModifiers.dexterity || 0, [abilityModifiers.dexterity]);
  const spellcastingAbilityModifier = useMemo(() => abilityModifiers[character.spellcasting?.spellcastingAbility || 'intelligence'] || 0, [character.spellcasting?.spellcastingAbility, abilityModifiers]);
  const spellSaveDC = useMemo(() => 8 + proficiencyBonus + spellcastingAbilityModifier, [proficiencyBonus, spellcastingAbilityModifier]);
  const spellAttackBonus = useMemo(() => proficiencyBonus + spellcastingAbilityModifier, [proficiencyBonus, spellcastingAbilityModifier]);

  const strengthScore = useMemo(() => parseInt(character.abilityScores.strength, 10) || 0, [character.abilityScores.strength]);

  const calculatedMaxCarryingCapacity = useMemo(() => strengthScore * 15, [strengthScore]);
  const calculatedEncumberedThreshold = useMemo(() => strengthScore * 5, [strengthScore]);
  const calculatedHeavilyEncumberedThreshold = useMemo(() => strengthScore * 10, [strengthScore]);
  const calculatedPushDragLift = useMemo(() => strengthScore * 30, [strengthScore]);

  const totalWeightCarried = useMemo(() => {
    return (character.inventoryItems || []).reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const weight = parseFloat(item.weight) || 0;
      return sum + (quantity * weight);
    }, 0);
  }, [character.inventoryItems]);

  // Update the character state's carryingCapacity.currentWeight and derived maxes
  // This effect ensures that if the user inputs manual max capacity, it's used,
  // otherwise, the calculated one is used.
  useEffect(() => {
    setCharacter(prev => {
      const updatedCarryingCapacity = { ...prev.carryingCapacity };
      updatedCarryingCapacity.currentWeight = totalWeightCarried;

      // If max capacity fields are empty or 0, use calculated values from STR
      // This allows manual override if user types into those fields directly.
      if (!parseFloat(prev.carryingCapacity.maxRegular)) {
        updatedCarryingCapacity.maxRegular = calculatedMaxCarryingCapacity;
      }
      if (!parseFloat(prev.carryingCapacity.encumberedThreshold)) {
        updatedCarryingCapacity.encumberedThreshold = calculatedEncumberedThreshold;
      }
      if (!parseFloat(prev.carryingCapacity.heavilyEncumberedThreshold)) {
        updatedCarryingCapacity.heavilyEncumberedThreshold = calculatedHeavilyEncumberedThreshold;
      }
      if (!parseFloat(prev.carryingCapacity.pushDragLift)) {
        updatedCarryingCapacity.pushDragLift = calculatedPushDragLift;
      }
      return { ...prev, carryingCapacity: updatedCarryingCapacity };
    });
  }, [
    totalWeightCarried,
    calculatedMaxCarryingCapacity,
    calculatedEncumberedThreshold,
    calculatedHeavilyEncumberedThreshold,
    calculatedPushDragLift,
    // Only re-run if these specific calculated values change,
    // or if we want to allow manual overrides to persist:
    // character.carryingCapacity.maxRegular, // etc.
  ]);

  useEffect(() => { /* ... Hit Dice Derivation useEffect ... */
    const firstClass = character.classes[0]?.className?.toLowerCase(); let hDT = 8;
    if (firstClass) { if (['barbarian'].includes(firstClass)) hDT = 12; else if (['fighter', 'paladin', 'ranger'].includes(firstClass)) hDT = 10; else if (['sorcerer', 'wizard'].includes(firstClass)) hDT = 6; }
    const nHDT = totalCharacterLevel > 0 ? `${totalCharacterLevel}d${hDT}` : "0d0"; const nHDC = totalCharacterLevel > 0 ? totalCharacterLevel : 0;
    if (character.hitDiceTotal !== nHDT || character.hitDiceCurrent !== nHDC) { setCharacter(prev => ({ ...prev, hitDiceTotal: nHDT, hitDiceCurrent: nHDC })); }
  }, [totalCharacterLevel, character.classes, character.hitDiceTotal, character.hitDiceCurrent]); // Added dependencies

  const derivedValues = {
    totalCharacterLevel, proficiencyBonus, abilityModifiers, savingThrows, skills,
    passivePerception, initiative, spellSaveDC, spellAttackBonus,
  };

  const handleSaveSheet = async () => { /* ... same save logic ... */
    if (!sheetId) { console.error("No sheet ID"); if (onSaveError) onSaveError("No ID"); return; }
    setIsSaving(true); setSaveStatus({ message: '', severity: '' });
    try {
      const payload = { character_data: character }; await updateCharacterSheet(sheetId, payload);
      setSaveStatus({ message: 'Character saved successfully!', severity: 'success' }); if (onSaveSuccess) onSaveSuccess();
      setTimeout(() => setSaveStatus({ message: '', severity: '' }), 3000);
    } catch (err) {
      const eM = err.error || "Could not save."; setSaveStatus({ message: eM, severity: 'error' }); if (onSaveError) onSaveError(eM);
    } finally { setIsSaving(false); }
  };

  return (
    <Box sx={{ position: 'relative', pb: 8 }}>
      <CharacterSheetTabs
        character={character}
        handlers={handlers}
        derivedValues={derivedValues}
        newlyAddedSpellId={newlyAddedSpellId} // Pass new prop
        onClearNewlyAddedSpellId={() => setNewlyAddedSpellId(null)} // Callback to clear it
      />
      {/* ... Save Button Box ... */}
      <Box sx={{ p: 2, position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'background.paper', boxShadow: 3, zIndex: 10, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
        {saveStatus.message && (<Alert severity={saveStatus.severity} sx={{ flexGrow: 1, maxWidth: 'calc(100% - 150px)' }} onClose={() => setSaveStatus({ message: '', severity: '' })}> {saveStatus.message} </Alert>)}
        <Button variant="contained" color="primary" onClick={handleSaveSheet} disabled={isSaving} sx={{ minWidth: 120 }}> {isSaving ? <CircularProgress size={24} color="inherit" /> : 'Save Character'} </Button>
      </Box>
    </Box>
  );
}
export default CharacterSheet;
