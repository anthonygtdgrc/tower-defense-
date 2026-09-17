import * as THREE from 'three';
import { Tower } from '../entities/Tower.js';
import { TOWER_TYPES, FUSION_REQUIREMENT, MAX_TOWER_LEVEL, upgradeCost } from '../data/towers.js';
import { Projectile } from '../entities/Projectile.js';
import { applyStatusToTarget } from './StatusEffects.js';
import { rollRuneOffer } from '../data/runes.js';

const INVISIBLE_DETECTORS = new Set(['mage', 'control', 'trap']);

export class TowerManager {
  constructor(scene, level, bus, audio, economy) {
    this.scene = scene;
    this.level = level;
    this.bus = bus;
    this.audio = audio;
    this.economy = economy;
    this.towers = [];
    this.selected = null;
    this._overcharges = new Map(); // tower.id -> { timer, fireRateMult }
  }

  costFor(typeId, costMult = 1) {
    return Math.round(TOWER_TYPES[typeId].baseCost * costMult);
  }

  canPlace(x, z) {
    return this.level.isBuildable(x, z);
  }

  place(typeId, x, z, costMult = 1) {
    const cost = this.costFor(typeId, costMult);
    if (!this.economy.spendGold(cost)) return { ok: false, reason: 'gold' };
    const result = this.level.tryOccupyCell(x, z);
    if (!result.ok) { this.economy.addGold(cost); return result; }
    this.level.refreshPathVisual();
    const worldPos = this.level.cellCenterWorld(result.col, result.row);
    const tower = new Tower(this.scene, typeId, result.col, result.row, worldPos);
    this.towers.push(tower);
    this.audio.sfx.towerPlace();
    this.bus.emit('tower:placed', { tower });
    return { ok: true, tower };
  }

  sell(tower) {
    const refund = Math.round(this.costFor(tower.typeId) * 0.5 * (tower.level));
    this.economy.addGold(refund);
    this.level.freeCell(tower.col, tower.row);
    this.level.refreshPathVisual();
    tower.destroy();
    this.towers = this.towers.filter((t) => t !== tower);
    if (this.selected === tower) this.selected = null;
    return refund;
  }

  upgrade(tower, costMult = 1) {
    if (!tower.canUpgrade()) return false;
    const cost = Math.round(tower.upgradeCost() * costMult);
    if (!this.economy.spendGold(cost)) return false;
    tower.upgrade();
    this.audio.sfx.towerUpgrade();
    this.bus.emit('tower:upgraded', { tower });
    return true;
  }

  specialize(tower, branch) {
    if (!tower.chooseSpecialization(branch)) return false;
    this.bus.emit('tower:specialized', { tower, branch });
    return true;
  }

  canFuse(typeId) {
    const maxed = this.towers.filter((t) => t.typeId === typeId && t.level === MAX_TOWER_LEVEL && !t.fusedFrom);
    return maxed.length >= FUSION_REQUIREMENT;
  }

  fuse(typeId) {
    const maxed = this.towers.filter((t) => t.typeId === typeId && t.level === MAX_TOWER_LEVEL && !t.fusedFrom);
    if (maxed.length < FUSION_REQUIREMENT) return null;
    const group = maxed.slice(0, FUSION_REQUIREMENT);
    const anchor = group[0];
    for (const t of group.slice(1)) {
      this.level.freeCell(t.col, t.row);
      t.destroy();
      this.towers = this.towers.filter((x) => x !== t);
    }
    this.level.refreshPathVisual();
    anchor.fusedFrom = FUSION_REQUIREMENT;
    anchor.level = MAX_TOWER_LEVEL; // stays max level but gets a hybrid multiplier
    anchor._hybridMult = 1.9;
    anchor.body.scale.setScalar(1.4);
    anchor.bodyMat.emissive = new THREE.Color(0xffffff);
    anchor.bodyMat.emissiveIntensity = 0.5;
    this.bus.emit('tower:fused', { tower: anchor });
    this.bus.emit('achievement:progress', { id: 'fusion_master' });
    return anchor;
  }

  canAddRune(tower) {
    return tower.runes.length < tower.maxRuneSlots();
  }

  getRuneOffer(tower) {
    if (!this.canAddRune(tower)) return [];
    return rollRuneOffer(tower.runes.map((r) => r.id), 3);
  }

  addRune(tower, rune) {
    if (!this.canAddRune(tower)) return false;
    if (!this.economy.spendCrystals(rune.cost)) return false;
    tower.runes.push(rune);
    tower.refreshRuneVisual();
    this.bus.emit('tower:rune-added', { tower, rune });
    return true;
  }

  removeRune(tower, index) {
    if (index < 0 || index >= tower.runes.length) return false;
    tower.runes.splice(index, 1);
    tower.refreshRuneVisual();
    return true;
  }

  applyOvercharge(tower, duration, fireRateMult) {
    this._overcharges.set(tower.id, { timer: duration, fireRateMult });
  }

  repairAll(amount) {
    for (const t of this.towers) t.repair(amount);
  }

  _computeAuras() {
    const auraMap = new Map();
    for (const support of this.towers) {
      if (support.def.id !== 'support') continue;
      const stats = support.effectiveStats();
      const aura = { ...support.def.aura };
      if (support.specialization) {
        Object.assign(aura, support.def.specializations[support.specialization].aura);
      }
      for (const other of this.towers) {
        if (other === support || other.def.id === 'support') continue;
        if (other.position.distanceTo(support.position) <= stats.range) {
          auraMap.set(other.id, aura);
        }
      }
    }
    return auraMap;
  }

  _selectTarget(tower, stats, enemies) {
    const candidates = [];
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if (enemy.flying && !stats.targetsFlyingResolved) continue;
      if (enemy.invisible && !INVISIBLE_DETECTORS.has(tower.def.id)) continue;
      const dist = tower.position.distanceTo(enemy.position);
      if (dist > stats.range) continue;
      candidates.push(enemy);
    }
    if (candidates.length === 0) return null;
    switch (tower.targetingMode) {
      case 'strongest':
        return candidates.reduce((a, b) => (b.hp > a.hp ? b : a));
      case 'first':
        return candidates.reduce((a, b) => (b.pathIndex > a.pathIndex ? b : a));
      case 'last':
        return candidates.reduce((a, b) => (b.pathIndex < a.pathIndex ? b : a));
      case 'closest':
      default:
        return candidates.reduce((a, b) => (tower.position.distanceTo(b.position) < tower.position.distanceTo(a.position) ? b : a));
    }
  }

  update(dt, { enemies, projectiles, findSplashTargets }) {
    for (const [id, oc] of this._overcharges) {
      oc.timer -= dt;
      if (oc.timer <= 0) this._overcharges.delete(id);
    }
    const auraMap = this._computeAuras();

    for (const tower of this.towers) {
      if (tower.hp <= 0) continue;
      if (tower.def.id === 'support') continue; // support towers don't attack
      const aura = { ...(auraMap.get(tower.id) || {}) };
      const oc = this._overcharges.get(tower.id);
      if (oc) aura.fireRateMult = (aura.fireRateMult || 1) * oc.fireRateMult;
      const stats = tower.effectiveStats(aura);
      stats.targetsFlyingResolved = tower.def.targetsFlying;
      if (tower.fusedFrom) stats.damage *= tower._hybridMult;

      tower.cooldownTimer -= dt;
      const target = this._selectTarget(tower, stats, enemies);
      tower.faceTarget(target ? target.position : null);
      if (target && tower.cooldownTimer <= 0) {
        tower.cooldownTimer = 1 / Math.max(0.05, stats.fireRate);
        this._fire(tower, target, stats, projectiles);
      }
    }
  }

  _fire(tower, target, stats, projectiles) {
    this.audio.sfx.towerShot();
    let dmg = stats.damage;
    if (target.flying) dmg *= stats.flyingDamageMult ?? 1;
    if (tower.def.id === 'trap') {
      // instant contact damage, no projectile travel
      target.takeDamage(dmg, stats.damageType);
      applyStatusToTarget(target, stats.status, dmg);
      return;
    }
    const proj = new Projectile(this.scene, {
      from: tower.muzzlePosition, target, speed: stats.projectileSpeed, damage: dmg,
      color: tower.def.color, kind: tower.def.id === 'aoe' ? 'aoe' : (tower.def.damageType === 'magic' ? 'magic' : 'physical'),
      splashRadius: stats.splashRadius, source: tower, status: stats.status
    });
    projectiles.push(proj);
  }
}
