// src/utils/dndCalculations.js
import { PROFICIENCY_BONUS_BY_LEVEL } from './dndConstants';

/**
 * Calculates the ability modifier for a given ability score.
 * @param {number|string} score - The ability score (e.g., 10, 14, "8", "").
 * @returns {number} The calculated ability modifier. Returns 0 if score is invalid.
 */
export const calculateAbilityModifier = (score) => {
  const numericScore = parseInt(score, 10);
  if (isNaN(numericScore)) {
    return 0; // Default modifier for invalid or empty score
  }
  return Math.floor((numericScore - 10) / 2);
};

/**
 * Gets the proficiency bonus for a given character level.
 * @param {number|string} level - The character's level (e.g., 1, 5, "10", "").
 * @returns {number} The proficiency bonus. Defaults to +2 for invalid levels.
 */
export const getProficiencyBonus = (level) => {
  const numericLevel = parseInt(level, 10);
  if (isNaN(numericLevel) || numericLevel < 1) {
    return PROFICIENCY_BONUS_BY_LEVEL[1]; // Default to level 1 proficiency
  }
  if (numericLevel > 20) {
    return PROFICIENCY_BONUS_BY_LEVEL[20]; // Cap at level 20 proficiency
  }
  return PROFICIENCY_BONUS_BY_LEVEL[numericLevel] || PROFICIENCY_BONUS_BY_LEVEL[1]; // Fallback
};

// You can add more calculation functions here, for example:
// - calculateSkillValue(baseAbilityModifier, proficiencyBonus, isProficient, hasExpertise)
// - calculatePassivePerception (though we did this directly in CharacterSheet.jsx via useMemo)
// - calculateSpellSaveDC(baseAbilityModifier, proficiencyBonus)
// - calculateSpellAttackBonus(baseAbilityModifier, proficiencyBonus)
// - calculateCarryingCapacity(strengthScore)
