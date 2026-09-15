import { TOWER_LIST } from '../data/towers.js';
import { ABILITIES } from '../data/skills.js';

const ABILITY_ORDER = ['a', 'e', 'r', 'f'];

export class HUD {
  constructor(root) {
    this.root = root;
    this._buildDom();
    this.selectedBuildType = null;
    this.notifyTimers = [];
  }

  _buildDom() {
    this.root.innerHTML = `
      <div id="crosshair"></div>
      <div id="pause-hint">Échap: Pause · Tab: Carte tactique · K: Compétences · I: Équipement · N: Lancer la vague</div>

      <div id="vitals" class="hud-panel">
        <div class="bar-row"><span class="level-badge">Nv <span id="player-level">1</span></span>
          <div class="bar-track"><div id="hp-fill" class="bar-fill hp" style="width:100%"></div></div>
          <span id="hp-text">100/100</span>
        </div>
        <div class="bar-row"><span>End</span>
          <div class="bar-track"><div id="stamina-fill" class="bar-fill stamina" style="width:100%"></div></div>
        </div>
        <div class="bar-row"><span>XP</span>
          <div class="bar-track"><div id="xp-fill" class="bar-fill xp" style="width:0%"></div></div>
        </div>
      </div>

      <div id="abilities">
        ${ABILITY_ORDER.map((slot) => {
          const def = ABILITIES[slot];
          return `<div class="ability-slot hud-panel" data-slot="${slot}" title="${def.name} — ${def.describe}">
            <span class="ability-key">${def.key}</span>
            <span>${slot === 'a' ? '🌀' : slot === 'e' ? '🏹' : slot === 'r' ? '💚' : '⚡'}</span>
            <div class="ability-cd-overlay" style="display:none"></div>
          </div>`;
        }).join('')}
      </div>

      <div id="top-center">
        <div id="base-hp-row" class="hud-panel">
          <span class="base-icon">🔷</span>
          <div id="base-hp-track"><div id="base-hp-fill" style="width:100%"></div></div>
          <span id="base-hp-text">100/100</span>
        </div>
        <div id="wave-info" class="hud-panel">
          <span>Vague <span id="wave-number">1</span></span>
          <span id="wave-countdown"></span>
          <div id="wave-preview"></div>
          <button id="skip-wave-btn">Lancer maintenant</button>
        </div>
      </div>

      <div id="resources">
        <div class="resource-chip gold hud-panel">🪙 <span id="gold-count">0</span></div>
        <div class="resource-chip crystal hud-panel">💎 <span id="crystal-count">0</span></div>
      </div>

      <div id="minimap-wrap" class="hud-panel"><canvas id="minimap" width="160" height="160"></canvas></div>

      <div id="notifications"></div>

      <div id="build-bar" class="hud-panel">
        ${TOWER_LIST.map((t, i) => `
          <div class="build-slot" data-type="${t.id}" title="${t.name} — ${t.description}">
            <span class="hotkey">${i + 1}</span>
            <span>${t.icon}</span>
            <span class="cost">${t.baseCost}</span>
          </div>`).join('')}
      </div>

      <div id="interact-prompt" class="hud-panel"></div>

      <div id="tower-panel" class="hud-panel"></div>
    `;

    this.el = {
      hpFill: this.root.querySelector('#hp-fill'),
      hpText: this.root.querySelector('#hp-text'),
      staminaFill: this.root.querySelector('#stamina-fill'),
      xpFill: this.root.querySelector('#xp-fill'),
      level: this.root.querySelector('#player-level'),
      baseHpFill: this.root.querySelector('#base-hp-fill'),
      baseHpText: this.root.querySelector('#base-hp-text'),
      waveNumber: this.root.querySelector('#wave-number'),
      waveCountdown: this.root.querySelector('#wave-countdown'),
      wavePreview: this.root.querySelector('#wave-preview'),
      skipBtn: this.root.querySelector('#skip-wave-btn'),
      gold: this.root.querySelector('#gold-count'),
      crystals: this.root.querySelector('#crystal-count'),
      minimap: this.root.querySelector('#minimap'),
      notifications: this.root.querySelector('#notifications'),
      buildSlots: [...this.root.querySelectorAll('.build-slot')],
      interactPrompt: this.root.querySelector('#interact-prompt'),
      towerPanel: this.root.querySelector('#tower-panel'),
      abilitySlots: [...this.root.querySelectorAll('.ability-slot')]
    };
    this.minimapCtx = this.el.minimap.getContext('2d');
  }

  bindBuildSlots(onSelect) {
    for (const slot of this.el.buildSlots) {
      slot.addEventListener('click', () => onSelect(slot.dataset.type));
    }
  }
  bindSkipWave(onSkip) { this.el.skipBtn.addEventListener('click', onSkip); }

  setActiveBuildType(typeId) {
    this.selectedBuildType = typeId;
    for (const slot of this.el.buildSlots) slot.classList.toggle('active', slot.dataset.type === typeId);
  }

  updateBuildAffordability(gold, costMult) {
    for (const slot of this.el.buildSlots) {
      const def = TOWER_LIST.find((t) => t.id === slot.dataset.type);
      const cost = Math.round(def.baseCost * costMult);
      slot.querySelector('.cost').textContent = cost;
      slot.classList.toggle('disabled', cost > gold);
    }
  }

  update(state) {
    const hpPct = Math.max(0, (state.hp / state.maxHp) * 100);
    this.el.hpFill.style.width = `${hpPct}%`;
    this.el.hpText.textContent = `${Math.ceil(state.hp)}/${Math.ceil(state.maxHp)}`;
    this.el.staminaFill.style.width = `${(state.stamina / state.maxStamina) * 100}%`;
    this.el.xpFill.style.width = `${(state.xp / state.xpNeeded) * 100}%`;
    this.el.level.textContent = state.level;

    const basePct = Math.max(0, (state.base.hp / state.base.maxHp) * 100);
    this.el.baseHpFill.style.width = `${basePct}%`;
    this.el.baseHpFill.style.background = basePct < 30 ? 'linear-gradient(90deg,#ef5350,#e57373)' : 'linear-gradient(90deg,#42a5f5,#64b5f6)';
    this.el.baseHpText.textContent = `${Math.ceil(state.base.hp)}/${Math.ceil(state.base.maxHp)}`;

    this.el.waveNumber.textContent = state.wave.number;
    if (state.wave.state === 'prep') {
      this.el.waveCountdown.textContent = `Préparation: ${Math.ceil(state.wave.timer)}s`;
      this.el.skipBtn.style.display = 'inline-block';
    } else {
      this.el.waveCountdown.textContent = state.wave.state === 'active' ? 'En cours…' : 'Terminée';
      this.el.skipBtn.style.display = 'none';
    }

    this.el.gold.textContent = Math.floor(state.gold);
    this.el.crystals.textContent = Math.floor(state.crystals);

    for (const slotEl of this.el.abilitySlots) {
      const slot = slotEl.dataset.slot;
      const cd = state.cooldowns[slot];
      const def = ABILITIES[slot];
      const overlay = slotEl.querySelector('.ability-cd-overlay');
      if (cd > 0.05) {
        overlay.style.display = 'flex';
        overlay.textContent = cd.toFixed(1);
      } else {
        overlay.style.display = 'none';
      }
    }
  }

  setWavePreview(waveNumber, kind, icons) {
    this.el.waveNumber.textContent = waveNumber;
    const label = kind === 'boss' ? ' (BOSS)' : kind === 'elite' ? ' (ÉLITE)' : '';
    this.el.wavePreview.innerHTML = icons.map((i) => `
      <div class="preview-icon ${i.elite || i.boss ? 'elite' : ''}">${i.icon}${i.count > 1 ? `<span class="preview-count">${i.count}</span>` : ''}</div>
    `).join('') + (label ? `<div class="preview-icon">${label}</div>` : '');
  }

  notify(text, type = 'info') {
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.textContent = text;
    this.el.notifications.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  spawnDamageNumber(x, y, amount, crit = false) {
    const el = document.createElement('div');
    el.className = `dmg-number${crit ? ' crit' : ''}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.textContent = Math.round(amount);
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  setInteractPrompt(text) {
    if (!text) { this.el.interactPrompt.classList.remove('visible'); return; }
    this.el.interactPrompt.textContent = text;
    this.el.interactPrompt.classList.add('visible');
  }

  showTowerPanel(html) {
    this.el.towerPanel.innerHTML = html;
    this.el.towerPanel.classList.add('visible');
  }
  hideTowerPanel() {
    this.el.towerPanel.classList.remove('visible');
  }

  drawMinimap({ towers, enemies, playerPos, basePos, worldSize, laneStarts, activeLaneCount }) {
    const ctx = this.minimapCtx;
    const size = 160;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(10,14,20,0.9)';
    ctx.fillRect(0, 0, size, size);
    const scale = size / worldSize;
    const toMap = (x, z) => ({ x: size / 2 + x * scale, y: size / 2 + z * scale });

    ctx.fillStyle = '#4dd0e1';
    for (let i = 0; i < activeLaneCount; i++) {
      const s = laneStarts[i];
      const p = toMap(s.x, s.z);
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = '#64b5f6';
    const b = toMap(basePos.x, basePos.z);
    ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#90a4ae';
    for (const t of towers) {
      const p = toMap(t.position.x, t.position.z);
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }

    ctx.fillStyle = '#ef5350';
    for (const e of enemies) {
      if (e.dead) continue;
      const p = toMap(e.position.x, e.position.z);
      ctx.beginPath(); ctx.arc(p.x, p.y, e.isBoss ? 4 : 2, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = '#ffd54f';
    const pp = toMap(playerPos.x, playerPos.z);
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}
