import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { ENEMY_TYPES } from '../data/enemies.js';
import { composeWave, previewIcons, pathCountForWave, isBossWave, isEliteWave } from '../data/waves.js';

const PREP_TIME = 18;

export class WaveManager {
  constructor(scene, level, bus, audio, mods = {}) {
    this.scene = scene;
    this.level = level;
    this.bus = bus;
    this.audio = audio;
    this.mods = mods; // { enemyHpMult, enemyDmgMult, enemyCountMult } from difficulty + run modifiers
    this.waveNumber = 0;
    this.state = 'prep'; // 'prep' | 'active' | 'cleared'
    this.prepTimer = PREP_TIME;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.currentWaveData = null;
    this.pendingBoss = null;
    this._advanceToNext();
  }

  _advanceToNext() {
    this.waveNumber += 1;
    this.state = 'prep';
    this.prepTimer = PREP_TIME;
    const pathCount = pathCountForWave(this.waveNumber);
    this.level.setActiveLaneCount(pathCount);
    this.level.refreshPathVisual();
    this.currentWaveData = composeWave(this.waveNumber, this.mods);
    this.bus.emit('wave:preview', {
      waveNumber: this.waveNumber,
      kind: this.currentWaveData.kind,
      icons: previewIcons(this.currentWaveData),
      pathCount
    });
  }

  skipPreparation(economy) {
    if (this.state !== 'prep') return false;
    const bonus = Math.round(20 + this.waveNumber * 2.5);
    economy.addGold(bonus);
    this.prepTimer = 0;
    this.bus.emit('wave:skipped', { bonus });
    return true;
  }

  _beginSpawning() {
    this.state = 'active';
    this.audio.sfx.waveStart();
    this.audio.setIntensity(isBossWave(this.waveNumber) ? 1 : isEliteWave(this.waveNumber) ? 0.75 : 0.55);
    this.bus.emit('wave:start', { waveNumber: this.waveNumber, kind: this.currentWaveData.kind });

    const data = this.currentWaveData;
    this.spawnQueue = data.entries.map((e, idx) => ({
      ...e,
      laneIndex: idx % data.pathCount
    }));
    this.spawnTimer = 0;
    this.bossSpawned = false;
    this.enemiesRemainingToSpawn = this.spawnQueue.length + (data.kind === 'boss' ? 1 : 0);
  }

  update(dt, ctx) {
    if (this.state === 'prep') {
      this.prepTimer -= dt;
      if (this.prepTimer <= 0) this._beginSpawning();
      return;
    }
    if (this.state !== 'active') return;

    this.spawnTimer += dt;
    while (this.spawnQueue.length && this.spawnQueue[0].delay <= this.spawnTimer) {
      const entry = this.spawnQueue.shift();
      this._spawnEnemy(entry, ctx);
    }
    if (!this.spawnQueue.length && !this.bossSpawned && this.currentWaveData.kind === 'boss') {
      this.bossSpawned = true;
      this._spawnBoss(ctx);
    }
  }

  _spawnEnemy(entry, ctx) {
    const def = ENEMY_TYPES[entry.type];
    const path = this.level.lanePaths[entry.laneIndex] || this.level.lanePaths[0];
    const enemy = new Enemy(this.scene, def, {
      path,
      hpMult: this.currentWaveData.enemyHpMult,
      dmgMult: this.currentWaveData.enemyDmgMult,
      modifier: entry.modifier,
      waveNumber: this.waveNumber
    });
    enemy.laneIndex = entry.laneIndex;
    ctx.enemies.push(enemy);
  }

  spawnFollowUp(type, atPosition, laneIndex, ctx, startPathIndex = 0) {
    const def = ENEMY_TYPES[type];
    const path = this.level.lanePaths[laneIndex] || this.level.lanePaths[0];
    const enemy = new Enemy(this.scene, def, {
      path, hpMult: this.currentWaveData.enemyHpMult * 0.6, dmgMult: this.currentWaveData.enemyDmgMult,
      modifier: null, waveNumber: this.waveNumber
    });
    enemy.position.copy(atPosition);
    enemy.pathIndex = Math.min(startPathIndex, path ? path.length - 1 : 0);
    enemy.laneIndex = laneIndex;
    ctx.enemies.push(enemy);
  }

  _spawnBoss(ctx) {
    const bossDef = this.currentWaveData.boss;
    const path = this.level.lanePaths[0];
    const boss = new Boss(this.scene, bossDef, {
      path, hpMult: this.currentWaveData.enemyHpMult, dmgMult: this.currentWaveData.enemyDmgMult,
      waveNumber: this.waveNumber
    });
    boss.laneIndex = 0;
    ctx.enemies.push(boss);
    this.audio.sfx.bossRoar();
    this.bus.emit('boss:spawned', { boss });
  }

  checkWaveComplete(enemies) {
    if (this.state !== 'active') return false;
    const stillSpawning = this.spawnQueue.length > 0 || (this.currentWaveData.kind === 'boss' && !this.bossSpawned);
    if (stillSpawning) return false;
    const anyAlive = enemies.some((e) => !e.dead);
    if (anyAlive) return false;
    this.state = 'cleared';
    this.audio.setIntensity(0.15);
    this.bus.emit('wave:cleared', { waveNumber: this.waveNumber });
    return true;
  }

  startNextWave() {
    this._advanceToNext();
  }
}
