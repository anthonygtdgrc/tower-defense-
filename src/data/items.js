// Equipment loot: weapons and armor with rarity-scaled random stats.

export const RARITIES = [
  { id: 'common', name: 'Commun', color: '#b0bec5', mult: 1.0, statRolls: 1 },
  { id: 'rare', name: 'Rare', color: '#4fc3f7', mult: 1.35, statRolls: 2 },
  { id: 'epic', name: 'Épique', color: '#ab47bc', mult: 1.8, statRolls: 3 },
  { id: 'legendary', name: 'Légendaire', color: '#ffb300', mult: 2.5, statRolls: 4 }
];

export const ITEM_SLOTS = ['weapon', 'armor'];

export const STAT_POOL = {
  weapon: ['damage', 'attackSpeed', 'critChance'],
  armor: ['maxHp', 'armor', 'moveSpeed']
};

export const BASE_STAT_VALUE = {
  damage: 4, attackSpeed: 0.08, critChance: 0.05,
  maxHp: 15, armor: 0.03, moveSpeed: 0.3
};

export function rollItem(slot, rarity, rng = Math.random) {
  const rarityDef = RARITIES.find(r => r.id === rarity) || RARITIES[0];
  const pool = STAT_POOL[slot];
  const stats = {};
  const rolls = Math.min(rarityDef.statRolls, pool.length);
  const shuffled = [...pool].sort(() => rng() - 0.5);
  for (let i = 0; i < rolls; i++) {
    const stat = shuffled[i];
    const base = BASE_STAT_VALUE[stat];
    const variance = 0.75 + rng() * 0.5;
    stats[stat] = +(base * rarityDef.mult * variance).toFixed(3);
  }
  return {
    id: `${slot}_${rarity}_${Math.floor(rng() * 1e6)}`,
    slot,
    rarity: rarityDef.id,
    name: `${rarityDef.name} ${slot === 'weapon' ? 'Arme' : 'Armure'}`,
    color: rarityDef.color,
    stats
  };
}

export function rollRarity(luck = 0, rng = Math.random) {
  const roll = rng() - luck;
  if (roll < 0.03) return 'legendary';
  if (roll < 0.15) return 'epic';
  if (roll < 0.45) return 'rare';
  return 'common';
}
