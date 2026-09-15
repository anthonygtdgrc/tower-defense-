const SAVE_KEY = 'bastion3d_save_v1';

const DEFAULT_SAVE = {
  essence: 0,
  talents: {}, // id -> rank purchased
  unlockedClasses: ['warrior'],
  unlockedMaps: ['valley'],
  achievements: [],
  stats: {
    totalWavesSurvived: 0,
    totalBossKills: 0,
    bestWave: 0,
    runsPlayed: 0
  },
  settings: {
    difficulty: 'normal',
    audioEnabled: true
  }
};

export class SaveManager {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return structuredClone(DEFAULT_SAVE);
      const parsed = JSON.parse(raw);
      return { ...structuredClone(DEFAULT_SAVE), ...parsed, talents: parsed.talents || {}, stats: { ...DEFAULT_SAVE.stats, ...(parsed.stats || {}) } };
    } catch {
      return structuredClone(DEFAULT_SAVE);
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // storage unavailable (private mode, quota) — fail silently, run continues.
    }
  }

  addEssence(amount) {
    this.data.essence += amount;
    this.save();
  }

  spendEssence(amount) {
    if (this.data.essence < amount) return false;
    this.data.essence -= amount;
    this.save();
    return true;
  }

  talentRank(id) { return this.data.talents[id] || 0; }
  setTalentRank(id, rank) { this.data.talents[id] = rank; this.save(); }

  unlockAchievement(id) {
    if (!this.data.achievements.includes(id)) {
      this.data.achievements.push(id);
      this.save();
      return true;
    }
    return false;
  }

  recordRun({ wavesSurvived, bossesKilled }) {
    this.data.stats.totalWavesSurvived += wavesSurvived;
    this.data.stats.totalBossKills += bossesKilled;
    this.data.stats.bestWave = Math.max(this.data.stats.bestWave, wavesSurvived);
    this.data.stats.runsPlayed += 1;
    this.save();
  }
}
