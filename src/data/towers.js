// Tower definitions. Each tower has 5 levels; at level 3 the player chooses a
// specialization branch (A or B) which changes stats/behavior for levels 4-5.
// Colors are used for the placeholder geometry (no art pipeline).

export const TOWER_TYPES = {
  ballistic: {
    id: 'ballistic',
    name: 'Tourelle Balistique',
    description: 'Dégâts physiques, cadence rapide.',
    color: 0x9aa5b1,
    baseCost: 60,
    damageType: 'physical',
    range: 9,
    fireRate: 2.2, // shots/sec
    damage: 8,
    projectileSpeed: 34,
    targetsFlying: false,
    icon: '🔫',
    specializations: {
      A: { name: 'Sniper Longue Portée', rangeMult: 1.9, fireRateMult: 0.35, damageMult: 3.2 },
      B: { name: 'Mitrailleuse Rapide', rangeMult: 0.85, fireRateMult: 2.6, damageMult: 0.6 }
    }
  },
  mage: {
    id: 'mage',
    name: 'Tour de Mage',
    description: 'Dégâts magiques avec effets de statut (brûlure, gel, poison).',
    color: 0x7c5cff,
    baseCost: 90,
    damageType: 'magic',
    range: 8,
    fireRate: 1.1,
    damage: 10,
    projectileSpeed: 22,
    status: 'burn',
    targetsFlying: false,
    icon: '🔮',
    specializations: {
      A: { name: 'Pyromancien', status: 'burn', damageMult: 1.5 },
      B: { name: 'Cryomancien', status: 'freeze', damageMult: 1.0 }
    }
  },
  aoe: {
    id: 'aoe',
    name: 'Tour de Zone',
    description: "Dégâts en explosion, faible cadence.",
    color: 0xff7043,
    baseCost: 110,
    damageType: 'physical',
    range: 7,
    fireRate: 0.6,
    damage: 22,
    splashRadius: 3.2,
    projectileSpeed: 18,
    targetsFlying: false,
    icon: '💥',
    specializations: {
      A: { name: 'Mortier Lourd', splashRadiusMult: 1.6, damageMult: 1.8, fireRateMult: 0.7 },
      B: { name: 'Lance-grenades', splashRadiusMult: 0.8, damageMult: 0.9, fireRateMult: 1.8 }
    }
  },
  support: {
    id: 'support',
    name: 'Tour de Soutien',
    description: "Buff les tours alentour (dégâts, cadence, portée). N'attaque pas.",
    color: 0xffd54f,
    baseCost: 100,
    damageType: 'none',
    range: 6,
    fireRate: 0,
    damage: 0,
    aura: { damageMult: 1.2, fireRateMult: 1.15, rangeMult: 1.1 },
    icon: '⭐',
    specializations: {
      A: { name: "Amplificateur", aura: { damageMult: 1.45 } },
      B: { name: 'Chronomancien', aura: { fireRateMult: 1.4 } }
    }
  },
  control: {
    id: 'control',
    name: 'Tour de Contrôle',
    description: 'Ralentit, stun ou immobilise les ennemis.',
    color: 0x4fc3f7,
    baseCost: 85,
    damageType: 'control',
    range: 7.5,
    fireRate: 0.9,
    damage: 2,
    status: 'slow',
    targetsFlying: false,
    icon: '❄️',
    specializations: {
      A: { name: 'Geôlier', status: 'root', damageMult: 1 },
      B: { name: 'Étourdisseur', status: 'stun', damageMult: 1 }
    }
  },
  antiair: {
    id: 'antiair',
    name: 'Tour Anti-Aérienne',
    description: 'Nécessaire contre les ennemis volants.',
    color: 0x66bb6a,
    baseCost: 95,
    damageType: 'physical',
    range: 10,
    fireRate: 1.6,
    damage: 14,
    projectileSpeed: 40,
    targetsFlying: true,
    flyingOnly: false,
    flyingDamageMult: 2.2,
    icon: '🚀',
    specializations: {
      A: { name: 'Flak Lourd', flyingDamageMult: 3.2, fireRateMult: 0.8 },
      B: { name: 'Missiles Guidés', fireRateMult: 1.3, projectileSpeedMult: 1.6 }
    }
  },
  trap: {
    id: 'trap',
    name: 'Tour Piège',
    description: 'Invisible, dégâts massifs à l\'activation, se recharge.',
    color: 0x8d6e63,
    baseCost: 70,
    damageType: 'physical',
    range: 2.2,
    fireRate: 0.2, // slow recharge
    damage: 60,
    invisible: true,
    icon: '🪤',
    specializations: {
      A: { name: 'Piège à Pointes', damageMult: 2.0 },
      B: { name: 'Piège Incendiaire', status: 'burn', damageMult: 1.2 }
    }
  }
};

export const TOWER_LIST = Object.values(TOWER_TYPES);

// Level scaling multipliers applied cumulatively per level (1-indexed).
export function levelMultiplier(level) {
  return 1 + (level - 1) * 0.45;
}

export function upgradeCost(baseCost, level) {
  return Math.round(baseCost * 0.7 * Math.pow(1.55, level - 1));
}

export const FUSION_REQUIREMENT = 3; // number of max-level towers of same type needed
export const MAX_TOWER_LEVEL = 5;
export const SPECIALIZATION_LEVEL = 3;
