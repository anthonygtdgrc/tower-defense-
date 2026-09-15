import * as THREE from 'three';

const bodyGeoCache = new Map();
function bodyGeo(flying) {
  const key = flying ? 'fly' : 'walk';
  if (bodyGeoCache.has(key)) return bodyGeoCache.get(key);
  const geo = flying ? new THREE.OctahedronGeometry(0.55, 0) : new THREE.CapsuleGeometry(0.4, 0.7, 4, 8);
  bodyGeoCache.set(key, geo);
  return geo;
}

let ENEMY_ID = 0;

export class Enemy {
  constructor(scene, def, { path, hpMult = 1, dmgMult = 1, modifier = null, waveNumber = 1 }) {
    this.id = ++ENEMY_ID;
    this.scene = scene;
    this.def = def;
    this.path = path;
    this.pathIndex = 0;
    this.dead = false;
    this.reachedBase = false;

    this.maxHp = def.hp * hpMult * (modifier?.hpMult ?? 1);
    this.hp = this.maxHp;
    this.baseSpeed = def.speed * (modifier?.speedMult ?? 1);
    this.damage = def.damage * dmgMult;
    this.flying = !!def.flying;
    this.invisible = !!def.invisible || !!modifier?.invisible;
    this.physicalResist = (def.physicalResist ?? 0) + (modifier?.physicalResistBonus ?? 0);
    this.regenPerSec = (def.regenPerSec ?? 0) + (modifier?.regenPerSecBonus ?? 0);
    this.goldValue = def.goldValue;
    this.xpValue = def.xpValue;
    this.modifier = modifier;
    this.summonsEvery = def.summonsEvery ?? null;
    this._summonTimer = this.summonsEvery ?? 0;
    this.explodeDamage = def.explodeDamage ?? 0;
    this.explodeRadius = def.explodeRadius ?? 0;
    this.hitboxHeight = 1.4;

    this.statuses = { slow: 0, stun: 0, root: 0, burnDps: 0, burnTime: 0, freeze: 0, poisonDps: 0, poisonTime: 0 };

    this._buildMesh(modifier);
    if (path && path.length) {
      this.position = new THREE.Vector3(path[0].x, this.flying ? 2.4 : 0, path[0].z);
    } else {
      this.position = new THREE.Vector3();
    }
    this.mesh.position.copy(this.position);
  }

  _buildMesh(modifier) {
    const color = modifier?.color ?? this.def.color;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, transparent: this.invisible, opacity: this.invisible ? 0.35 : 1 });
    this.mesh = new THREE.Mesh(bodyGeo(this.flying), mat);
    this.mesh.scale.setScalar(this.def.scale ?? 1);
    this.mesh.castShadow = true;
    this.scene.add(this.mesh);

    // Health bar (billboard, built from two thin boxes)
    const barGroup = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.12), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, depthTest: false }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.1), new THREE.MeshBasicMaterial({ color: 0x4caf50, depthTest: false }));
    fg.position.z = 0.01;
    bg.renderOrder = 10; fg.renderOrder = 11;
    barGroup.add(bg, fg);
    barGroup.position.y = 1.5 * (this.def.scale ?? 1);
    this.mesh.add(barGroup);
    this._healthBar = { group: barGroup, fg };
  }

  applyStatus(type, duration, dps = 0) {
    if (type === 'slow') this.statuses.slow = Math.max(this.statuses.slow, duration);
    else if (type === 'stun') this.statuses.stun = Math.max(this.statuses.stun, duration);
    else if (type === 'root') this.statuses.root = Math.max(this.statuses.root, duration);
    else if (type === 'freeze') this.statuses.freeze = Math.max(this.statuses.freeze, duration);
    else if (type === 'burn') { this.statuses.burnTime = Math.max(this.statuses.burnTime, duration); this.statuses.burnDps = dps; }
    else if (type === 'poison') { this.statuses.poisonTime = Math.max(this.statuses.poisonTime, duration); this.statuses.poisonDps = dps; }
  }

  get currentSpeed() {
    if (this.statuses.stun > 0 || this.statuses.root > 0 || this.statuses.freeze > 0) return 0;
    let s = this.baseSpeed;
    if (this.statuses.slow > 0) s *= 0.45;
    return s;
  }

  takeDamage(amount, damageType = 'physical') {
    if (this.dead) return 0;
    let final = amount;
    if (damageType === 'physical') final *= (1 - this.physicalResist);
    this.hp -= final;
    if (this.hp <= 0) this.die();
    return final;
  }

  die(reachedBase = false) {
    if (this.dead) return;
    this.dead = true;
    this.reachedBase = reachedBase;
    this.scene.remove(this.mesh);
  }

  update(dt, ctx) {
    if (this.dead) return;
    for (const k of ['slow', 'stun', 'root', 'freeze']) {
      if (this.statuses[k] > 0) this.statuses[k] = Math.max(0, this.statuses[k] - dt);
    }
    if (this.statuses.burnTime > 0) {
      this.statuses.burnTime -= dt;
      this.takeDamage(this.statuses.burnDps * dt, 'magic');
      if (this.dead) return;
    }
    if (this.statuses.poisonTime > 0) {
      this.statuses.poisonTime -= dt;
      this.takeDamage(this.statuses.poisonDps * dt, 'magic');
      if (this.dead) return;
    }
    if (this.regenPerSec > 0) this.hp = Math.min(this.maxHp, this.hp + this.regenPerSec * dt);

    if (this.summonsEvery) {
      this._summonTimer -= dt;
      if (this._summonTimer <= 0) {
        this._summonTimer = this.summonsEvery;
        ctx.onSummon?.(this);
      }
    }

    this._moveAlongPath(dt, ctx);

    if (this._healthBar) {
      const ratio = Math.max(0, this.hp / this.maxHp);
      this._healthBar.fg.scale.x = ratio;
      this._healthBar.fg.position.x = -(1 - ratio) / 2;
      this._healthBar.group.quaternion.copy(ctx.cameraQuaternion);
    }
    this.mesh.position.copy(this.position);
    if (this.flying) this.mesh.position.y = 2.4 + Math.sin(performance.now() * 0.003 + this.id) * 0.2;
  }

  _moveAlongPath(dt, ctx) {
    if (!this.path || this.pathIndex >= this.path.length) return;
    const speed = this.currentSpeed;
    if (speed <= 0) return;
    const targetNode = this.path[this.pathIndex];
    const target = new THREE.Vector3(targetNode.x, this.position.y, targetNode.z);
    const dir = target.clone().sub(this.position);
    const dist = dir.length();
    const step = speed * dt;
    if (dist <= step) {
      this.position.copy(target);
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        ctx.onReachBase?.(this);
        this.die(true);
      }
    } else {
      dir.normalize();
      this.position.add(dir.multiplyScalar(step));
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }
}
