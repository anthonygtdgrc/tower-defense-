// Meta-progression: permanent talents purchased with persistent currency
// (Essence) earned at the end of each run, independent of in-run gold.

export const PERMANENT_TALENTS = [
  { id: 'start_gold', name: 'Trésor de Départ', cost: 3, effect: { startGold: 40 }, max: 5 },
  { id: 'base_hp', name: 'Fondations Renforcées', cost: 4, effect: { baseMaxHpMult: 1.1 }, max: 5 },
  { id: 'player_hp', name: 'Vitalité Ancestrale', cost: 4, effect: { playerMaxHpMult: 1.08 }, max: 5 },
  { id: 'tower_discount', name: "Artisanat Efficace", cost: 5, effect: { towerCostMult: 0.97 }, max: 4 },
  { id: 'xp_boost', name: 'Sagesse Accumulée', cost: 4, effect: { xpMult: 1.1 }, max: 4 },
  { id: 'crystal_find', name: 'Œil du Prospecteur', cost: 6, effect: { crystalDropMult: 1.15 }, max: 3 },
  { id: 'unlock_ranger', name: 'Classe : Rôdeuse', cost: 12, effect: { unlockClass: 'ranger' }, max: 1 },
  { id: 'unlock_forest', name: 'Carte : Forêt Maudite', cost: 8, effect: { unlockMap: 'forest' }, max: 1 },
  { id: 'unlock_desert', name: 'Carte : Désert Brûlant', cost: 10, effect: { unlockMap: 'desert' }, max: 1 }
];

export function essenceFromRun({ wavesSurvived, bossesKilled, difficultyMult }) {
  return Math.round((wavesSurvived * 1.5 + bossesKilled * 8) * difficultyMult);
}

export const DIFFICULTIES = {
  easy: { name: 'Facile', enemyHpMult: 0.75, enemyDmgMult: 0.7, goldMult: 1.1, scoreMult: 0.7 },
  normal: { name: 'Normal', enemyHpMult: 1.0, enemyDmgMult: 1.0, goldMult: 1.0, scoreMult: 1.0 },
  hard: { name: 'Difficile', enemyHpMult: 1.4, enemyDmgMult: 1.3, goldMult: 1.15, scoreMult: 1.4 },
  nightmare: { name: 'Cauchemar', enemyHpMult: 1.9, enemyDmgMult: 1.7, goldMult: 1.3, scoreMult: 2.0 }
};

export const RUN_MODIFIERS = [
  { id: 'greed', name: 'Cupidité', description: '+50% or, ennemis +30% PV', effect: { goldMult: 1.5, enemyHpMult: 1.3 } },
  { id: 'glass', name: 'Cannon de Verre', description: '+40% dégâts joueur, -30% PV joueur', effect: { playerDamageMult: 1.4, playerHpMult: 0.7 } },
  { id: 'swarm', name: 'Nuée', description: '+60% ennemis par vague, -20% PV par ennemi', effect: { enemyCountMult: 1.6, enemyHpMult: 0.8 } },
  { id: 'blessed_towers', name: 'Bénédiction des Tours', description: 'Tours +25% dégâts, +20% coût', effect: { towerDamageMult: 1.25, towerCostMult: 1.2 } },
  { id: 'iron_will', name: 'Volonté de Fer', description: 'Base +50% PV max, or -20%', effect: { baseHpMult: 1.5, goldMult: 0.8 } }
];

export const ACHIEVEMENTS = [
  { id: 'no_damage_10', name: 'Sans Égratignure', description: 'Terminez 10 vagues sans perdre de PV de base.' },
  { id: 'one_tower', name: 'Minimaliste', description: 'Terminez une partie avec une seule tour construite.' },
  { id: 'boss_slayer', name: 'Chasseur de Boss', description: 'Vainquez 5 boss au total.' },
  { id: 'wave_25', name: 'Endurance', description: 'Atteignez la vague 25.' },
  { id: 'fusion_master', name: 'Alchimiste des Tours', description: 'Fusionnez 3 tours en une version hybride.' },
  { id: 'legendary_drop', name: 'Chanceux', description: "Obtenez un équipement légendaire." }
];
