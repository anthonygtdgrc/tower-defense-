// Rune pool for the tower rune system. Each tower has a limited number of
// slots (see Tower.maxRuneSlots) and runes are offered as a pick-3 choice
// paid for in crystals, so slotting one is a real strategic decision rather
// than a random roll.

export const RUNES = [
  { id: 'power1', name: 'Rune de Puissance I', family: 'power', tier: 1, cost: 3, color: 0xff7043, effect: { damageMult: 1.15 } },
  { id: 'power2', name: 'Rune de Puissance II', family: 'power', tier: 2, cost: 6, color: 0xd84315, effect: { damageMult: 1.3 } },
  { id: 'range1', name: 'Rune de Portée I', family: 'range', tier: 1, cost: 3, color: 0x4fc3f7, effect: { rangeMult: 1.12 } },
  { id: 'range2', name: 'Rune de Portée II', family: 'range', tier: 2, cost: 6, color: 0x0288d1, effect: { rangeMult: 1.25 } },
  { id: 'haste1', name: 'Rune de Cadence I', family: 'haste', tier: 1, cost: 3, color: 0xffd54f, effect: { fireRateMult: 1.15 } },
  { id: 'haste2', name: 'Rune de Cadence II', family: 'haste', tier: 2, cost: 6, color: 0xf9a825, effect: { fireRateMult: 1.3 } },
  { id: 'frost', name: 'Rune de Givre', family: 'status', tier: 1, cost: 5, color: 0x80deea, effect: { status: 'freeze' } },
  { id: 'poison', name: 'Rune de Poison', family: 'status', tier: 1, cost: 5, color: 0x9ccc65, effect: { status: 'poison' } },
  { id: 'storm', name: 'Rune de Tempête', family: 'status', tier: 2, cost: 8, color: 0xba68c8, effect: { status: 'stun' } }
];

export function rollRuneOffer(excludeIds = [], count = 3) {
  const pool = RUNES.filter((r) => !excludeIds.includes(r.id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
