import * as THREE from 'three';
import { ABILITIES } from '../data/skills.js';
import { Projectile } from './Projectile.js';

const GRAVITY = -24;
const GROUND_Y = 0;

export class Player {
  constructor(scene, progression, bus, audio) {
    this.scene = scene;
    this.progression = progression;
    this.bus = bus;
    this.audio = audio;

    this.position = new THREE.Vector3(0, GROUND_Y, 10);
    this.velocityY = 0;
    this.grounded = true;
    this.facingYaw = 0;

    this.hp = this.stats.maxHp;
    this.stamina = this.stats.maxStamina;
    this.sprinting = false;
    this.dashing = false;
    this.dashTime = 0;
    this.dashCooldownTimer = 0;
    this.invincible = false;
    this._invincibleTimer = 0;
    this._staminaRegenDelay = 0;

    this.cooldowns = { melee: 0, ranged: 0, a: 0, e: 0, r: 0, f: 0 };
    this.alive = true;

    this._buildMesh();
  }

  get stats() { return this.progression.getStats(); }

  // A small stylized hero built from primitives: armored torso, cape, a
  // sword-and-shield pair on the arms, and a simple walk-cycle rig (legs and
  // arms swing from hip/shoulder pivots) driven from _updateVisuals().
  _buildMesh() {
    this.group = new THREE.Group();

    const armorMat = new THREE.MeshStandardMaterial({ color: 0x3f78c9, roughness: 0.45, metalness: 0.15 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1f3a5c, roughness: 0.5, metalness: 0.2 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x5b3a29, roughness: 0.7 });
    const capeMat = new THREE.MeshStandardMaterial({ color: 0xb8302f, roughness: 0.8, side: THREE.DoubleSide });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.7, roughness: 0.25 });
    const hiltMat = new THREE.MeshStandardMaterial({ color: 0x8d6e40, roughness: 0.6 });

    const HIP_Y = 0.9;
    const SHOULDER_Y = 1.55;

    // --- torso + belt + head (static, non-animated parts) ---
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.36), armorMat);
    torso.position.y = HIP_Y + 0.35;
    torso.castShadow = true;
    this.group.add(torso);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.12, 0.4), trimMat);
    belt.position.y = HIP_Y;
    this.group.add(belt);

    const pauldronGeo = new THREE.SphereGeometry(0.16, 8, 8);
    for (const side of [-1, 1]) {
      const pauldron = new THREE.Mesh(pauldronGeo, trimMat);
      pauldron.position.set(side * 0.36, SHOULDER_Y + 0.05, 0);
      pauldron.castShadow = true;
      this.group.add(pauldron);
    }

    const headGroup = new THREE.Group();
    headGroup.position.y = SHOULDER_Y + 0.42;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), skinMat);
    head.castShadow = true;
    headGroup.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.29, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.y = 0.05;
    headGroup.add(hair);
    this.group.add(headGroup);
    this.headGroup = headGroup;

    // --- cape, hanging from the shoulders ---
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.85, 1, 4), capeMat);
    cape.position.set(0, SHOULDER_Y - 0.28, -0.2);
    cape.rotation.x = 0.15;
    cape.castShadow = true;
    this.group.add(cape);
    this.cape = cape;

    // --- legs (each a hip-pivoted group so it can swing for the walk cycle) ---
    this.legs = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.18, HIP_Y, 0);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.45, 0.26), pantsMat);
      thigh.position.y = -0.22;
      thigh.castShadow = true;
      pivot.add(thigh);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.34), trimMat);
      boot.position.set(0, -0.54, 0.04);
      boot.castShadow = true;
      pivot.add(boot);
      this.group.add(pivot);
      return pivot;
    });

    // --- arms (shoulder-pivoted groups; right hand carries the sword, left the shield) ---
    this.arms = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.4, SHOULDER_Y, 0);
      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.42, 8), armorMat);
      upperArm.position.y = -0.21;
      upperArm.castShadow = true;
      pivot.add(upperArm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), skinMat);
      hand.position.y = -0.44;
      pivot.add(hand);
      this.group.add(pivot);
      return pivot;
    });
    const [leftArm, rightArm] = this.arms;

    const sword = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.02), bladeMat);
    blade.position.y = 0.31;
    sword.add(blade);
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 6), hiltMat);
    hilt.rotation.z = Math.PI / 2;
    sword.add(hilt);
    sword.position.y = -0.5;
    sword.rotation.x = -0.15;
    rightArm.add(sword);
    this.weapon = sword;

    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12), armorMat);
    shield.rotation.z = Math.PI / 2;
    shield.position.set(-0.1, -0.44, 0);
    const shieldRim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 16), trimMat);
    shieldRim.rotation.y = Math.PI / 2;
    shield.add(shieldRim);
    leftArm.add(shield);

    this.group.position.copy(this.position);
    this.scene.add(this.group);

    this._walkPhase = 0;
  }

  takeDamage(amount) {
    if (this.invincible || !this.alive) return 0;
    const armorReduction = Math.min(0.75, this.stats.armor);
    const dealt = amount * (1 - armorReduction);
    this.hp -= dealt;
    this.audio.sfx.playerHurt();
    this.bus.emit('player:damaged', { amount: dealt, hp: this.hp, maxHp: this.stats.maxHp });
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.bus.emit('player:died', {});
    }
    return dealt;
  }

  heal(amount) {
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
  }

  update(dt, { input, cameraRig, world }) {
    if (!this.alive) return;
    this._tickCooldowns(dt);
    this._handleMovement(dt, input, cameraRig);
    if (!world.suppressCombat) this._handleCombatInput(dt, input, cameraRig, world);
    this._handleAbilities(dt, input, world);
    this.group.position.copy(this.position);
    this.group.rotation.y = this.facingYaw;
    this._updateVisuals(dt);
  }

  _updateVisuals(dt) {
    // weapon swing animation feedback (relative to the arm's own walk-cycle pose)
    if (this._swingTimer > 0) {
      this._swingTimer -= dt;
      this.weapon.rotation.x = -0.15 + Math.sin((1 - this._swingTimer / 0.22) * Math.PI) * 1.8;
    } else {
      this.weapon.rotation.x = -0.15;
    }

    // Walk cycle: legs/arms swing from their hip/shoulder pivots while
    // grounded and moving; airborne poses tuck legs together instead.
    const [leftLeg, rightLeg] = this.legs;
    const [leftArm, rightArm] = this.arms;
    if (!this.grounded) {
      const t = Math.min(1, Math.abs(this.velocityY) / 8);
      leftLeg.rotation.x = 0.3 * t;
      rightLeg.rotation.x = 0.3 * t;
      leftArm.rotation.x = -0.2;
      rightArm.rotation.x = -0.2;
    } else if (this._animMoving) {
      const cycleSpeed = (this.sprinting ? 11 : 7) + (this.dashing ? 6 : 0);
      this._walkPhase += dt * cycleSpeed;
      const swing = Math.sin(this._walkPhase) * (this.sprinting ? 0.75 : 0.55);
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      leftArm.rotation.x = -swing * 0.7;
      rightArm.rotation.x = swing * 0.7;
      this.headGroup.position.y = 1.97 + Math.abs(Math.sin(this._walkPhase)) * 0.02;
    } else {
      // idle: ease limbs back to rest and add a slow breathing bob
      this._walkPhase += dt * 1.6;
      leftLeg.rotation.x += (0 - leftLeg.rotation.x) * Math.min(1, dt * 8);
      rightLeg.rotation.x += (0 - rightLeg.rotation.x) * Math.min(1, dt * 8);
      leftArm.rotation.x += (0 - leftArm.rotation.x) * Math.min(1, dt * 8);
      rightArm.rotation.x += (0 - rightArm.rotation.x) * Math.min(1, dt * 8);
      this.headGroup.position.y = 1.97 + Math.sin(this._walkPhase) * 0.008;
    }
  }

  _tickCooldowns(dt) {
    for (const k of Object.keys(this.cooldowns)) {
      if (this.cooldowns[k] > 0) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    }
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this._invincibleTimer > 0) {
      this._invincibleTimer -= dt;
      if (this._invincibleTimer <= 0) this.invincible = false;
    }
    if (this._staminaRegenDelay > 0) this._staminaRegenDelay -= dt;
    else this.stamina = Math.min(this.stats.maxStamina, this.stamina + this.stats.staminaRegen * dt);
  }

  _handleMovement(dt, input, cameraRig) {
    const stats = this.stats;
    if (this.dashing) {
      this.dashTime -= dt;
      this.position.addScaledVector(this._dashDir, stats.dashSpeed * dt);
      this._animMoving = true;
      if (this.dashTime <= 0) this.dashing = false;
    } else {
      const move = input.moveVector;
      const forward = cameraRig.getFlatForward();
      const right = cameraRig.getFlatRight();
      const moveDir = new THREE.Vector3()
        .addScaledVector(forward, -move.z)
        .addScaledVector(right, move.x);
      const moving = moveDir.lengthSq() > 0.0001;
      if (moving) moveDir.normalize();

      this.sprinting = input.isDown('ShiftLeft') && moving && this.stamina > 1 && !input.isDown('ControlLeft');
      let speed = stats.moveSpeed;
      if (this.sprinting) {
        speed *= stats.sprintMult;
        this.stamina = Math.max(0, this.stamina - 22 * dt);
        this._staminaRegenDelay = 0.6;
      }
      this.position.addScaledVector(moveDir, speed * dt);
      this._animMoving = moving;

      if (moving) {
        this.facingYaw = Math.atan2(moveDir.x, moveDir.z);
      }

      const dashPressed = input.wasPressed('ControlLeft') || input.doubleTapDash;
      if (dashPressed && this.dashCooldownTimer <= 0 && this.stamina >= 20) {
        this.dashing = true;
        this.dashTime = stats.dashDuration;
        this.dashCooldownTimer = stats.dashCooldown;
        this.stamina -= 20;
        this.invincible = true;
        this._invincibleTimer = stats.dashDuration + 0.05;
        this._dashDir = moving ? moveDir.clone() : new THREE.Vector3(-Math.sin(this.facingYaw), 0, -Math.cos(this.facingYaw));
        this.audio.sfx.dash();
      }
    }

    // jump / gravity
    if (input.wasPressed('Space') && this.grounded) {
      this.velocityY = stats.jumpVelocity;
      this.grounded = false;
    }
    this.velocityY += GRAVITY * dt;
    this.position.y += this.velocityY * dt;
    if (this.position.y <= GROUND_Y) {
      this.position.y = GROUND_Y;
      this.velocityY = 0;
      this.grounded = true;
    }
  }

  _handleCombatInput(dt, input, cameraRig, world) {
    if (input.mouse.leftDown && this.cooldowns.melee <= 0) {
      this._meleeAttack(cameraRig, world);
      this.cooldowns.melee = this.stats.meleeCooldown;
    }
    if (input.mouse.rightDown && this.cooldowns.ranged <= 0) {
      this._rangedAttack(cameraRig, world);
      this.cooldowns.ranged = this.stats.rangedCooldown;
    }
  }

  _meleeAttack(cameraRig, world) {
    this._swingTimer = 0.22;
    this.audio.sfx.meleeSwing();
    const stats = this.stats;
    const forward = cameraRig.getFlatForward();
    let hitAny = false;
    for (const enemy of world.enemies) {
      if (enemy.dead) continue;
      const toEnemy = enemy.position.clone().sub(this.position);
      const dist = toEnemy.length();
      if (dist > stats.meleeRange) continue;
      toEnemy.normalize();
      if (toEnemy.dot(forward) < 0.35) continue; // within ~70 degree frontal arc
      const crit = Math.random() < stats.critChance;
      const dmg = stats.meleeDamage * (crit ? 1.8 : 1);
      world.damageEnemy(enemy, dmg, 'physical', this);
      hitAny = true;
    }
    if (hitAny) this.audio.sfx.meleeHit();
  }

  _rangedAttack(cameraRig, world) {
    this.audio.sfx.rangedShot();
    const stats = this.stats;
    const forward = cameraRig.getFlatForward();
    const from = this.position.clone().add(new THREE.Vector3(0, 1.3, 0)).addScaledVector(forward, 0.6);
    let nearestTarget = null;
    let nearestDist = stats.rangedRange;
    for (const enemy of world.enemies) {
      if (enemy.dead || (enemy.invisible)) continue;
      const toEnemy = enemy.position.clone().sub(this.position);
      const dist = toEnemy.length();
      if (dist > stats.rangedRange) continue;
      const dot = toEnemy.clone().normalize().dot(forward);
      if (dot < 0.85) continue; // must be roughly in front (aim cone)
      if (dist < nearestDist) { nearestDist = dist; nearestTarget = enemy; }
    }
    const crit = Math.random() < stats.critChance;
    const proj = new Projectile(this.scene, {
      from, target: nearestTarget, speed: 30, damage: stats.rangedDamage * (crit ? 1.8 : 1),
      color: 0x64b5f6, kind: 'magic', source: this, homing: !!nearestTarget
    });
    if (!nearestTarget) proj.setFixedDirection(forward);
    world.projectiles.push(proj);
  }

  _handleAbilities(dt, input, world) {
    // Label-based (event.key: 'a','e','r','f') rather than physical-position
    // codes, so this follows the actual A/E/R/F keycaps regardless of the
    // keyboard layout — unlike ZQSD movement, these aren't finger-position bindings.
    for (const slot of ['a', 'e', 'r', 'f']) {
      if (input.wasPressedKey(slot) && this.cooldowns[slot] <= 0) {
        this._castAbility(slot, world);
      }
    }
  }

  _castAbility(slot, world) {
    const def = ABILITIES[slot];
    const stats = this.stats;
    if (def.staminaCost && this.stamina < def.staminaCost) return;
    this.stamina -= def.staminaCost || 0;
    this.cooldowns[slot] = def.cooldown * stats.abilityCooldownMult;
    this.audio.sfx.abilityCast();
    this.bus.emit('player:ability', { slot, name: def.name });

    if (def.id === 'whirlwind') {
      const dmg = def.damage * stats.whirlwindDamageMult;
      for (const enemy of world.enemies) {
        if (enemy.dead) continue;
        if (enemy.position.distanceTo(this.position) <= def.radius) {
          world.damageEnemy(enemy, dmg, 'physical', this);
        }
      }
      world.spawnRingEffect?.(this.position, def.radius, 0xff8a65);
    } else if (def.id === 'powerShot') {
      const forward = world.cameraRig.getFlatForward();
      const from = this.position.clone().add(new THREE.Vector3(0, 1.3, 0));
      const proj = new Projectile(this.scene, {
        from, target: null, speed: 46, damage: def.damage * (stats.rangedDamage / 11),
        color: 0xffca28, kind: 'magic', pierce: 2 + stats.powerShotPierce, source: this, homing: false, maxRange: def.range
      });
      proj.setFixedDirection(forward);
      world.projectiles.push(proj);
    } else if (def.id === 'repairPulse') {
      this.heal(def.healAmount * 0.4);
      for (const tower of world.towers) {
        if (tower.position.distanceTo(this.position) <= def.radius) {
          tower.repair(def.healAmount * stats.repairPulseMult);
        }
      }
      world.spawnRingEffect?.(this.position, def.radius, 0x66bb6a);
    } else if (def.id === 'overcharge') {
      for (const tower of world.towers) {
        if (tower.position.distanceTo(this.position) <= def.radius) {
          world.applyOvercharge?.(tower, def.duration * stats.overchargeDurationMult, def.fireRateMult);
        }
      }
      world.spawnRingEffect?.(this.position, def.radius, 0xffd54f);
    }
  }
}
