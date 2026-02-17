
import { Player, Item, Monster, Rarity, ItemCategory, PlayerClass } from './types';
import { INITIAL_ITEMS, MONSTERS, GACHA_RATES, RANKS, PETS, SKILL_TREE } from './constants';

export const createNewPlayer = (username: string, pClass: PlayerClass = 'None'): Player => ({
  id: Math.random().toString(36).substr(2, 9),
  username,
  playerClass: pClass,
  level: 1,
  xp: 0,
  coins: 500, 
  hp: 100,
  maxHp: 100,
  baseDamage: 25,
  baseCrit: 10,
  inventory: ["🦴 Rusty Dagger"],
  activeItems: [],
  pets: ["🐰 Forest Bunny"],
  activePet: "🐰 Forest Bunny",
  guild: "",
  rank: "Bronze",
  vip: false,
  dailyClaimed: false,
  dailyDate: "",
  registerDate: new Date().toISOString(),
  dungeonsCleared: 0,
  warAttacks: 3,
});

export const getPlayerTotalStats = (player: Player) => {
  let damage = player.baseDamage;
  let crit = player.baseCrit;
  let hp = player.maxHp;

  // Active items boost
  player.activeItems.forEach(ai => {
    const item = INITIAL_ITEMS.find(i => i.name === ai.name);
    if (item) {
      damage += item.damage || 0;
      crit += item.crit || 0;
      hp += item.hp || 0;
    }
  });

  return { damage, crit, hp };
};

export const handleLevelUp = (player: Player): string | null => {
  const xpNeeded = player.level * 100;
  if (player.xp >= xpNeeded) {
    player.level += 1;
    player.xp -= xpNeeded;
    player.maxHp += 50;
    player.hp = player.maxHp;
    player.baseDamage += 15;
    const sortedRanks = [...RANKS].sort((a, b) => b.min - a.min);
    const newRank = sortedRanks.find(r => player.level >= r.min);
    if (newRank) player.rank = newRank.name;
    return `🎉 *LEVEL UP!* Kamu sekarang *Level ${player.level}*!\n❤️ HP +50 | ⚔️ DMG +15`;
  }
  return null;
};
