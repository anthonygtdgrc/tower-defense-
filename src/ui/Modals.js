import { SKILL_TREE } from '../data/skills.js';
import { RARITIES } from '../data/items.js';

export class Modals {
  constructor(root) {
    this.root = root;
    this.root.innerHTML = `
      <div id="skill-modal" class="modal-overlay">
        <div class="modal-box hud-panel">
          <button class="close-btn" data-close="skill-modal">✕</button>
          <h2>Arbre de Compétences <span id="skill-points-label"></span></h2>
          <div id="skill-branches"></div>
        </div>
      </div>

      <div id="inventory-modal" class="modal-overlay">
        <div class="modal-box hud-panel">
          <button class="close-btn" data-close="inventory-modal">✕</button>
          <h2>Équipement</h2>
          <div id="equipped-section"></div>
          <h3>Inventaire</h3>
          <div id="inventory-list"></div>
        </div>
      </div>

      <div id="pause-modal" class="modal-overlay">
        <div class="modal-box hud-panel" style="text-align:center; align-items:center;">
          <h2>Pause</h2>
          <p id="pause-stats"></p>
          <div style="display:flex; gap:10px;">
            <button id="resume-btn" class="tab-btn active">Reprendre</button>
            <button id="quit-btn" class="tab-btn">Abandonner la partie</button>
          </div>
        </div>
      </div>

      <div id="tactical-overlay">
        <div class="modal-box hud-panel" style="align-items:center;">
          <h2>Carte Tactique</h2>
          <canvas id="tactical-map"></canvas>
          <p style="font-size:12px; color:#90a4ae;">Relâchez Tab pour reprendre le combat.</p>
        </div>
      </div>

      <div id="game-over-screen" class="modal-overlay">
        <div class="modal-box hud-panel">
          <h2 id="game-over-title">Défaite</h2>
          <p id="game-over-stats"></p>
          <p id="game-over-essence"></p>
          <button id="restart-btn" class="tab-btn active" style="align-self:center; padding:10px 24px;">Nouvelle Partie</button>
        </div>
      </div>
    `;
    for (const btn of this.root.querySelectorAll('[data-close]')) {
      btn.addEventListener('click', () => this.close(btn.dataset.close));
    }
    this.el = {
      skillModal: this.root.querySelector('#skill-modal'),
      skillPointsLabel: this.root.querySelector('#skill-points-label'),
      skillBranches: this.root.querySelector('#skill-branches'),
      inventoryModal: this.root.querySelector('#inventory-modal'),
      equippedSection: this.root.querySelector('#equipped-section'),
      inventoryList: this.root.querySelector('#inventory-list'),
      pauseModal: this.root.querySelector('#pause-modal'),
      pauseStats: this.root.querySelector('#pause-stats'),
      resumeBtn: this.root.querySelector('#resume-btn'),
      quitBtn: this.root.querySelector('#quit-btn'),
      tacticalOverlay: this.root.querySelector('#tactical-overlay'),
      tacticalCanvas: this.root.querySelector('#tactical-map'),
      gameOverScreen: this.root.querySelector('#game-over-screen'),
      gameOverTitle: this.root.querySelector('#game-over-title'),
      gameOverStats: this.root.querySelector('#game-over-stats'),
      gameOverEssence: this.root.querySelector('#game-over-essence'),
      restartBtn: this.root.querySelector('#restart-btn')
    };
    this.tacticalCtx = this.el.tacticalCanvas.getContext('2d');
  }

  close(id) { this.root.querySelector(`#${id}`).classList.remove('visible'); }
  open(id) { this.root.querySelector(`#${id}`).classList.add('visible'); }
  isOpen(id) { return this.root.querySelector(`#${id}`).classList.contains('visible'); }
  anyOpen() {
    return ['skill-modal', 'inventory-modal', 'pause-modal', 'tactical-overlay', 'game-over-screen']
      .some((id) => this.isOpen(id));
  }

  renderSkillTree(progression, onAllocate) {
    this.el.skillPointsLabel.textContent = `(${progression.skillPoints} point(s) disponible(s))`;
    this.el.skillBranches.innerHTML = '';
    this.el.skillBranches.style.display = 'grid';
    this.el.skillBranches.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
    this.el.skillBranches.style.gap = '10px';
    for (const [branchId, branch] of Object.entries(SKILL_TREE)) {
      const box = document.createElement('div');
      box.className = 'skill-branch';
      box.innerHTML = `<strong>${branch.name}</strong>`;
      for (const node of branch.nodes) {
        const allocated = progression.allocated.has(node.id);
        const canAllocate = progression.canAllocate(node.id);
        const row = document.createElement('div');
        row.className = `skill-node ${allocated ? 'allocated' : ''} ${!allocated && !canAllocate ? 'locked' : ''}`;
        row.innerHTML = `<span>${node.name} <small style="color:#90a4ae">(coût ${node.cost})</small></span>`;
        const btn = document.createElement('button');
        btn.textContent = allocated ? '✓' : 'Débloquer';
        btn.disabled = allocated || !canAllocate;
        btn.addEventListener('click', () => { onAllocate(node.id); this.renderSkillTree(progression, onAllocate); });
        row.appendChild(btn);
        box.appendChild(row);
      }
      this.el.skillBranches.appendChild(box);
    }
  }

  renderInventory(progression, onEquip) {
    this.el.equippedSection.innerHTML = ['weapon', 'armor'].map((slot) => {
      const item = progression.equipment[slot];
      return `<div class="item-card"><span>${slot === 'weapon' ? '⚔️' : '🛡️'} ${item ? item.name : 'Aucun'} ${item ? this._statsLine(item) : ''}</span></div>`;
    }).join('');

    if (!progression.inventory.length) {
      this.el.inventoryList.innerHTML = '<p style="color:#90a4ae; font-size:12px;">Aucun objet. Vainquez des ennemis pour obtenir du butin.</p>';
      return;
    }
    this.el.inventoryList.innerHTML = '';
    for (const item of progression.inventory) {
      const rarity = RARITIES.find((r) => r.id === item.rarity);
      const row = document.createElement('div');
      row.className = 'item-card';
      row.innerHTML = `<span style="color:${rarity.color}">${item.name} ${this._statsLine(item)}</span>`;
      const btn = document.createElement('button');
      btn.textContent = 'Équiper';
      btn.addEventListener('click', () => { onEquip(item.id); this.renderInventory(progression, onEquip); });
      row.appendChild(btn);
      this.el.inventoryList.appendChild(row);
    }
  }

  _statsLine(item) {
    return Object.entries(item.stats).map(([k, v]) => `${k}:+${v}`).join(' ');
  }

  renderPauseStats(state) {
    this.el.pauseStats.textContent = `Vague ${state.wave} · Or ${Math.floor(state.gold)} · Niveau ${state.level}`;
  }

  drawTactical(data) {
    const canvas = this.el.tacticalCanvas;
    const parentWidth = Math.min(720, window.innerWidth * 0.85);
    canvas.width = parentWidth;
    canvas.height = parentWidth;
    const ctx = this.tacticalCtx;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0d1420';
    ctx.fillRect(0, 0, size, size);
    const scale = size / data.worldSize;
    const toMap = (x, z) => ({ x: size / 2 + x * scale, y: size / 2 + z * scale });

    ctx.strokeStyle = 'rgba(138,115,85,0.5)';
    ctx.lineWidth = 3;
    for (const path of data.lanePaths) {
      if (!path) continue;
      ctx.beginPath();
      path.forEach((node, i) => {
        const p = toMap(node.x, node.z);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }

    ctx.fillStyle = '#64b5f6';
    const b = toMap(data.basePos.x, data.basePos.z);
    ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#90a4ae';
    for (const t of data.towers) {
      const p = toMap(t.position.x, t.position.z);
      ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
    }
    ctx.fillStyle = '#ef5350';
    for (const e of data.enemies) {
      if (e.dead) continue;
      const p = toMap(e.position.x, e.position.z);
      ctx.beginPath(); ctx.arc(p.x, p.y, e.isBoss ? 7 : 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffd54f';
    const pp = toMap(data.playerPos.x, data.playerPos.z);
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 5, 0, Math.PI * 2); ctx.fill();
  }

  showGameOver({ victory, wavesSurvived, bossesKilled, essence }) {
    this.el.gameOverTitle.textContent = victory ? 'Victoire !' : 'Base Détruite';
    this.el.gameOverStats.textContent = `Vagues survécues: ${wavesSurvived} · Boss vaincus: ${bossesKilled}`;
    this.el.gameOverEssence.textContent = `+${essence} Essence gagnée`;
    this.open('game-over-screen');
  }
}
