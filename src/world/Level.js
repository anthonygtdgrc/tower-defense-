import * as THREE from 'three';
import { Grid, CELL_SIZE } from './Grid.js';
import { LEVEL_LAYOUT, BIOMES } from './biomes.js';
import { findPath, allLanesReachable } from './Pathfinding.js';

export class Level {
  constructor(scene, biomeId = 'valley') {
    this.scene = scene;
    this.biome = BIOMES[biomeId] || BIOMES.valley;
    this.layout = LEVEL_LAYOUT;
    this.grid = new Grid(this.layout.gridSize);
    this.group = new THREE.Group();
    scene.add(this.group);
    this.collisionMeshes = []; // solid world meshes the camera should not clip through

    for (const o of this.layout.obstacles) this.grid.set(o.col, o.row, 1);

    this._buildGround();
    this._buildObstacles();
    this._buildBaseMarker();

    this.activeLaneCount = 1;
    this.recomputeLanePaths();
  }

  get baseWorldPos() {
    const w = this.grid.cellToWorld(this.layout.base.col, this.layout.base.row);
    return new THREE.Vector3(w.x, 0, w.z);
  }

  laneStartWorldPos(index) {
    const s = this.layout.laneStarts[index];
    const w = this.grid.cellToWorld(s.col, s.row);
    return new THREE.Vector3(w.x, 0, w.z);
  }

  setActiveLaneCount(n) {
    this.activeLaneCount = n;
    this.recomputeLanePaths();
  }

  recomputeLanePaths() {
    this.lanePaths = [];
    for (let i = 0; i < this.activeLaneCount; i++) {
      const path = findPath(this.grid, this.layout.laneStarts[i], this.layout.base);
      this.lanePaths.push(path);
    }
    return this.lanePaths;
  }

  // Returns true (and commits) if placing a tower at world (x,z) keeps every
  // active lane reachable; false (no state change) if it would seal a path.
  tryOccupyCell(x, z) {
    const { col, row } = this.grid.worldToCell(x, z);
    if (this.grid.isBlocked(col, row)) return { ok: false, reason: 'occupied' };
    if (col === this.layout.base.col && row === this.layout.base.row) return { ok: false, reason: 'base' };
    for (const s of this.layout.laneStarts.slice(0, this.activeLaneCount)) {
      if (s.col === col && s.row === row) return { ok: false, reason: 'lane-start' };
    }
    this.grid.set(col, row, 2);
    const starts = this.layout.laneStarts.slice(0, this.activeLaneCount);
    if (!allLanesReachable(this.grid, starts, this.layout.base)) {
      this.grid.set(col, row, 0);
      return { ok: false, reason: 'blocks-path' };
    }
    this.recomputeLanePaths();
    return { ok: true, col, row };
  }

  freeCell(col, row) {
    this.grid.set(col, row, 0);
    this.recomputeLanePaths();
  }

  cellCenterWorld(col, row) {
    const w = this.grid.cellToWorld(col, row);
    return new THREE.Vector3(w.x, 0, w.z);
  }

  isBuildable(x, z) {
    const { col, row } = this.grid.worldToCell(x, z);
    if (!this.grid.inBounds(col, row)) return false;
    if (this.grid.isBlocked(col, row)) return false;
    if (col === this.layout.base.col && row === this.layout.base.row) return false;
    for (const s of this.layout.laneStarts.slice(0, this.activeLaneCount)) {
      if (s.col === col && s.row === row) return false;
    }
    return true;
  }

  _buildGround() {
    const playableSize = this.layout.gridSize * CELL_SIZE;
    // The visual ground extends well past the logical (buildable) grid so its
    // edge stays beyond the camera's far plane / fog distance and is never seen.
    const visualSize = Math.max(400, playableSize * 5);
    const geo = new THREE.PlaneGeometry(visualSize, visualSize, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: this.biome.groundColor, roughness: 0.95 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    // Visualize lanes as slightly raised colored strips using a grid of small planes (cheap, no texture assets needed)
    const pathMat = new THREE.MeshStandardMaterial({ color: this.biome.pathColor, roughness: 0.9 });
    this._pathMat = pathMat;
    this._pathGroup = new THREE.Group();
    this.group.add(this._pathGroup);
  }

  refreshPathVisual() {
    // Clear old
    while (this._pathGroup.children.length) {
      const c = this._pathGroup.children.pop();
      c.geometry.dispose();
    }
    const tileGeo = new THREE.BoxGeometry(CELL_SIZE * 0.96, 0.05, CELL_SIZE * 0.96);
    for (const path of this.lanePaths) {
      if (!path) continue;
      for (const node of path) {
        const mesh = new THREE.Mesh(tileGeo, this._pathMat);
        mesh.position.set(node.x, 0.03, node.z);
        mesh.receiveShadow = true;
        this._pathGroup.add(mesh);
      }
    }
  }

  _buildObstacles() {
    const geo = this.biome.obstacleType === 'tree'
      ? new THREE.ConeGeometry(0.9, 2.6, 6)
      : this.biome.obstacleType === 'dune'
        ? new THREE.SphereGeometry(1.1, 8, 6)
        : new THREE.DodecahedronGeometry(0.9, 0);
    const mat = new THREE.MeshStandardMaterial({ color: this.biome.obstacleColor, roughness: 0.9, flatShading: true });
    for (const o of this.layout.obstacles) {
      const w = this.grid.cellToWorld(o.col, o.row);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(w.x, this.biome.obstacleType === 'tree' ? 1.3 : 0.9, w.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.scale.setScalar(0.85 + Math.random() * 0.3);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(mesh);
      this.collisionMeshes.push(mesh);
    }
  }

  _buildBaseMarker() {
    const pos = this.baseWorldPos;
    const geo = new THREE.CylinderGeometry(1.6, 1.9, 2.4, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x64b5f6, emissive: 0x1a3a5c, emissiveIntensity: 0.6, roughness: 0.4 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, 1.2, pos.z);
    mesh.castShadow = true;
    this.group.add(mesh);
    this.baseMesh = mesh;
    this.collisionMeshes.push(mesh);

    const crystalGeo = new THREE.OctahedronGeometry(0.9, 0);
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0x90e8ff, emissive: 0x2288aa, emissiveIntensity: 1.0, roughness: 0.1, metalness: 0.3 });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(pos.x, 3.1, pos.z);
    this.group.add(crystal);
    this.baseCrystal = crystal;
  }

  update(dt) {
    if (this.baseCrystal) {
      this.baseCrystal.rotation.y += dt * 0.8;
      this.baseCrystal.position.y = 3.1 + Math.sin(performance.now() * 0.001) * 0.15;
    }
  }
}
