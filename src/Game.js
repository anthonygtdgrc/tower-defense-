import * as THREE from 'three';
import { InputManager } from './core/InputManager.js';
import { CameraRig } from './core/CameraRig.js';
import { AudioManager } from './core/AudioManager.js';
import { EventBus } from './core/EventBus.js';
import { Level } from './world/Level.js';
import { CELL_SIZE } from './world/Grid.js';
import { Player } from './entities/Player.js';
import { ProgressionManager } from './systems/ProgressionManager.js';
import { EconomyManager, BaseHealth } from './systems/EconomyManager.js';
import { TowerManager } from './systems/TowerManager.js';
import { WaveManager } from './systems/WaveManager.js';
import { VFX } from './systems/VFX.js';
import { applyStatusToTarget } from './systems/StatusEffects.js';
import { HUD } from './ui/HUD.js';
import { Modals } from './ui/Modals.js';
import { TOWER_LIST } from './data/towers.js';
import { XP_PER_LEVEL } from './data/skills.js';
import { getDifficultyMods, getRunModifierEffects } from './systems/MetaProgression.js';

export class Game {
  constructor({ canvas, hudRoot, menuRoot, saveManager, metaProgression, config }) {
    this.canvas = canvas;
    this.hudRoot = hudRoot;
    this.menuRoot = menuRoot;
    this.saveManager = saveManager;
    this.meta = metaProgression;
    this.config = config;
    this.bus = new EventBus();
    this.audio = new AudioManager();
    this.input = new InputManager(canvas);
    this.vfx = null;
    this.bossesKilled = 0;
    this.towersEverPlaced = 0;
    this.cleanWaveStreak = 0;
    this.paused = false;
    this.gameOver = false;

    this._setupRenderer();
    this._setupScene();
    this._setupSystems();
    this._setupUI();
    this._wireEvents();
    this._wireInputHandlers();

    this.clock = new THREE.Clock();
    window.addEventListener('resize', () => this._onResize());
    this._loop = this._loop.bind(this);
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.level = new Level(this.scene, this.config.map);
    this.scene.fog = new THREE.Fog(this.level.biome.fogColor, 25, 85);
    this.scene.background = new THREE.Color(this.level.biome.fogColor);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 220);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff2d9, 1.1);
    sun.position.set(30, 40, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.camera.far = 120;
    this.scene.add(sun);
    this.sun = sun;

    this.vfx = new VFX(this.scene);
  }

  _setupSystems() {
    const difficultyMods = getDifficultyMods(this.config.difficulty);
    const runMods = getRunModifierEffects(this.config.modifiers);
    const metaEffects = this.meta.getEffects();
    this.runMods = runMods;
    this.metaEffects = metaEffects;

    this.progression = new ProgressionManager(this.bus, runMods, metaEffects, this.config.playerClass);

    this.player = new Player(this.scene, this.progression, this.bus, this.audio);
    this.cameraRig = new CameraRig(this.camera, this.player.group);
    // The base marker is excluded on purpose: it sits at a fixed, known focal
    // point players approach constantly to build/defend, and colliding the
    // camera against it just traps the camera at point-blank range (an object
    // that size fills the screen from 2 units out no matter how it's clamped).
    // Obstacles/towers are smaller and less likely to corner the camera this way.
    this.cameraRig.collidables = this.level.collisionMeshes.filter((m) => m !== this.level.baseMesh);

    const startGold = 150 * (difficultyMods.goldMult ?? 1) + (metaEffects.startGold || 0);
    this.economy = new EconomyManager(this.bus, {
      startGold,
      startCrystals: 0,
      goldMult: (difficultyMods.goldMult ?? 1) * (runMods.goldMult ?? 1),
      interestBonus: 0
    });

    const baseMaxHp = 100 * (metaEffects.baseMaxHpMult || 1) * (runMods.baseHpMult || 1);
    this.baseHealth = new BaseHealth(this.bus, baseMaxHp);

    this.towerManager = new TowerManager(this.scene, this.level, this.bus, this.audio, this.economy);

    const waveMods = {
      enemyHpMult: (difficultyMods.enemyHpMult ?? 1) * (runMods.enemyHpMult ?? 1),
      enemyDmgMult: (difficultyMods.enemyDmgMult ?? 1),
      enemyCountMult: (runMods.enemyCountMult ?? 1)
    };
    this.waveManager = new WaveManager(this.scene, this.level, this.bus, this.audio, waveMods);

    this.enemies = [];
    this.projectiles = [];
    this.selectedTower = null;
    this.buildType = null;
    this._buildGhost = null;
  }

  _setupUI() {
    this.hud = new HUD(this.hudRoot);
    this.modals = new Modals(this.menuRoot);
    this.hud.bindBuildSlots((typeId) => this._selectBuildType(typeId));
    this.hud.bindSkipWave(() => this.waveManager.skipPreparation(this.economy));

    this.modals.el.resumeBtn.addEventListener('click', () => this._togglePause(false));
    this.modals.el.quitBtn.addEventListener('click', () => this._endRun(false, true));
    this.modals.el.restartBtn.addEventListener('click', () => location.reload());
  }

  _wireEvents() {
    this.bus.on('base:damaged', ({ amount, angle }) => {
      this.cameraRig.addShake(0.35, 0.3);
      this.audio.sfx.baseAlert(angle);
      this.hud.notify(`La base subit ${Math.round(amount)} dégâts !`, 'danger');
      this.cleanWaveStreak = -1; // will be reset to 0 on next wave clear check
    });
    this.bus.on('base:destroyed', () => {
      if (this.config.sandbox) {
        this.baseHealth.hp = this.baseHealth.maxHp;
        this.hud.notify('Mode Bac à Sable: base restaurée.', 'info');
        return;
      }
      this._endRun(false);
    });
    this.bus.on('player:died', () => {
      this.hud.notify('Vous êtes à terre... réapparition dans 5s', 'danger');
      this._respawnTimer = 5;
    });
    this.bus.on('player:levelup', ({ level }) => {
      this.audio.sfx.levelUp();
      this.hud.notify(`Niveau ${level} atteint ! Point de compétence disponible (K).`, 'good');
    });
    this.bus.on('wave:start', ({ waveNumber, kind }) => {
      if (kind === 'boss') this.hud.notify(`Vague ${waveNumber} : BOSS !`, 'danger');
      else if (kind === 'elite') this.hud.notify(`Vague ${waveNumber} : Vague Élite !`, 'info');
      if (waveNumber >= 25) this._unlockAchievement('wave_25');
    });
    this.bus.on('wave:preview', ({ waveNumber, kind, icons }) => this.hud.setWavePreview(waveNumber, kind, icons));
    this.bus.on('tower:placed', () => { this.towersEverPlaced += 1; });
    this.bus.on('achievement:progress', ({ id }) => this._unlockAchievement(id));
    this.bus.on('boss:spawned', () => this.hud.notify('Un boss approche !', 'danger'));
  }

  _unlockAchievement(id) {
    if (this.saveManager.unlockAchievement(id)) {
      this.hud.notify(`🏆 Succès débloqué !`, 'good');
    }
  }

  _wireInputHandlers() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (e.code === 'Escape') {
        if (this.buildType) this._selectBuildType(null);
        else if (this.selectedTower) this._closeTowerPanel();
        else this._togglePause();
      }
      if (e.code === 'KeyK' && !this.gameOver) this._toggleModal('skill-modal', () => this.modals.renderSkillTree(this.progression, (id) => this.progression.allocate(id)));
      if (e.code === 'KeyI' && !this.gameOver) this._toggleModal('inventory-modal', () => this.modals.renderInventory(this.progression, (id) => this.progression.equip(id)));
      if (/^Digit[1-7]$/.test(e.code)) {
        const idx = Number(e.code.replace('Digit', '')) - 1;
        if (TOWER_LIST[idx]) this._selectBuildType(TOWER_LIST[idx].id);
      }
      if (e.code === 'KeyB') this._selectBuildType(this.buildType ? null : TOWER_LIST[0].id);
      if (e.code === 'KeyF') this._handleInteract();
      if (e.code === 'KeyN' && this.waveManager.state === 'prep') this.waveManager.skipPreparation(this.economy);
    });
  }

  _toggleModal(id, renderFn) {
    if (this.modals.isOpen(id)) { this.modals.close(id); document.exitPointerLock?.(); return; }
    this._closeAllModals();
    renderFn();
    this.modals.open(id);
    document.exitPointerLock?.();
  }

  _closeAllModals() {
    for (const id of ['skill-modal', 'inventory-modal', 'pause-modal']) this.modals.close(id);
  }

  _togglePause(force) {
    const shouldOpen = force !== undefined ? force : !this.modals.isOpen('pause-modal');
    this._closeAllModals();
    if (shouldOpen) {
      this.modals.renderPauseStats({ wave: this.waveManager.waveNumber, gold: this.economy.gold, level: this.progression.level });
      this.modals.open('pause-modal');
      document.exitPointerLock?.();
    } else {
      this.modals.close('pause-modal');
    }
  }

  _selectBuildType(typeId) {
    this.buildType = typeId;
    this.hud.setActiveBuildType(typeId);
    if (this._buildGhost) { this.scene.remove(this._buildGhost); this._buildGhost = null; }
    if (typeId) this._createGhost(typeId);
  }

  _createGhost(typeId) {
    const def = TOWER_LIST.find((t) => t.id === typeId);
    const geo = new THREE.CylinderGeometry(0.9, 1.0, 1.6, 8);
    const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.45 });
    this._buildGhost = new THREE.Mesh(geo, mat);
    this._buildGhost.position.y = 0.8;
    this.scene.add(this._buildGhost);
  }

  _updateGhost() {
    if (!this.buildType || !this._buildGhost) return;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: 0, y: 0 }, this.camera); // crosshair-center placement
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, point);
    if (!point) return;
    this._buildGhost.position.set(point.x, 0.8, point.z);
    const buildable = this.towerManager.canPlace(point.x, point.z);
    this._buildGhost.material.color.set(buildable ? 0x66bb6a : 0xef5350);
    this._ghostWorldPoint = point.clone();
  }

  _handleInteract() {
    if (this.buildType && this._ghostWorldPoint) {
      const costMult = this.progression.getStats().towerCostMult;
      const res = this.towerManager.place(this.buildType, this._ghostWorldPoint.x, this._ghostWorldPoint.z, costMult);
      if (!res.ok) this.hud.notify(this._placementErrorText(res.reason), 'danger');
      return;
    }
    if (this._nearbyTower) this._openTowerPanel(this._nearbyTower);
  }

  _placementErrorText(reason) {
    return {
      gold: 'Or insuffisant.',
      occupied: 'Case déjà occupée.',
      base: 'Impossible ici (base).',
      'lane-start': "Impossible ici (point d'apparition).",
      'blocks-path': 'Cela bloquerait complètement un chemin !'
    }[reason] || 'Placement impossible.';
  }

  _findNearbyTower() {
    let closest = null;
    let closestDist = 3.2;
    for (const tower of this.towerManager.towers) {
      const d = tower.position.distanceTo(this.player.position);
      if (d < closestDist) { closestDist = d; closest = tower; }
    }
    this._nearbyTower = closest;
  }

  _openTowerPanel(tower) {
    this.selectedTower = tower;
    this._runeOffer = null;
    this._runeOfferTower = null;
    for (const t of this.towerManager.towers) t.setSelected(t === tower);
    this._renderTowerPanel();
    document.exitPointerLock?.();
  }

  _closeTowerPanel() {
    if (this.selectedTower) this.selectedTower.setSelected(false);
    this.selectedTower = null;
    this._runeOffer = null;
    this._runeOfferTower = null;
    this.hud.hideTowerPanel();
  }

  _renderTowerPanel() {
    const tower = this.selectedTower;
    if (!tower) { this.hud.hideTowerPanel(); return; }
    const stats = tower.effectiveStats();
    const displayDamage = stats.damage * (tower.fusedFrom ? tower._hybridMult : 1);
    const upgradeCostVal = tower.upgradeCost();
    let html = `<h3>${tower.def.name} — Niveau ${tower.level}${tower.fusedFrom ? ' (Fusionnée)' : ''}</h3>
      <div class="tower-panel-row"><span>Dégâts</span><span>${displayDamage.toFixed(1)}</span></div>
      <div class="tower-panel-row"><span>Portée</span><span>${stats.range.toFixed(1)}</span></div>
      <div class="tower-panel-row"><span>Cadence</span><span>${stats.fireRate.toFixed(2)}/s</span></div>
      <div class="tower-panel-row"><span>PV</span><span>${Math.ceil(tower.hp)}/${tower.maxHp}</span></div>`;

    if (tower.def.id !== 'support' && tower.def.fireRate > 0) {
      html += `<select class="targeting-select" id="targeting-select">
        ${['closest', 'first', 'last', 'strongest'].map((m) => `<option value="${m}" ${tower.targetingMode === m ? 'selected' : ''}>${{ closest: 'Plus proche', first: 'Premier', last: 'Dernier', strongest: 'Plus de vie' }[m]}</option>`).join('')}
      </select>`;
    }

    if (tower.needsSpecialization()) {
      const specs = tower.def.specializations;
      html += `<div class="tower-panel-actions">
        <button data-action="spec-a" class="primary">${specs.A.name}</button>
        <button data-action="spec-b" class="primary">${specs.B.name}</button>
      </div>`;
    }

    html += `<div class="tower-panel-actions">
      ${tower.canUpgrade() ? `<button data-action="upgrade" class="primary">Améliorer (${upgradeCostVal}🪙)</button>` : '<button disabled>Niveau Max</button>'}
      <button data-action="sell" class="danger">Vendre</button>
      <button data-action="close">Fermer</button>
    </div>`;

    if (this.towerManager.canFuse(tower.typeId)) {
      html += `<div class="tower-panel-actions"><button data-action="fuse" class="primary">✨ Fusionner 3 tours Nv.5 (${tower.def.name})</button></div>`;
    }

    html += this._runesPanelHtml(tower);

    this.hud.showTowerPanel(html);
    const panel = this.hud.el.towerPanel;
    panel.querySelector('#targeting-select')?.addEventListener('change', (e) => { tower.targetingMode = e.target.value; });
    panel.querySelector('[data-action="upgrade"]')?.addEventListener('click', () => { this.towerManager.upgrade(tower, this.progression.getStats().towerCostMult); this._renderTowerPanel(); });
    panel.querySelector('[data-action="sell"]')?.addEventListener('click', () => { this.towerManager.sell(tower); this.selectedTower = null; this.hud.hideTowerPanel(); });
    panel.querySelector('[data-action="close"]')?.addEventListener('click', () => this._closeTowerPanel());
    panel.querySelector('[data-action="spec-a"]')?.addEventListener('click', () => { this.towerManager.specialize(tower, 'A'); this._renderTowerPanel(); });
    panel.querySelector('[data-action="spec-b"]')?.addEventListener('click', () => { this.towerManager.specialize(tower, 'B'); this._renderTowerPanel(); });
    panel.querySelector('[data-action="fuse"]')?.addEventListener('click', () => { this.towerManager.fuse(tower.typeId); this.selectedTower = null; this.hud.hideTowerPanel(); });
    panel.querySelector('[data-action="rune-offer"]')?.addEventListener('click', () => {
      this._runeOffer = this.towerManager.getRuneOffer(tower);
      this._runeOfferTower = tower;
      this._renderTowerPanel();
    });
    panel.querySelectorAll('[data-action="rune-pick"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rune = this._runeOffer[Number(btn.dataset.index)];
        if (this.towerManager.addRune(tower, rune)) {
          this.hud.notify(`${rune.name} ajoutée à ${tower.def.name}`, 'good');
          this._runeOffer = null;
          this._renderTowerPanel();
        }
      });
    });
    panel.querySelectorAll('[data-action="rune-remove"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.towerManager.removeRune(tower, Number(btn.dataset.index));
        this._renderTowerPanel();
      });
    });
  }

  _runesPanelHtml(tower) {
    const maxSlots = tower.maxRuneSlots();
    if (maxSlots === 0) {
      return `<div class="tower-panel-row"><span>Runes</span><span>Niveau 2+ requis</span></div>`;
    }
    let html = `<div class="tower-panel-row"><span>Runes</span><span>${tower.runes.length}/${maxSlots}</span></div>`;
    tower.runes.forEach((rune, i) => {
      html += `<div class="rune-row">
        <span class="rune-dot" style="background:#${rune.color.toString(16).padStart(6, '0')}"></span>
        <span>${rune.name}</span>
        <button data-action="rune-remove" data-index="${i}">Retirer</button>
      </div>`;
    });
    if (tower.runes.length < maxSlots) {
      if (this._runeOffer && this._runeOfferTower === tower) {
        html += `<div class="rune-offer">` + this._runeOffer.map((rune, i) => `
          <button data-action="rune-pick" data-index="${i}" ${this.economy.crystals < rune.cost ? 'disabled' : ''}>
            <span class="rune-dot" style="background:#${rune.color.toString(16).padStart(6, '0')}"></span>
            ${rune.name}<br/><small>${rune.cost}💎</small>
          </button>`).join('') + `</div>`;
      } else {
        html += `<div class="tower-panel-actions"><button data-action="rune-offer">Choisir une Rune</button></div>`;
      }
    }
    return html;
  }

  // ---- core gameplay callbacks shared by player / towers / bosses ----

  damageEnemy(enemy, amount, damageType, source) {
    if (enemy.dead) return;
    const before = enemy.hp;
    enemy.takeDamage(amount, damageType);
    const screenPos = this._worldToScreen(enemy.position.clone().add(new THREE.Vector3(0, 1.6, 0)));
    if (screenPos) this.hud.spawnDamageNumber(screenPos.x, screenPos.y, before - enemy.hp, amount > (enemy.maxHp * 0.25));
    if (enemy.dead && !enemy.reachedBase) this._onEnemyKilled(enemy);
  }

  _onEnemyKilled(enemy) {
    this.economy.addGold(enemy.goldValue);
    this.progression.addXP(enemy.xpValue);
    this.audio.sfx.enemyDeath();
    this.vfx.burst(enemy.position, 0xffffff, 6, 3);

    const crystalChance = enemy.isBoss ? 1 : enemy.modifier ? 0.35 : 0.03;
    if (Math.random() < crystalChance * (this.metaEffects.crystalDropMult || 1)) {
      const amount = enemy.isBoss ? enemy.crystalDrop : 1;
      this.economy.addCrystals(amount);
    }
    const lootChance = enemy.isBoss ? 1 : enemy.modifier ? 0.18 : 0.02;
    if (Math.random() < lootChance) {
      const slot = Math.random() < 0.5 ? 'weapon' : 'armor';
      this.progression.lootDrop(slot, enemy.isBoss ? 0.3 : 0.05);
    }
    if (enemy.isBoss) {
      this.bossesKilled += 1;
      if (this.saveManager.data.stats.totalBossKills + this.bossesKilled >= 5) this._unlockAchievement('boss_slayer');
    }
  }

  _worldToScreen(vec3) {
    const v = vec3.clone().project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }

  spawnRingEffect(pos, radius, color) { this.vfx.ring(pos, radius, color); }
  applyOvercharge(tower, duration, mult) { this.towerManager.applyOvercharge(tower, duration, mult); }

  // ---- main loop ----

  start() {
    this.canvas.addEventListener('click', () => this.audio.resume(), { once: true });
    requestAnimationFrame(this._loop);
  }

  _loop() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const worldPaused = this.modals.anyOpen() || this.gameOver || this.input.isDown('Tab');

    this.input.allowPointerLock = !this.modals.anyOpen() && !this.selectedTower;

    if (this.input.isDown('Tab') && !this.gameOver) {
      this._renderTactical();
    }

    if (!worldPaused) {
      this.cameraRig.handleMouse(this.input.mouse);
      this._updateWorld(dt);
    }
    if (this.towerManager.towers.length) {
      this.cameraRig.collidables = [
        ...this.level.collisionMeshes.filter((m) => m !== this.level.baseMesh),
        ...this.towerManager.towers.map((t) => t.group)
      ];
    }
    this.cameraRig.update(dt);
    this._updateGhost();
    this._findNearbyTower();
    if (!this.buildType) {
      if (this._nearbyTower) this.hud.setInteractPrompt(`F : Gérer ${this._nearbyTower.def.name} (Nv.${this._nearbyTower.level})`);
    } else {
      this.hud.setInteractPrompt('Clic gauche / F : Construire — Échap : Annuler');
    }

    if (this.input.mouse.wheel && !worldPaused) {
      const idx = TOWER_LIST.findIndex((t) => t.id === this.buildType);
      const dir = Math.sign(this.input.mouse.wheel);
      const nextIdx = ((idx < 0 ? 0 : idx) + dir + TOWER_LIST.length) % TOWER_LIST.length;
      this._selectBuildType(TOWER_LIST[nextIdx].id);
    }

    if (this.buildType && this.input.mouse.leftJustPressed && !worldPaused) {
      this._handleInteract();
    }
    if (this.buildType && this.input.mouse.rightJustPressed && !worldPaused) {
      this._selectBuildType(null);
    }

    this._updateHUD();
    this.level.update(dt);
    this.vfx.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.consumeFrame();

    if (!this.gameOver) requestAnimationFrame(this._loop);
  }

  _updateWorld(dt) {
    this.audio.resume();
    this.player.update(dt, {
      input: this.input,
      cameraRig: this.cameraRig,
      world: {
        enemies: this.enemies,
        towers: this.towerManager.towers,
        projectiles: this.projectiles,
        scene: this.scene,
        cameraRig: this.cameraRig,
        suppressCombat: !!this.buildType,
        damageEnemy: (e, d, t, s) => this.damageEnemy(e, d, t, s),
        spawnRingEffect: (p, r, c) => this.spawnRingEffect(p, r, c),
        applyOvercharge: (t, d, m) => this.applyOvercharge(t, d, m)
      }
    });

    if (this._respawnTimer > 0) {
      this._respawnTimer -= dt;
      if (this._respawnTimer <= 0) {
        this.player.alive = true;
        this.player.hp = this.player.stats.maxHp * 0.5;
        this.player.position.set(this.level.baseWorldPos.x, 0, this.level.baseWorldPos.z + 4);
        this.player.invincible = true;
        this.player._invincibleTimer = 2;
      }
    }

    const enemyCtx = {
      cameraQuaternion: this.camera.quaternion,
      onReachBase: (enemy) => this._onEnemyReachBase(enemy),
      onSummon: (enemy) => this.waveManager.spawnFollowUp(enemy.summonType, enemy.position, enemy.laneIndex ?? 0, { enemies: this.enemies }, enemy.pathIndex),
      onBossPhase: (boss) => this.hud.notify(`${boss.bossDef.name} change de phase !`, 'danger'),
      onBossTelegraph: (boss, state) => this._onBossTelegraph(boss, state),
      onBossAttackResolve: (boss, state, interrupted) => this._onBossAttackResolve(boss, state, interrupted),
      pickRandomTower: () => {
        const towers = this.towerManager.towers;
        return towers.length ? towers[Math.floor(Math.random() * towers.length)] : null;
      }
    };

    this.waveManager.update(dt, { enemies: this.enemies });

    for (const enemy of this.enemies) enemy.update(dt, enemyCtx);
    this._processMeleeContactDamage(dt);
    this._processKamikaze();

    this.towerManager.update(dt, { enemies: this.enemies, projectiles: this.projectiles, findSplashTargets: (pos, r) => this.enemies.filter((e) => !e.dead && e.position.distanceTo(pos) <= r) });

    const enemiesNear = (pos, r) => this.enemies.filter((e) => !e.dead && e.position.distanceTo(pos) <= r);
    for (const proj of this.projectiles) {
      proj.update(dt, {
        onHit: (target, p, isSplash) => {
          if (target.dead) return;
          this.damageEnemy(target, p.damage * (isSplash ? 0.6 : 1), p.kind === 'physical' ? 'physical' : 'magic', p.source);
          if (p.status) applyStatusToTarget(target, p.status, p.damage);
          if (p.kind === 'aoe') this.vfx.explosion(p.mesh.position, 0xff7043, p.splashRadius);
        },
        findCandidates: enemiesNear,
        findSplashTargets: enemiesNear
      });
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    if (this.waveManager.checkWaveComplete(this.enemies)) {
      const interest = this.economy.applyInterest();
      if (this.cleanWaveStreak >= 0) {
        this.cleanWaveStreak += 1;
        if (this.cleanWaveStreak >= 10) this._unlockAchievement('no_damage_10');
      } else {
        this.cleanWaveStreak = 0;
      }
      this.hud.notify(`Vague ${this.waveManager.waveNumber} nettoyée ! Intérêts +${interest}🪙`, 'good');
      this.waveManager.startNextWave();
    }

    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  _processMeleeContactDamage(dt) {
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.flying || enemy.explodeDamage > 0) continue;
      for (const tower of this.towerManager.towers) {
        if (tower.hp <= 0) continue;
        if (enemy.position.distanceTo(tower.position) < 1.5) {
          const destroyed = tower.takeDamage(enemy.damage * dt * 2.2);
          if (destroyed) this._destroyTower(tower);
        }
      }
      if (enemy.position.distanceTo(this.player.position) < 1.3 && !this.player.invincible) {
        this.player.takeDamage(enemy.damage * dt * 1.5);
      }
    }
  }

  _processKamikaze() {
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.explodeDamage <= 0) continue;
      let triggered = false;
      if (enemy.position.distanceTo(this.player.position) < 1.8) triggered = true;
      for (const tower of this.towerManager.towers) {
        if (tower.hp > 0 && enemy.position.distanceTo(tower.position) < 1.8) triggered = true;
      }
      if (triggered) {
        this.vfx.explosion(enemy.position, 0xff5252, enemy.explodeRadius);
        this.audio.sfx.explosion();
        this.cameraRig.addShake(0.4, 0.3);
        if (enemy.position.distanceTo(this.player.position) <= enemy.explodeRadius) this.player.takeDamage(enemy.explodeDamage);
        for (const tower of this.towerManager.towers) {
          if (tower.position.distanceTo(enemy.position) <= enemy.explodeRadius) {
            if (tower.takeDamage(enemy.explodeDamage)) this._destroyTower(tower);
          }
        }
        this._onEnemyKilled(enemy);
        enemy.die();
      }
    }
  }

  _destroyTower(tower) {
    this.hud.notify(`${tower.def.name} détruite !`, 'danger');
    this.level.freeCell(tower.col, tower.row);
    this.level.refreshPathVisual();
    tower.destroy();
    this.towerManager.towers = this.towerManager.towers.filter((t) => t !== tower);
    if (this.selectedTower === tower) { this.selectedTower = null; this.hud.hideTowerPanel(); }
  }

  _onEnemyReachBase(enemy) {
    const angle = Math.atan2(enemy.position.x - this.level.baseWorldPos.x, enemy.position.z - this.level.baseWorldPos.z);
    const dmg = enemy.explodeDamage > 0 ? enemy.explodeDamage : enemy.damage;
    this.baseHealth.damage(dmg, angle);
    this.vfx.explosion(this.level.baseWorldPos, 0xff5252, 2);
  }

  _onBossTelegraph(boss, state) {
    this.hud.notify(`⚠ ${boss.bossDef.name} prépare une attaque !`, 'danger');
    let pos = boss.position;
    let radius = 4;
    if (state.attack === 'chargedBeam' && state.target) { pos = state.target.position; radius = 2.5; }
    this._telegraphMesh = this.vfx.telegraphMarker(pos, radius, state.totalTelegraph);
  }

  _onBossAttackResolve(boss, state, interrupted) {
    if (state.attack === 'slam') {
      if (this.player.position.distanceTo(boss.position) < 4.5) this.player.takeDamage(boss.damage * 1.5);
      for (const tower of this.towerManager.towers) {
        if (tower.position.distanceTo(boss.position) < 4.5) {
          if (tower.takeDamage(boss.damage * 1.5)) this._destroyTower(tower);
        }
      }
      this.vfx.explosion(boss.position, 0xff1744, 4.5);
      this.cameraRig.addShake(0.5, 0.4);
    } else if (state.attack === 'chargedBeam') {
      if (interrupted) {
        this.hud.notify('Attaque téléguidée interceptée !', 'good');
      } else if (state.target) {
        state.target.takeDamage(9999);
        this._destroyTower(state.target);
        this.hud.notify(`${boss.bossDef.name} a détruit une tour !`, 'danger');
        this.cameraRig.addShake(0.6, 0.4);
      } else {
        this.baseHealth.damage(boss.damage * 2, 0);
      }
    } else if (state.attack === 'summonSwarm' || state.attack === 'dive') {
      for (let i = 0; i < 4; i++) {
        this.waveManager.spawnFollowUp('basic', boss.position, boss.laneIndex ?? 0, { enemies: this.enemies }, boss.pathIndex);
      }
    }
  }

  _renderTactical() {
    this.modals.open('tactical-overlay');
    this.modals.drawTactical({
      worldSize: this.level.layout.gridSize * CELL_SIZE,
      lanePaths: this.level.lanePaths,
      basePos: this.level.baseWorldPos,
      towers: this.towerManager.towers,
      enemies: this.enemies,
      playerPos: this.player.position
    });
  }

  _updateHUD() {
    if (!this.input.isDown('Tab')) this.modals.close('tactical-overlay');
    const stats = this.player.stats;
    this.hud.update({
      hp: this.player.hp, maxHp: stats.maxHp,
      stamina: this.player.stamina, maxStamina: stats.maxStamina,
      xp: this.progression.xp, xpNeeded: XP_PER_LEVEL(this.progression.level),
      level: this.progression.level,
      cooldowns: this.player.cooldowns,
      base: { hp: this.baseHealth.hp, maxHp: this.baseHealth.maxHp },
      gold: this.economy.gold, crystals: this.economy.crystals,
      wave: { number: this.waveManager.waveNumber, state: this.waveManager.state, timer: this.waveManager.prepTimer }
    });
    this.hud.updateBuildAffordability(this.economy.gold, this.progression.getStats().towerCostMult);
    this.hud.drawMinimap({
      towers: this.towerManager.towers,
      enemies: this.enemies,
      playerPos: this.player.position,
      basePos: this.level.baseWorldPos,
      worldSize: this.level.layout.gridSize * CELL_SIZE,
      laneStarts: this.level.layout.laneStarts.map((s) => this.level.grid.cellToWorld(s.col, s.row)),
      activeLaneCount: this.level.activeLaneCount
    });
    this.audio.setIntensity(this.waveManager.state === 'active' ? (this.enemies.some((e) => e.isBoss) ? 1 : 0.55) : 0.15);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _endRun(victory, forcedQuit = false) {
    this.gameOver = true;
    document.exitPointerLock?.();
    this._closeAllModals();
    const wavesSurvived = Math.max(0, this.waveManager.waveNumber - 1);
    const essence = this.meta.finishRun({ wavesSurvived, bossesKilled: this.bossesKilled, difficulty: this.config.difficulty });
    if (this.towersEverPlaced === 1) this._unlockAchievement('one_tower');
    this.modals.showGameOver({ victory: forcedQuit ? false : victory, wavesSurvived, bossesKilled: this.bossesKilled, essence });
    this.renderer.render(this.scene, this.camera);
  }
}
