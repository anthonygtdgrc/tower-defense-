import { ENEMY_TYPES, ELITE_MODIFIERS, BOSS_TYPES } from './enemies.js';

// Non-linear difficulty curve: gentle growth punctuated by spikes every 5
// waves (elite) and hard spikes every 10 (boss), rather than pure linear scaling.
export function waveScaling(waveNumber) {
  const base = 1 + waveNumber * 0.09;
  const spikeCycle = waveNumber % 10;
  let spike = 1;
  if (spikeCycle === 0) spike = 1.0; // boss handled separately
  else if (spikeCycle % 5 === 0) spike = 1.35; // elite wave spike
  else if (spikeCycle >= 8) spike = 1.15; // ramp just before boss
  const plateauBreak = Math.floor(waveNumber / 10) * 0.25; // permanent ratchet after each boss
  return base * spike + plateauBreak;
}

export function isEliteWave(waveNumber) {
  return waveNumber % 5 === 0 && waveNumber % 10 !== 0;
}

export function isBossWave(waveNumber) {
  return waveNumber % 10 === 0;
}

export function pathCountForWave(waveNumber) {
  if (waveNumber >= 20) return 3;
  if (waveNumber >= 8) return 2;
  return 1;
}

const NORMAL_POOL = ['basic', 'fast', 'armored', 'flying', 'regen', 'invisible', 'kamikaze', 'summoner'];

export function composeWave(waveNumber, difficultyMods = {}) {
  const scale = waveScaling(waveNumber);
  const enemyHpMult = (difficultyMods.enemyHpMult ?? 1) * scale;
  const enemyDmgMult = (difficultyMods.enemyDmgMult ?? 1) * (1 + waveNumber * 0.05);
  const enemyCountMult = difficultyMods.enemyCountMult ?? 1;

  if (isBossWave(waveNumber)) {
    const bossDef = BOSS_TYPES[(waveNumber / 10 - 1) % BOSS_TYPES.length];
    const escorts = Math.min(6, Math.floor(waveNumber / 3));
    const entries = [];
    for (let i = 0; i < escorts; i++) {
      entries.push({ type: NORMAL_POOL[i % 4], elite: false, delay: i * 1.2 });
    }
    return {
      waveNumber, kind: 'boss', boss: bossDef,
      enemyHpMult, enemyDmgMult,
      entries,
      pathCount: pathCountForWave(waveNumber)
    };
  }

  const elite = isEliteWave(waveNumber);
  const count = Math.round((8 + waveNumber * 1.6) * enemyCountMult);
  const entries = [];
  const unlockedTypes = NORMAL_POOL.slice(0, Math.min(NORMAL_POOL.length, 2 + Math.floor(waveNumber / 3)));
  for (let i = 0; i < count; i++) {
    const type = unlockedTypes[Math.floor(Math.random() * unlockedTypes.length)];
    let mod = null;
    if (elite && Math.random() < 0.5) {
      mod = ELITE_MODIFIERS[Math.floor(Math.random() * ELITE_MODIFIERS.length)];
    }
    entries.push({ type, elite: !!mod, modifier: mod, delay: i * 0.75 });
  }

  return {
    waveNumber, kind: elite ? 'elite' : 'normal',
    enemyHpMult: enemyHpMult * (elite ? 1.15 : 1),
    enemyDmgMult,
    entries,
    pathCount: pathCountForWave(waveNumber)
  };
}

export function previewIcons(waveData) {
  if (waveData.kind === 'boss') {
    return [{ icon: waveData.boss.icon, count: 1, boss: true }, ...summarize(waveData.entries)];
  }
  return summarize(waveData.entries);
}

function summarize(entries) {
  const counts = {};
  for (const e of entries) {
    const key = e.elite ? `${e.type}_elite` : e.type;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts).map(([key, count]) => {
    const isElite = key.endsWith('_elite');
    const type = isElite ? key.slice(0, -6) : key;
    return { icon: ENEMY_TYPES[type].icon, count, elite: isElite };
  });
}
