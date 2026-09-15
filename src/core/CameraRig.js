import * as THREE from 'three';

// Third-person orbital camera with mouse look, collision-safe distance,
// and additive shake for impacts/explosions.
export class CameraRig {
  constructor(camera, target) {
    this.camera = camera;
    this.target = target; // THREE.Object3D to follow
    this.yaw = Math.PI;
    this.pitch = 0.38; // positive = camera elevated above the target, looking down
    this.distance = 7.5;
    this.minDistance = 2.5;
    this.maxDistance = 14;
    this.shakeTime = 0;
    this.shakeStrength = 0;
    this._shakeOffset = new THREE.Vector3();
    this._raycaster = new THREE.Raycaster();
    this.collidables = []; // meshes the camera should not clip through (obstacles, base, towers)
  }

  addShake(strength, duration) {
    this.shakeStrength = Math.max(this.shakeStrength, strength);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  handleMouse(mouse, sensitivity = 0.0024) {
    this.yaw -= mouse.dx * sensitivity;
    this.pitch += mouse.dy * sensitivity;
    this.pitch = Math.max(0.08, Math.min(1.3, this.pitch));
    if (mouse.wheel) {
      this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance + mouse.wheel * 0.01));
    }
  }

  update(dt) {
    const targetPos = this.target.position;
    const pivot = targetPos.clone().add(new THREE.Vector3(0, 1.6, 0));
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();

    // Camera collision: raycast from the pivot toward the desired camera spot
    // and pull the camera in if something solid (base, obstacle, tower) is in the way,
    // so it never clips inside geometry and fills the view with a giant close-up surface.
    let effectiveDistance = this.distance;
    if (this.collidables.length) {
      this._raycaster.set(pivot, dir);
      this._raycaster.far = this.distance;
      const hits = this._raycaster.intersectObjects(this.collidables, true);
      if (hits.length) effectiveDistance = Math.max(3.2, hits[0].distance - 0.3);
    }

    const camPos = pivot.clone().addScaledVector(dir, effectiveDistance);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const s = this.shakeStrength * (this.shakeTime > 0 ? 1 : 0);
      this._shakeOffset.set(
        (Math.random() - 0.5) * s,
        (Math.random() - 0.5) * s,
        (Math.random() - 0.5) * s
      );
      camPos.add(this._shakeOffset);
      if (this.shakeTime <= 0) this.shakeStrength = 0;
    }

    this.camera.position.lerp(camPos, 1 - Math.pow(0.001, dt));
    const lookTarget = targetPos.clone().add(new THREE.Vector3(0, 1.4, 0));
    this.camera.lookAt(lookTarget);
  }

  // Forward direction on the horizontal plane, used for player movement relative to camera.
  getFlatForward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
  }
  getFlatRight() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
  }
}
