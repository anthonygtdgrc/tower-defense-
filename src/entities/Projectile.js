import * as THREE from 'three';

const geoCache = new Map();
function getGeo(kind) {
  if (geoCache.has(kind)) return geoCache.get(kind);
  let geo;
  if (kind === 'magic') geo = new THREE.SphereGeometry(0.18, 6, 6);
  else if (kind === 'aoe') geo = new THREE.SphereGeometry(0.28, 6, 6);
  else geo = new THREE.SphereGeometry(0.12, 6, 6);
  geoCache.set(kind, geo);
  return geo;
}

// Generic ballistic/homing projectile used by both towers and the player's
// ranged attacks. `onHit` is called with the struck target (or null on expiry).
export class Projectile {
  constructor(scene, { from, target, speed, damage, color = 0xffffff, kind = 'physical', splashRadius = 0, pierce = 0, status = null, source = null, homing = true, maxRange = 40 }) {
    this.scene = scene;
    this.speed = speed;
    this.damage = damage;
    this.kind = kind;
    this.splashRadius = splashRadius;
    this.pierce = pierce;
    this.status = status;
    this.source = source;
    this.homing = homing;
    this.target = target;
    this.hitTargets = new Set();
    this.dead = false;
    this.traveled = 0;
    this.maxRange = maxRange;

    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 });
    this.mesh = new THREE.Mesh(getGeo(kind), mat);
    this.mesh.position.copy(from);
    scene.add(this.mesh);

    this.velocity = new THREE.Vector3();
    this._updateDirection(from);
  }

  _updateDirection(from) {
    let aimPoint;
    if (this.target && this.target.position && !this.target.dead) {
      aimPoint = this.target.position.clone();
      aimPoint.y += this.target.hitboxHeight ? this.target.hitboxHeight * 0.5 : 0.8;
    } else if (this.fixedDirection) {
      aimPoint = from.clone().add(this.fixedDirection);
    } else {
      aimPoint = from.clone().add(new THREE.Vector3(0, 0, -1));
    }
    this.velocity.copy(aimPoint).sub(this.mesh.position).normalize().multiplyScalar(this.speed);
  }

  setFixedDirection(dir) {
    this.fixedDirection = dir.clone().normalize();
    this.homing = false;
    this.velocity.copy(this.fixedDirection).multiplyScalar(this.speed);
  }

  update(dt, { onHit, findCandidates, findSplashTargets } = {}) {
    if (this.dead) return;
    if (this.homing && this.target && !this.target.dead) this._updateDirection(this.mesh.position);
    const step = this.velocity.clone().multiplyScalar(dt);
    this.mesh.position.add(step);
    this.traveled += step.length();

    // Proximity-based hit check against any live candidate (not just the
    // originally locked target) so fixed-direction/piercing shots can hit
    // whatever they fly through, not only their initial lock-on.
    const candidates = findCandidates ? findCandidates(this.mesh.position, 0.6) : (this.target && !this.target.dead ? [this.target] : []);
    for (const candidate of candidates) {
      if (this.dead || this.hitTargets.has(candidate)) continue;
      this._resolveHit(candidate, onHit, findSplashTargets);
      if (this.dead) return;
    }
    if (this.traveled > this.maxRange) {
      this.destroy();
    }
  }

  _resolveHit(target, onHit, findSplashTargets) {
    if (this.hitTargets.has(target)) return;
    this.hitTargets.add(target);
    onHit?.(target, this);

    if (this.splashRadius > 0 && findSplashTargets) {
      const nearby = findSplashTargets(this.mesh.position, this.splashRadius);
      for (const n of nearby) {
        if (n !== target && !this.hitTargets.has(n)) {
          this.hitTargets.add(n);
          onHit?.(n, this, true);
        }
      }
    }

    if (this.pierce > 0 && this.hitTargets.size <= this.pierce) {
      this.target = null; // continue straight after piercing
      this.homing = false;
    } else {
      this.destroy();
    }
  }

  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.scene.remove(this.mesh);
    this.mesh.geometry = null; // shared geometry cache, do not dispose
  }
}
