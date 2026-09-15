// Enemy archetype definitions. Waves compose enemies from this table and
// apply the global wave scaling curve on top of these base stats.

export const ENEMY_TYPES = {
  basic: {
    id: 'basic', name: 'Rôdeur', color: 0x8d99ae, icon: '👾',
    hp: 30, speed: 3.2, damage: 6, goldValue: 4, xpValue: 3,
    scale: 1, flying: false
  },
  fast: {
    id: 'fast', name: 'Éclaireur', color: 0xffee58, icon: '⚡',
    hp: 18, speed: 6.2, damage: 4, goldValue: 5, xpValue: 4,
    scale: 0.8, flying: false
  },
  armored: {
    id: 'armored', name: 'Blindé', color: 0x546e7a, icon: '🛡️',
    hp: 90, speed: 2.0, damage: 10, goldValue: 8, xpValue: 6,
    scale: 1.3, flying: false, physicalResist: 0.5
  },
  flying: {
    id: 'flying', name: 'Voltigeur', color: 0xba68c8, icon: '🦇',
    hp: 24, speed: 4.4, damage: 5, goldValue: 7, xpValue: 5,
    scale: 0.9, flying: true
  },
  regen: {
    id: 'regen', name: 'Régénérant', color: 0x66bb6a, icon: '💚',
    hp: 50, speed: 2.6, damage: 6, goldValue: 9, xpValue: 6,
    scale: 1.1, flying: false, regenPerSec: 4
  },
  invisible: {
    id: 'invisible', name: 'Ombre', color: 0x37474f, icon: '👻',
    hp: 28, speed: 3.6, damage: 8, goldValue: 10, xpValue: 7,
    scale: 1, flying: false, invisible: true // only detected by control/mage/trap towers
  },
  kamikaze: {
    id: 'kamikaze', name: 'Kamikaze', color: 0xff5252, icon: '💣',
    hp: 20, speed: 4.8, damage: 0, goldValue: 6, xpValue: 5,
    scale: 0.9, flying: false, explodeDamage: 40, explodeRadius: 3
  },
  summoner: {
    id: 'summoner', name: 'Invocateur', color: 0x8e24aa, icon: '🧙',
    hp: 45, speed: 2.4, damage: 5, goldValue: 12, xpValue: 8,
    scale: 1.1, flying: false, summonsEvery: 4, summonType: 'basic'
  }
};

export const ELITE_MODIFIERS = [
  { id: 'rapide', name: 'Rapide', speedMult: 1.6, hpMult: 1, color: 0xffe082 },
  { id: 'blinde', name: 'Blindé', speedMult: 1, hpMult: 2.1, physicalResistBonus: 0.25, color: 0x90a4ae },
  { id: 'regenerant', name: 'Régénérant', speedMult: 1, hpMult: 1.3, regenPerSecBonus: 8, color: 0xa5d6a7 },
  { id: 'invisible', name: 'Invisible', speedMult: 1.1, hpMult: 1.2, invisible: true, color: 0x455a64 }
];

export const BOSS_TYPES = [
  {
    id: 'colossus', name: 'Colosse de Pierre', icon: '👹', color: 0x6d4c41,
    baseHp: 1400, speed: 1.8, damage: 30, goldValue: 250, xpValue: 200, crystalDrop: 3,
    scale: 3.2, flying: false,
    phases: [
      { hpThreshold: 1.0, attack: 'slam', telegraph: 1.2 },
      { hpThreshold: 0.6, attack: 'chargedBeam', telegraph: 2.0, speedMult: 1.3 },
      { hpThreshold: 0.25, attack: 'summonSwarm', telegraph: 1.5, speedMult: 1.5 }
    ]
  },
  {
    id: 'wyrm', name: 'Wyrm Ailé', icon: '🐉', color: 0xab47bc,
    baseHp: 1900, speed: 3.4, damage: 26, goldValue: 320, xpValue: 260, crystalDrop: 4,
    scale: 2.8, flying: true,
    phases: [
      { hpThreshold: 1.0, attack: 'dive', telegraph: 1.0 },
      { hpThreshold: 0.5, attack: 'chargedBeam', telegraph: 1.8, speedMult: 1.2 },
      { hpThreshold: 0.2, attack: 'summonSwarm', telegraph: 1.3, speedMult: 1.6 }
    ]
  }
];
