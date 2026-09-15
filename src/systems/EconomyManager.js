export class EconomyManager {
  constructor(bus, { startGold = 150, startCrystals = 0, goldMult = 1, interestBonus = 0 } = {}) {
    this.bus = bus;
    this.gold = startGold;
    this.crystals = startCrystals;
    this.goldMult = goldMult;
    this.interestRate = 0.04 + interestBonus; // % of banked gold granted between waves
    this.totalGoldEarned = 0;
  }

  addGold(amount) {
    const final = Math.round(amount * this.goldMult);
    this.gold += final;
    this.totalGoldEarned += final;
    this.bus.emit('economy:gold', { gold: this.gold, delta: final });
    return final;
  }

  spendGold(amount) {
    if (this.gold < amount) return false;
    this.gold -= amount;
    this.bus.emit('economy:gold', { gold: this.gold, delta: -amount });
    return true;
  }

  addCrystals(amount) {
    this.crystals += amount;
    this.bus.emit('economy:crystals', { crystals: this.crystals });
  }

  spendCrystals(amount) {
    if (this.crystals < amount) return false;
    this.crystals -= amount;
    this.bus.emit('economy:crystals', { crystals: this.crystals });
    return true;
  }

  applyInterest() {
    const interest = Math.round(this.gold * this.interestRate);
    if (interest > 0) this.addGold(interest);
    return interest;
  }
}

export class BaseHealth {
  constructor(bus, maxHp = 100) {
    this.bus = bus;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.tookDamageThisRun = false;
  }

  damage(amount, fromAngle = 0) {
    this.hp = Math.max(0, this.hp - amount);
    this.tookDamageThisRun = true;
    this.bus.emit('base:damaged', { hp: this.hp, maxHp: this.maxHp, amount, angle: fromAngle });
    if (this.hp <= 0) this.bus.emit('base:destroyed', {});
  }

  isDestroyed() { return this.hp <= 0; }
}
