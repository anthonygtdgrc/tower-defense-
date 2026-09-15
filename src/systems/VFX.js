import * as THREE from 'three';

// Small pool-free particle/effect system: transient meshes that fade and
// remove themselves. Kept intentionally simple (no shader/GPU particles)
// since this is placeholder-geometry art, not a shipped asset pipeline.
export class VFX {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
  }

  ring(position, radius, color = 0xffffff, duration = 0.4) {
    const geo = new THREE.RingGeometry(0.1, 0.3, 32);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(position);
    mesh.position.y = 0.1;
    this.scene.add(mesh);
    this.active.push({ mesh, t: 0, duration, maxRadius: radius, kind: 'ring' });
  }

  burst(position, color = 0xffffff, count = 10, speed = 4) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      this.scene.add(mesh);
      const dir = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.8 + 0.2, (Math.random() - 0.5)).normalize();
      this.active.push({ mesh, t: 0, duration: 0.5 + Math.random() * 0.3, velocity: dir.multiplyScalar(speed * (0.5 + Math.random())), kind: 'burst' });
    }
  }

  explosion(position, color = 0xff7043, radius = 3) {
    this.ring(position, radius, color, 0.35);
    this.burst(position, color, 16, 6);
  }

  telegraphMarker(position, radius, duration) {
    const geo = new THREE.RingGeometry(radius - 0.15, radius, 48);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(position);
    mesh.position.y = 0.08;
    this.scene.add(mesh);
    this.active.push({ mesh, t: 0, duration, kind: 'telegraph' });
    return mesh;
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const item = this.active[i];
      item.t += dt;
      const p = Math.min(1, item.t / item.duration);
      if (item.kind === 'ring') {
        const r = item.maxRadius * p;
        item.mesh.geometry.dispose();
        item.mesh.geometry = new THREE.RingGeometry(Math.max(0.05, r - 0.15), r, 32);
        item.mesh.material.opacity = 0.8 * (1 - p);
      } else if (item.kind === 'burst') {
        item.mesh.position.addScaledVector(item.velocity, dt);
        item.velocity.y -= 9 * dt;
        item.mesh.material.opacity = 1 - p;
        item.mesh.material.transparent = true;
      } else if (item.kind === 'telegraph') {
        item.mesh.material.opacity = 0.5 * (0.6 + 0.4 * Math.sin(item.t * 20));
      }
      if (p >= 1) {
        this.scene.remove(item.mesh);
        item.mesh.geometry.dispose();
        item.mesh.material.dispose();
        this.active.splice(i, 1);
      }
    }
  }
}
