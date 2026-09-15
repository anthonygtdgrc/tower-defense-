import * as THREE from 'three';
import { Enemy } from './Enemy.js';

// Boss enemy: multi-phase, telegraphed attacks. Phases trigger once hp drops
// below their threshold. A "chargedBeam" targets a tower and can be
// interrupted by dealing enough damage to the boss during the telegraph.
export class Boss extends Enemy {
  constructor(scene, def, opts) {
    const fakeDef = {
      hp: def.baseHp, speed: def.speed, damage: def.damage, goldValue: def.goldValue,
      xpValue: def.xpValue, scale: def.scale, flying: def.flying, color: def.color
    };
    super(scene, fakeDef, opts);
    this.isBoss = true;
    this.bossDef = def;
    this.crystalDrop = def.crystalDrop;
    this.phases = def.phases;
    this.currentPhaseIndex = 0;
    this.attackState = null; // { attack, telegraphTime, totalTelegraph, target }
    this.attackCooldown = 3;
    this.damageTakenDuringTelegraph = 0;
    this.hitboxHeight = 3;
    this._buildBossVisual();
  }

  _buildBossVisual() {
    // Give the boss a menacing ring + larger silhouette on top of the base mesh.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.1, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 0.6 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    this.mesh.add(ring);
    this._ring = ring;
  }

  update(dt, ctx) {
    if (this.dead) return;
    // phase transitions
    const hpRatio = this.hp / this.maxHp;
    while (this.currentPhaseIndex < this.phases.length - 1 && hpRatio <= this.phases[this.currentPhaseIndex + 1].hpThreshold) {
      this.currentPhaseIndex++;
      ctx.onBossPhase?.(this, this.phases[this.currentPhaseIndex]);
    }

    if (this.attackState) {
      this.attackState.telegraphTime -= dt;
      this.damageTakenDuringTelegraph += this._pendingDamageThisFrame || 0;
      this._pendingDamageThisFrame = 0;
      if (this.attackState.telegraphTime <= 0) {
        this._resolveAttack(ctx);
      }
    } else {
      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) this._beginAttack(ctx);
    }

    super.update(dt, ctx);
    if (this._ring) this._ring.rotation.z += dt * 1.5;
  }

  takeDamage(amount, damageType) {
    const dealt = super.takeDamage(amount, damageType);
    this._pendingDamageThisFrame = (this._pendingDamageThisFrame || 0) + dealt;
    return dealt;
  }

  _beginAttack(ctx) {
    const phase = this.phases[this.currentPhaseIndex];
    this.attackState = {
      attack: phase.attack,
      telegraphTime: phase.telegraph,
      totalTelegraph: phase.telegraph,
      target: phase.attack === 'chargedBeam' ? ctx.pickRandomTower?.() : null
    };
    this.damageTakenDuringTelegraph = 0;
    ctx.onBossTelegraph?.(this, this.attackState);
  }

  _resolveAttack(ctx) {
    const state = this.attackState;
    const interruptThreshold = this.maxHp * 0.06;
    const interrupted = this.damageTakenDuringTelegraph >= interruptThreshold;
    ctx.onBossAttackResolve?.(this, state, interrupted);
    this.attackState = null;
    this.attackCooldown = 5 + Math.random() * 2;
  }
}
