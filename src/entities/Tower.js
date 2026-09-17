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

    const isTrap = this.def.id === 'trap';
    const pedestalHeight = isTrap ? 0.16 : 0.6;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.0, pedestalHeight, 8),
      new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 })
    );
    base.position.y = pedestalHeight / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);

    this.bodyMat = new THREE.MeshStandardMaterial({ color: this.def.color, roughness: 0.5, metalness: 0.2 });
    this.body = new THREE.Group();
    this.body.position.y = pedestalHeight;
    this.group.add(this.body);

    // Muzzle anchor: a logical (invisible) point at the "front" of whatever
    // shape this tower type has, used for projectile spawn / facing math.
    // Decorative geometry below is purely visual and type-specific.
    this.barrel = new THREE.Object3D();
    this._decor = [];
    this._buildTypeDecor();
    this.body.add(this.barrel);

    this._levelPips = new THREE.Group();
    this._levelPips.position.y = 1.5;
    this.group.add(this._levelPips);
    this._refreshLevelPips();

    this._runeGems = new THREE.Group();
    this._runeGems.position.y = 0.65;
    this.group.add(this._runeGems);
    this.refreshRuneVisual();

    // health bar
    const barGroup = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, depthTest: false }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.1), new THREE.MeshBasicMaterial({ color: 0x42a5f5, depthTest: false }));
    fg.position.z = 0.01;
    barGroup.add(bg, fg);
    barGroup.position.y = 1.9;
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
      this.bodyMat.transparent = true;
      this.bodyMat.opacity = 0.4;
    }

    this.scene.add(this.group);
  }

  // Type-specific decorative geometry, built into `this.body` (a Group that
  // rotates as a whole to face the current target). Each type also positions
  // `this.barrel`, the invisible anchor projectiles spawn from.
  _buildTypeDecor() {
    const mat = this.bodyMat;
    const add = (mesh, castShadow = true) => {
      mesh.castShadow = castShadow;
      this.body.add(mesh);
      this._decor.push(mesh);
      return mesh;
    };

    switch (this.def.id) {
      case 'ballistic': {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.55), mat)).position.y = 0.2;
        for (const side of [-1, 1]) {
          const gun = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 8), mat));
          gun.rotation.x = Math.PI / 2;
          gun.position.set(side * 0.13, 0.22, 0.45);
        }
        this.barrel.position.set(0, 0.22, 0.8);
        break;
      }
      case 'mage': {
        const spire = add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.32, 1.0, 8), mat));
        spire.position.y = 0.5;
        const orbMat = new THREE.MeshStandardMaterial({ color: 0xd7b8ff, emissive: 0x7c5cff, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 });
        const orb = add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), orbMat), false);
        orb.position.y = 1.15;
        this._decorSpin = orb;
        this.barrel.position.set(0, 1.15, 0.3);
        break;
      }
      case 'aoe': {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.3, 10), mat)).position.y = 0.15;
        const tube = add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.85, 10), mat));
        tube.position.set(0, 0.55, 0.18);
        tube.rotation.x = -0.85;
        this.barrel.position.set(0, 0.85, 0.55);
        break;
      }
      case 'support': {
        const core = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), mat));
        core.position.y = 0.4;
        const haloMat = new THREE.MeshStandardMaterial({ color: 0xffe082, emissive: 0xffc107, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.4 });
        const halo = add(new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 24), haloMat), false);
        halo.rotation.x = Math.PI / 2;
        halo.position.y = 0.4;
        this._decorSpin = halo;
        this.barrel.position.set(0, 0.4, 0.3);
        break;
      }
      case 'control': {
        const shardGeo = (h) => new THREE.ConeGeometry(0.14, h, 6);
        const iceMat = new THREE.MeshStandardMaterial({ color: this.def.color, emissive: 0x1a6f8a, emissiveIntensity: 0.4, roughness: 0.15, metalness: 0.3 });
        add(new THREE.Mesh(shardGeo(0.9), iceMat)).position.set(0, 0.45, 0);
        add(new THREE.Mesh(shardGeo(0.55), iceMat)).position.set(0.22, 0.28, 0.1);
        add(new THREE.Mesh(shardGeo(0.5), iceMat)).position.set(-0.2, 0.25, -0.08);
        this.barrel.position.set(0, 0.9, 0.15);
        break;
      }
      case 'antiair': {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), mat)).position.y = 0.18;
        for (const side of [-1, 1]) {
          const gun = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 8), mat));
          gun.position.set(side * 0.16, 0.42, 0.12);
          gun.rotation.x = -0.9;
          gun.rotation.z = side * 0.15;
        }
        const dishMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.5, roughness: 0.4 });
        const dish = add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 12), dishMat));
        dish.position.y = 0.55;
        this._decorSpin = dish;
        this.barrel.position.set(0, 0.5, 0.5);
        break;
      }
      case 'trap': {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 8), mat)).position.y = 0.03;
        const spikeGeo = new THREE.ConeGeometry(0.05, 0.16, 5);
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const spike = add(new THREE.Mesh(spikeGeo, mat));
          spike.position.set(Math.cos(angle) * 0.28, 0.1, Math.sin(angle) * 0.28);
        }
        this.barrel.position.set(0, 0.1, 0);
        break;
      }
      default: {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.7), mat)).position.y = 0.55;
        this.barrel.position.set(0, 0.55, 0.5);
      }
    }
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

  // Rune slots grow with tower level (1 at lvl 2, 2 at lvl 3-4, 3 at max level).
  maxRuneSlots() {
    if (this.level >= MAX_TOWER_LEVEL) return 3;
    if (this.level >= 3) return 2;
    if (this.level >= 2) return 1;
    return 0;
  }

  refreshRuneVisual() {
    while (this._runeGems.children.length) {
      const c = this._runeGems.children.pop();
      c.geometry.dispose();
      c.material.dispose();
    }
    const radius = 0.55;
    this.runes.forEach((rune, i) => {
      const angle = (i / Math.max(1, this.runes.length)) * Math.PI * 2;
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.13, 0),
        new THREE.MeshStandardMaterial({ color: rune.color, emissive: rune.color, emissiveIntensity: 0.7, roughness: 0.2 })
      );
      gem.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      this._runeGems.add(gem);
    });
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
      const fx = rune.effect || rune; // tolerate either the rune def or a bare effect object
      if (fx.damageMult) damage *= fx.damageMult;
      if (fx.rangeMult) range *= fx.rangeMult;
      if (fx.fireRateMult) fireRate *= fx.fireRateMult;
      if (fx.status) status = fx.status;
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

  // Idle decoration (orbiting orb / spinning halo / radar dish) — purely
  // cosmetic, independent of facing/targeting.
  updateDecor(dt) {
    if (this._decorSpin) this._decorSpin.rotation.y += dt * 1.4;
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
