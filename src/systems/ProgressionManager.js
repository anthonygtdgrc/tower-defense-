import { SKILL_TREE, XP_PER_LEVEL, SKILL_POINTS_PER_LEVEL } from '../data/skills.js';
import { rollItem, rollRarity } from '../data/items.js';

const BASE_PLAYER_STATS = {
  maxHp: 100,
  moveSpeed: 6.2,
  sprintMult: 1.65,
  maxStamina: 100,
  staminaRegen: 20,
  meleeDamage: 14,
  meleeCooldown: 0.5,
  meleeRange: 2.6,
  rangedDamage: 11,
  rangedCooldown: 0.65,
  rangedRange: 26,
  critChance: 0.05,
  armor: 0,
  jumpVelocity: 7.4,
  dashSpeed: 19,
  dashDuration: 0.16,
  dashCooldown: 1.1
};

const CLASS_BONUSES = {
  warrior: {},
  ranger: { rangedDamageMult: 1.25, maxHpMult: 0.85, meleeDamageMult: 0.85 }
};

export class ProgressionManager {
  constructor(bus, runModifiers = {}, metaEffects = {}, playerClass = 'warrior') {
    this.bus = bus;
    this.runModifiers = runModifiers;
    this.metaEffects = metaEffects;
    this.classBonus = CLASS_BONUSES[playerClass] || {};
    this.level = 1;
    this.xp = 0;
    this.skillPoints = 0;
    this.allocated = new Set();
    this.equipment = { weapon: null, armor: null };
    this.inventory = [];
    this._statsCache = null;
    this._dirty = true;
  }

  addXP(amount) {
    const mult = this.metaEffects.xpMult || 1;
    this.xp += amount * mult;
    let leveled = false;
    while (this.xp >= XP_PER_LEVEL(this.level)) {
      this.xp -= XP_PER_LEVEL(this.level);
      this.level += 1;
      this.skillPoints += SKILL_POINTS_PER_LEVEL;
      leveled = true;
    }
    if (leveled) this.bus.emit('player:levelup', { level: this.level });
  }

  canAllocate(nodeId) {
    for (const branch of Object.values(SKILL_TREE)) {
      const node = branch.nodes.find((n) => n.id === nodeId);
      if (!node) continue;
      if (this.allocated.has(nodeId)) return false;
      if (this.skillPoints < node.cost) return false;
      if (node.requires && !this.allocated.has(node.requires)) return false;
      return true;
    }
    return false;
  }

  allocate(nodeId) {
    if (!this.canAllocate(nodeId)) return false;
    for (const branch of Object.values(SKILL_TREE)) {
      const node = branch.nodes.find((n) => n.id === nodeId);
      if (!node) continue;
      this.skillPoints -= node.cost;
      this.allocated.add(nodeId);
      this._dirty = true;
      this.bus.emit('player:skillallocated', { nodeId });
      return true;
    }
    return false;
  }

  lootDrop(slot, luck = 0) {
    const rarity = rollRarity(luck);
    const item = rollItem(slot, rarity);
    this.inventory.push(item);
    this.bus.emit('player:loot', { item });
    if (rarity === 'legendary') this.bus.emit('achievement:progress', { id: 'legendary_drop' });
    return item;
  }

  equip(itemId) {
    const idx = this.inventory.findIndex((i) => i.id === itemId);
    if (idx === -1) return false;
    const item = this.inventory[idx];
    const prev = this.equipment[item.slot];
    this.equipment[item.slot] = item;
    this.inventory.splice(idx, 1);
    if (prev) this.inventory.push(prev);
    this._dirty = true;
    this.bus.emit('player:equip', { item });
    return true;
  }

  _skillEffects() {
    const effects = {};
    for (const branch of Object.values(SKILL_TREE)) {
      for (const node of branch.nodes) {
        if (!this.allocated.has(node.id)) continue;
        for (const [k, v] of Object.entries(node.effect)) {
          if (typeof v === 'number' && k.endsWith('Mult')) {
            effects[k] = (effects[k] ?? 1) * v;
          } else {
            effects[k] = (effects[k] ?? 0) + v;
          }
        }
      }
    }
    return effects;
  }

  getStats() {
    if (!this._dirty && this._statsCache) return this._statsCache;
    const skillFx = this._skillEffects();
    const stats = { ...BASE_PLAYER_STATS };

    // equipment
    for (const item of Object.values(this.equipment)) {
      if (!item) continue;
      for (const [stat, val] of Object.entries(item.stats)) {
        if (stat === 'damage') { stats.meleeDamage += val; stats.rangedDamage += val; }
        else if (stat === 'attackSpeed') { stats.meleeCooldown /= (1 + val); stats.rangedCooldown /= (1 + val); }
        else if (stat === 'critChance') stats.critChance += val;
        else if (stat === 'maxHp') stats.maxHp += val;
        else if (stat === 'armor') stats.armor += val;
        else if (stat === 'moveSpeed') stats.moveSpeed += val;
      }
    }

    // class bonus
    if (this.classBonus.rangedDamageMult) stats.rangedDamage *= this.classBonus.rangedDamageMult;
    if (this.classBonus.meleeDamageMult) stats.meleeDamage *= this.classBonus.meleeDamageMult;
    if (this.classBonus.maxHpMult) stats.maxHp *= this.classBonus.maxHpMult;

    // skill tree
    if (skillFx.meleeDamageMult) stats.meleeDamage *= skillFx.meleeDamageMult;
    if (skillFx.rangedDamageMult) stats.rangedDamage *= skillFx.rangedDamageMult;
    if (skillFx.maxHpMult) stats.maxHp *= skillFx.maxHpMult;
    if (skillFx.dashCooldownMult) stats.dashCooldown *= skillFx.dashCooldownMult;

    // meta talents
    if (this.metaEffects.playerMaxHpMult) stats.maxHp *= this.metaEffects.playerMaxHpMult;

    // run modifiers
    if (this.runModifiers.playerDamageMult) { stats.meleeDamage *= this.runModifiers.playerDamageMult; stats.rangedDamage *= this.runModifiers.playerDamageMult; }
    if (this.runModifiers.playerHpMult) stats.maxHp *= this.runModifiers.playerHpMult;

    stats.abilityCooldownMult = skillFx.abilityCooldownMult || 1;
    stats.whirlwindDamageMult = skillFx.whirlwindDamageMult || 1;
    stats.powerShotPierce = skillFx.powerShotPierce || 0;
    stats.statusDamageMult = skillFx.statusDamageMult || 1;
    stats.repairPulseMult = skillFx.repairPulseMult || 1;
    stats.overchargeDurationMult = skillFx.overchargeDurationMult || 1;
    stats.interestBonus = skillFx.interestBonus || 0;
    stats.towerCostMult = (skillFx.towerCostMult || 1) * (this.metaEffects.towerCostMult || 1) * (this.runModifiers.towerCostMult || 1);

    this._statsCache = stats;
    this._dirty = false;
    return stats;
  }
}
