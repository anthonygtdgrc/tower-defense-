// Central place for translating a "status" id + source damage into the
// duration/DPS values applied to an Enemy, shared by towers and projectiles.
export function applyStatusToTarget(target, statusType, sourceDamage = 0, statusMult = 1) {
  if (!target || target.dead || !statusType) return;
  switch (statusType) {
    case 'burn': target.applyStatus('burn', 3, sourceDamage * 0.3 * statusMult); break;
    case 'poison': target.applyStatus('poison', 4, sourceDamage * 0.25 * statusMult); break;
    case 'freeze': target.applyStatus('freeze', 1.2); break;
    case 'slow': target.applyStatus('slow', 2.2); break;
    case 'stun': target.applyStatus('stun', 1.0); break;
    case 'root': target.applyStatus('root', 1.8); break;
    default: break;
  }
}
