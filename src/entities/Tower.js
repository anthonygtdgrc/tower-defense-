import * as THREE from 'three';
import { TOWER_TYPES, levelMultiplier, upgradeCost, MAX_TOWER_LEVEL, SPECIALIZATION_LEVEL } from '../data/towers.js';

let TOWER_ID = 0;

export class Tower {
  constructor(scene, typeId, col, row, worldPos) {
    this.id = ++TOWER_ID;
    this.scene = scene;
    this.typeId = typeId;
    this.def = TOWER_TYPES[typeId];
    this.col = col;
    this.row = row;
    this.position = worldPos.clone();
    this.level = 1;
    this.specialization = null; // 'A' | 'B'
    this.targetingMode = 'closest'; // closest | first | last | strongest | shield
    this.cooldownTimer = 0;
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.runes = [];
    this.fusedFrom = 0;

    this._buildMesh();
  }

  _buildMesh() {
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.0, 0.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 })
    );
    base.position.y = 0.3;
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);

    const bodyGeo = this.def.id === 'support'
      ? new THREE.OctahedronGeometry(0.6, 0)
      : new THREE.BoxGeometry(0.7, 1.1, 0.7);
    this.bodyMat = new THREE.MeshStandardMaterial({ color: this.def.color, roughness: 0.5, metalness: 0.2 });
    this.body = new THREE.Mesh(bodyGeo, this.bodyMat);
    this.body.position.y = 1.0;
    this.body.castShadow = true;
    this.group.add(this.body);

    const barrelGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.9, 6);
    this.barrel = new THREE.Mesh(barrelGeo, this.bodyMat);
    this.barrel.rotation.x = Math.PI / 2;
    this.barrel.position.set(0, 0, 0.5);
    this.body.add(this.barrel); // child of body so it turns together when facing a target

    this._levelPips = new THREE.Group();
    this._levelPips.position.y = 1.9;
    this.group.add(this._levelPips);
    this._refreshLevelPips();

    // health bar
    const barGroup = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, depthTest: false }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.1), new THREE.MeshBasicMaterial({ color: 0x42a5f5, depthTest: false }));
    fg.position.z = 0.01;
    barGroup.add(bg, fg);
    barGroup.position.y = 2.3;
    barGroup.visible = false;
    this.group.add(barGroup);
    this._healthBar = { group: barGroup, fg };

    // range indicator (toggled on selection)
    this.rangeRing = new THREE.Mesh(
      new THREE.RingGeometry(this.effectiveStats().range - 0.05, this.effectiveStats().range, 48),
      new THREE.MeshBasicMaterial({ color: 0x64b5f6, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
    );
    this.rangeRing.rotation.x = -Math.PI / 2;
    this.rangeRing.position.y = 0.05;
    this.rangeRing.visible = false;
    this.group.add(this.rangeRing);

    if (this.def.invisible) {
      this.body.material.transparent = true;
      this.body.material.opacity = 0.4;
    }

    this.scene.add(this.group);
  }

  _refreshLevelPips() {
    while (this._levelPips.children.length) {
      const c = this._levelPips.children.pop();
      c.geometry.dispose();
    }
    for (let i = 0; i < this.level; i++) {
      const pip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffd54f }));
      pip.position.x = (i - (this.level - 1) / 2) * 0.22;
      this._levelPips.add(pip);
    }
  }

  effectiveStats(auraFromSupport = null) {
    const def = this.def;
    const lvlMult = levelMultiplier(this.level);
    let range = def.range * lvlMult;
    let fireRate = def.fireRate * lvlMult;
    let damage = def.damage * lvlMult;
    let splashRadius = def.splashRadius ?? 0;
    let flyingDamageMult = def.flyingDamageMult ?? 1;
    let projectileSpeed = def.projectileSpeed ?? 20;
    let status = def.status ?? null;

    if (this.specialization && def.specializations?.[this.specialization]) {
      const spec = def.specializations[this.specialization];
      if (spec.rangeMult) range *= spec.rangeMult;
      if (spec.fireRateMult) fireRate *= spec.fireRateMult;
      if (spec.damageMult) damage *= spec.damageMult;
      if (spec.splashRadiusMult) splashRadius *= spec.splashRadiusMult;
      if (spec.flyingDamageMult) flyingDamageMult = spec.flyingDamageMult;
      if (spec.projectileSpeedMult) projectileSpeed *= spec.projectileSpeedMult;
      if (spec.status) status = spec.status;
    }

    for (const rune of this.runes) {
      if (rune.damageMult) damage *= rune.damageMult;
      if (rune.rangeMult) range *= rune.rangeMult;
      if (rune.status) status = rune.status;
    }

    if (auraFromSupport) {
      if (auraFromSupport.damageMult) damage *= auraFromSupport.damageMult;
      if (auraFromSupport.fireRateMult) fireRate *= auraFromSupport.fireRateMult;
      if (auraFromSupport.rangeMult) range *= auraFromSupport.rangeMult;
    }

    return { range, fireRate, damage, splashRadius, flyingDamageMult, projectileSpeed, status, damageType: def.damageType };
  }

  canUpgrade() { return this.level < MAX_TOWER_LEVEL; }
  upgradeCost() { return upgradeCost(this.def.baseCost, this.level); }
  needsSpecialization() { return this.level === SPECIALIZATION_LEVEL && !this.specialization; }

  upgrade() {
    if (!this.canUpgrade()) return false;
    this.level++;
    this._refreshLevelPips();
    this.maxHp += 25;
    this.hp = this.maxHp;
    this.rangeRing.geometry.dispose();
    this.rangeRing.geometry = new THREE.RingGeometry(this.effectiveStats().range - 0.05, this.effectiveStats().range, 48);
    return true;
  }

  chooseSpecialization(branch) {
    if (!this.needsSpecialization()) return false;
    this.specialization = branch;
    return true;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this._healthBar.group.visible = this.hp < this.maxHp;
    const ratio = this.hp / this.maxHp;
    this._healthBar.fg.scale.x = ratio;
    this._healthBar.fg.position.x = -(1 - ratio) / 2;
    return this.hp <= 0;
  }

  repair(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const ratio = this.hp / this.maxHp;
    this._healthBar.fg.scale.x = ratio;
    this._healthBar.fg.position.x = -(1 - ratio) / 2;
    if (this.hp >= this.maxHp) this._healthBar.group.visible = false;
  }

  setSelected(selected) {
    this.rangeRing.visible = selected;
  }

  faceTarget(targetPos) {
    if (!targetPos) return;
    const dir = targetPos.clone().sub(this.group.position);
    this.body.rotation.y = Math.atan2(dir.x, dir.z);
  }

  get muzzlePosition() {
    this.body.updateMatrixWorld(true);
    return this.barrel.getWorldPosition(new THREE.Vector3());
  }

  destroy() {
    this.scene.remove(this.group);
  }
}
