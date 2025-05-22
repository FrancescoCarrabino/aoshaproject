// src/utils/dndConstants.js

export const ABILITY_SCORE_IDS = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];

export const SKILL_LIST = [
  { id: "acrobatics", name: "Acrobatics", baseAbility: "dexterity" },
  { id: "animalHandling", name: "Animal Handling", baseAbility: "wisdom" },
  { id: "arcana", name: "Arcana", baseAbility: "intelligence" },
  { id: "athletics", name: "Athletics", baseAbility: "strength" },
  { id: "deception", name: "Deception", baseAbility: "charisma" },
  { id: "history", name: "History", baseAbility: "intelligence" },
  { id: "insight", name: "Insight", baseAbility: "wisdom" },
  { id: "intimidation", name: "Intimidation", baseAbility: "charisma" },
  { id: "investigation", name: "Investigation", baseAbility: "intelligence" },
  { id: "medicine", name: "Medicine", baseAbility: "wisdom" },
  { id: "nature", name: "Nature", baseAbility: "intelligence" },
  { id: "perception", name: "Perception", baseAbility: "wisdom" },
  { id: "performance", name: "Performance", baseAbility: "charisma" },
  { id: "persuasion", name: "Persuasion", baseAbility: "charisma" },
  { id: "religion", name: "Religion", baseAbility: "intelligence" },
  { id: "sleightOfHand", name: "Sleight of Hand", baseAbility: "dexterity" },
  { id: "stealth", name: "Stealth", baseAbility: "dexterity" },
  { id: "survival", name: "Survival", baseAbility: "wisdom" },
];

// Proficiency Bonus by Character Level (D&D 5e)
export const PROFICIENCY_BONUS_BY_LEVEL = {
  1: 2,
  2: 2,
  3: 2,
  4: 2,
  5: 3,
  6: 3,
  7: 3,
  8: 3,
  9: 4,
  10: 4,
  11: 4,
  12: 4,
  13: 5,
  14: 5,
  15: 5,
  16: 5,
  17: 6,
  18: 6,
  19: 6,
  20: 6,
};

// You can add more constants here as needed, for example:
// - Spellcasting ability options
// - Lists of classes, races, backgrounds if you want dropdowns for them
// - Equipment types, etc.
