import { COST } from './gameConfig.js';
export function canAfford(resources, cost){ return resources.minerals >= (cost.m||0) && resources.gas >= (cost.g||0) && resources.supplyUsed + (cost.supply||0) <= resources.supplyCap; }
export function pay(resources, cost){
  if(!canAfford(resources,cost)) return false;
  resources.minerals -= cost.m||0;
  resources.gas -= cost.g||0;
  return true;
}
export function addSupply(cap, count){ return cap + count; } // pure
export function miningTick(field, carry){
  // field amount decreases, carry returns amount
  const amt = Math.min(8, field.amount);
  field.amount -= amt;
  return amt;
}
export function supplyString(used, cap){ return `${used}/${cap}`; }
