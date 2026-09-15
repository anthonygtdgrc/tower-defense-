import { PERMANENT_TALENTS, essenceFromRun, DIFFICULTIES, RUN_MODIFIERS } from '../data/meta.js';

export class MetaProgression {
  constructor(saveManager) {
    this.save = saveManager;
  }

  get essence() { return this.save.data.essence; }

  talentRank(id) { return this.save.talentRank(id); }

  canPurchase(id) {
    const def = PERMANENT_TALENTS.find((t) => t.id === id);
    if (!def) return false;
    const rank = this.talentRank(id);
    if (rank >= def.max) return false;
    return this.essence >= this._costForRank(def, rank);
  }

  _costForRank(def, rank) {
    return Math.round(def.cost * Math.pow(1.4, rank));
  }

  purchase(id) {
    const def = PERMANENT_TALENTS.find((t) => t.id === id);
    if (!def || !this.canPurchase(id)) return false;
    const rank = this.talentRank(id);
    const cost = this._costForRank(def, rank);
    if (!this.save.spendEssence(cost)) return false;
    this.save.setTalentRank(id, rank + 1);
    if (def.effect.unlockClass) {
      const classes = new Set(this.save.data.unlockedClasses);
      classes.add(def.effect.unlockClass);
      this.save.data.unlockedClasses = [...classes];
      this.save.save();
    }
    if (def.effect.unlockMap) {
      const maps = new Set(this.save.data.unlockedMaps);
      maps.add(def.effect.unlockMap);
      this.save.data.unlockedMaps = [...maps];
      this.save.save();
    }
    return true;
  }

  getEffects() {
    const effects = { startGold: 0, baseMaxHpMult: 1, playerMaxHpMult: 1, towerCostMult: 1, xpMult: 1, crystalDropMult: 1 };
    for (const def of PERMANENT_TALENTS) {
      const rank = this.talentRank(def.id);
      if (!rank) continue;
      for (const [k, v] of Object.entries(def.effect)) {
        if (k === 'unlockClass' || k === 'unlockMap') continue;
        if (k.endsWith('Mult')) effects[k] = (effects[k] ?? 1) * Math.pow(v, rank);
        else effects[k] = (effects[k] ?? 0) + v * rank;
      }
    }
    return effects;
  }

  finishRun({ wavesSurvived, bossesKilled, difficulty }) {
    const diffMult = DIFFICULTIES[difficulty]?.scoreMult ?? 1;
    const essence = essenceFromRun({ wavesSurvived, bossesKilled, difficultyMult: diffMult });
    this.save.addEssence(essence);
    this.save.recordRun({ wavesSurvived, bossesKilled });
    return essence;
  }
}

export function getDifficultyMods(difficultyId) {
  return DIFFICULTIES[difficultyId] || DIFFICULTIES.normal;
}

export function getRunModifierEffects(selectedIds) {
  const merged = {};
  for (const id of selectedIds) {
    const mod = RUN_MODIFIERS.find((m) => m.id === id);
    if (!mod) continue;
    for (const [k, v] of Object.entries(mod.effect)) {
      merged[k] = (merged[k] ?? (k.endsWith('Mult') ? 1 : 0)) * (k.endsWith('Mult') ? v : 1) + (k.endsWith('Mult') ? 0 : v);
    }
  }
  return merged;
}
