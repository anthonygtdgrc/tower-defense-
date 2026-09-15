import { DIFFICULTIES, RUN_MODIFIERS, PERMANENT_TALENTS, ACHIEVEMENTS } from '../data/meta.js';
import { BIOMES } from '../world/biomes.js';

const CLASS_DEFS = {
  warrior: { name: 'Guerrier', icon: '⚔️', description: 'Équilibré, fort au corps-à-corps.' },
  ranger: { name: 'Rôdeuse', icon: '🏹', description: 'Dégâts à distance accrus, moins de PV.' }
};

export class StartMenu {
  constructor(root, saveManager, metaProgression) {
    this.root = root;
    this.save = saveManager;
    this.meta = metaProgression;
    this.config = {
      difficulty: saveManager.data.settings.difficulty || 'normal',
      map: 'valley',
      playerClass: 'warrior',
      modifiers: [],
      sandbox: false
    };
  }

  render(onStart) {
    this.root.innerHTML = `
      <div id="start-menu" class="modal-overlay visible">
        <div class="modal-box hud-panel">
          <h2>Bastion 3D — Configuration de la Partie</h2>
          <p style="color:#90a4ae; font-size:12px; margin:0;">Essence disponible: <strong id="essence-count" style="color:var(--gold)">${this.meta.essence}</strong></p>

          <div class="tab-row" id="menu-tabs">
            <button class="tab-btn active" data-tab="run">Partie</button>
            <button class="tab-btn" data-tab="talents">Talents Permanents</button>
            <button class="tab-btn" data-tab="achievements">Succès</button>
          </div>

          <div id="tab-run">
            <h3>Difficulté</h3>
            <div class="class-grid" id="difficulty-grid"></div>
            <h3>Classe</h3>
            <div class="class-grid" id="class-grid"></div>
            <h3>Carte</h3>
            <div class="map-grid" id="map-grid"></div>
            <h3>Modificateurs de Run (optionnel)</h3>
            <div class="modifier-grid" id="modifier-grid"></div>
            <label style="font-size:13px; display:flex; gap:6px; align-items:center;">
              <input type="checkbox" id="sandbox-toggle" /> Mode Bac à Sable / Infini (pas de Game Over)
            </label>
            <button id="start-run-btn" style="margin-top:10px; padding:12px; font-size:15px; font-weight:bold; background:var(--accent); color:#05131f; border:none; border-radius:8px; cursor:pointer;">
              Lancer la Partie
            </button>
          </div>

          <div id="tab-talents" style="display:none;">
            <div class="talent-grid" id="talent-grid"></div>
          </div>

          <div id="tab-achievements" style="display:none;">
            <div id="achievements-list"></div>
          </div>
        </div>
      </div>
    `;

    this._renderDifficulty();
    this._renderClasses();
    this._renderMaps();
    this._renderModifiers();
    this._renderTalents();
    this._renderAchievements();

    for (const btn of this.root.querySelectorAll('#menu-tabs .tab-btn')) {
      btn.addEventListener('click', () => {
        for (const b of this.root.querySelectorAll('#menu-tabs .tab-btn')) b.classList.remove('active');
        btn.classList.add('active');
        for (const panel of ['run', 'talents', 'achievements']) {
          this.root.querySelector(`#tab-${panel}`).style.display = panel === btn.dataset.tab ? 'block' : 'none';
        }
      });
    }

    this.root.querySelector('#sandbox-toggle').addEventListener('change', (e) => {
      this.config.sandbox = e.target.checked;
    });

    this.root.querySelector('#start-run-btn').addEventListener('click', () => onStart(this.config));
  }

  _renderDifficulty() {
    const grid = this.root.querySelector('#difficulty-grid');
    grid.innerHTML = '';
    for (const [id, def] of Object.entries(DIFFICULTIES)) {
      const card = document.createElement('div');
      card.className = `class-card ${this.config.difficulty === id ? 'selected' : ''}`;
      card.innerHTML = `<strong>${def.name}</strong><small style="color:#90a4ae">PV ennemis x${def.enemyHpMult} · Dégâts x${def.enemyDmgMult}</small>`;
      card.addEventListener('click', () => { this.config.difficulty = id; this._renderDifficulty(); });
      grid.appendChild(card);
    }
  }

  _renderClasses() {
    const grid = this.root.querySelector('#class-grid');
    grid.innerHTML = '';
    for (const [id, def] of Object.entries(CLASS_DEFS)) {
      const unlocked = this.save.data.unlockedClasses.includes(id);
      const card = document.createElement('div');
      card.className = `class-card ${this.config.playerClass === id ? 'selected' : ''} ${!unlocked ? 'locked' : ''}`;
      card.innerHTML = `<strong>${def.icon} ${def.name}</strong><small style="color:#90a4ae">${unlocked ? def.description : 'Verrouillé (talent permanent)'}</small>`;
      if (unlocked) card.addEventListener('click', () => { this.config.playerClass = id; this._renderClasses(); });
      grid.appendChild(card);
    }
  }

  _renderMaps() {
    const grid = this.root.querySelector('#map-grid');
    grid.innerHTML = '';
    for (const [id, def] of Object.entries(BIOMES)) {
      const unlocked = this.save.data.unlockedMaps.includes(id);
      const card = document.createElement('div');
      card.className = `map-card ${this.config.map === id ? 'selected' : ''} ${!unlocked ? 'locked' : ''}`;
      card.innerHTML = `<strong>${def.name}</strong><small style="color:#90a4ae">${unlocked ? 'Disponible' : 'Verrouillé (talent permanent)'}</small>`;
      if (unlocked) card.addEventListener('click', () => { this.config.map = id; this._renderMaps(); });
      grid.appendChild(card);
    }
  }

  _renderModifiers() {
    const grid = this.root.querySelector('#modifier-grid');
    grid.innerHTML = '';
    for (const mod of RUN_MODIFIERS) {
      const selected = this.config.modifiers.includes(mod.id);
      const card = document.createElement('div');
      card.className = `modifier-card ${selected ? 'selected' : ''}`;
      card.innerHTML = `<strong>${mod.name}</strong><small style="color:#90a4ae">${mod.description}</small>`;
      card.addEventListener('click', () => {
        if (selected) this.config.modifiers = this.config.modifiers.filter((m) => m !== mod.id);
        else this.config.modifiers = [...this.config.modifiers, mod.id];
        this._renderModifiers();
      });
      grid.appendChild(card);
    }
  }

  _renderTalents() {
    const grid = this.root.querySelector('#talent-grid');
    grid.innerHTML = '';
    for (const def of PERMANENT_TALENTS) {
      const rank = this.meta.talentRank(def.id);
      const card = document.createElement('div');
      card.className = 'talent-card';
      const maxed = rank >= def.max;
      card.innerHTML = `<strong>${def.name}</strong><small style="color:#90a4ae">Rang ${rank}/${def.max}</small>`;
      const btn = document.createElement('button');
      btn.textContent = maxed ? 'Max' : `Améliorer (${this.meta._costForRank(def, rank)} essence)`;
      btn.disabled = maxed || !this.meta.canPurchase(def.id);
      btn.addEventListener('click', () => {
        if (this.meta.purchase(def.id)) {
          this.root.querySelector('#essence-count').textContent = this.meta.essence;
          this._renderTalents();
          this._renderClasses();
          this._renderMaps();
        }
      });
      card.appendChild(btn);
      grid.appendChild(card);
    }
  }

  _renderAchievements() {
    const list = this.root.querySelector('#achievements-list');
    const unlocked = new Set(this.save.data.achievements);
    list.innerHTML = ACHIEVEMENTS.map((a) => `
      <div class="item-card">
        <span>${unlocked.has(a.id) ? '✅' : '⬜'} <strong>${a.name}</strong> — <small style="color:#90a4ae">${a.description}</small></span>
      </div>`).join('');
  }

  hide() {
    const el = this.root.querySelector('#start-menu');
    if (el) el.classList.remove('visible');
  }
}
