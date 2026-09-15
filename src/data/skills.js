// Active abilities bound to A / E / R / F, and the passive skill tree
// (3 branches: Melee, Ranged Magic, Support/Engineer).

export const ABILITIES = {
  a: {
    id: 'whirlwind', name: 'Coup Tourbillon', key: 'A',
    branch: 'melee', cooldown: 6, staminaCost: 20,
    damage: 24, radius: 3.5,
    describe: 'Frappe circulaire autour du personnage.'
  },
  e: {
    id: 'powerShot', name: 'Tir Chargé', key: 'E',
    branch: 'ranged', cooldown: 5, staminaCost: 15,
    damage: 35, range: 20,
    describe: 'Projectile puissant qui perce les ennemis.'
  },
  r: {
    id: 'repairPulse', name: 'Pulsation de Réparation', key: 'R',
    branch: 'support', cooldown: 14, staminaCost: 0,
    healAmount: 80, radius: 8,
    describe: 'Répare les tours proches et soigne le joueur.'
  },
  f: {
    id: 'overcharge', name: 'Surcharge', key: 'F',
    branch: 'support', cooldown: 20, staminaCost: 0,
    duration: 8, fireRateMult: 1.6, radius: 10,
    describe: 'Boost temporaire de cadence pour les tours proches.'
  }
};

// Skill tree: 3 branches, each with tiers of passive nodes.
export const SKILL_TREE = {
  melee: {
    name: 'Combat Rapproché',
    nodes: [
      { id: 'melee_dmg1', name: 'Force I', cost: 1, effect: { meleeDamageMult: 1.15 } },
      { id: 'melee_dmg2', name: 'Force II', cost: 1, effect: { meleeDamageMult: 1.15 }, requires: 'melee_dmg1' },
      { id: 'melee_hp', name: 'Robustesse', cost: 1, effect: { maxHpMult: 1.2 }, requires: 'melee_dmg1' },
      { id: 'melee_dash', name: 'Esquive Fulgurante', cost: 2, effect: { dashCooldownMult: 0.7 }, requires: 'melee_hp' },
      { id: 'melee_ult', name: 'Fureur du Champion', cost: 3, effect: { whirlwindDamageMult: 1.6 }, requires: 'melee_dash' }
    ]
  },
  ranged: {
    name: 'Magie à Distance',
    nodes: [
      { id: 'ranged_dmg1', name: 'Précision I', cost: 1, effect: { rangedDamageMult: 1.15 } },
      { id: 'ranged_dmg2', name: 'Précision II', cost: 1, effect: { rangedDamageMult: 1.15 }, requires: 'ranged_dmg1' },
      { id: 'ranged_cd', name: 'Flux Arcanique', cost: 1, effect: { abilityCooldownMult: 0.9 }, requires: 'ranged_dmg1' },
      { id: 'ranged_pierce', name: 'Perforation', cost: 2, effect: { powerShotPierce: 2 }, requires: 'ranged_cd' },
      { id: 'ranged_ult', name: 'Maîtrise Élémentaire', cost: 3, effect: { statusDamageMult: 1.5 }, requires: 'ranged_pierce' }
    ]
  },
  support: {
    name: 'Soutien-Ingénieur',
    nodes: [
      { id: 'sup_eco1', name: 'Économe I', cost: 1, effect: { towerCostMult: 0.95 } },
      { id: 'sup_eco2', name: 'Économe II', cost: 1, effect: { towerCostMult: 0.95 }, requires: 'sup_eco1' },
      { id: 'sup_repair', name: 'Ingénierie', cost: 1, effect: { repairPulseMult: 1.4 }, requires: 'sup_eco1' },
      { id: 'sup_interest', name: 'Investisseur', cost: 2, effect: { interestBonus: 0.02 }, requires: 'sup_repair' },
      { id: 'sup_ult', name: 'Maître Bâtisseur', cost: 3, effect: { overchargeDurationMult: 1.5 }, requires: 'sup_interest' }
    ]
  }
};

export const XP_PER_LEVEL = (level) => Math.round(40 * Math.pow(1.28, level - 1));
export const SKILL_POINTS_PER_LEVEL = 1;
