
import { Player, Item, Monster, Rarity, ItemCategory, PlayerClass } from './types';
import { INITIAL_ITEMS, MONSTERS, GACHA_RATES, RANKS, DUNGEONS, PETS, VIP_CONFIG, SKILL_TREE } from './constants';

export const createNewPlayer = (username: string, pClass: PlayerClass = 'None'): Player => ({
  id: Math.random().toString(36).substr(2, 9),
  username,
  playerClass: pClass,
  level: 1,
  xp: 0,
  coins: 100,
  hp: 100,
  maxHp: 100,
  baseDamage: 10,
  baseCrit: 5,
  inventory: ["🪵 Wood Sword", "🧪 Small Potion"],
  pets: ["🐰 Forest Bunny"],
  activePet: "🐰 Forest Bunny",
  guild: "DragonSlayers",
  rank: "Bronze",
  vip: false,
  dailyClaimed: false,
  dailyDate: "",
  registerDate: new Date().toISOString(),
  dungeonsCleared: 0,
});

export const getPlayerTotalStats = (player: Player) => {
  let damage = player.baseDamage;
  let crit = player.baseCrit;
  let hp = player.maxHp;

  // Class Skills
  if (player.playerClass !== 'None') {
    const skills = SKILL_TREE[player.playerClass];
    skills.forEach(skill => {
      if (skill.name.includes('Critical')) crit += skill.bonus;
      else damage += skill.bonus;
    });
  }

  // Equipment
  const weapon = INITIAL_ITEMS.find(i => i.name === player.equippedWeapon);
  const armor = INITIAL_ITEMS.find(i => i.name === player.equippedArmor);
  const accessory = INITIAL_ITEMS.find(i => i.name === player.equippedAccessory);

  if (weapon) {
    damage += weapon.damage || 0;
    crit += weapon.crit || 0;
  }
  if (armor) {
    hp += armor.hp || 0;
  }
  if (accessory) {
    damage += accessory.damage || 0;
    hp += accessory.hp || 0;
  }

  // Pet
  const activePetData = PETS.find(p => p.name === player.activePet);
  if (activePetData) {
    damage += activePetData.damage;
  }

  return { damage, crit, hp };
};

export const handleLevelUp = (player: Player): string | null => {
  const xpNeeded = player.level * 100;
  if (player.xp >= xpNeeded) {
    player.level += 1;
    player.xp -= xpNeeded;
    player.maxHp += 20;
    player.hp = player.maxHp;
    player.baseDamage += 5;
    
    // Check rank
    const sortedRanks = [...RANKS].sort((a, b) => b.min - a.min);
    const newRank = sortedRanks.find(r => player.level >= r.min);
    if (newRank) player.rank = newRank.name;
    
    return `🎉 LEVEL UP! Kamu sekarang Level ${player.level}! ❤️ HP & ⚔️ Damage meningkat!`;
  }
  return null;
};

export const rollGacha = (customRarity?: Rarity): Item => {
  let targetRarity = customRarity;
  
  if (!targetRarity) {
    const rand = Math.random() * 100;
    let cumulative = 0;
    for (const [rarity, rate] of Object.entries(GACHA_RATES)) {
      cumulative += rate;
      if (rand <= cumulative) {
        targetRarity = rarity as Rarity;
        break;
      }
    }
  }

  const itemsOfRarity = INITIAL_ITEMS.filter(i => i.rarity === targetRarity);
  return itemsOfRarity[Math.floor(Math.random() * itemsOfRarity.length)];
};

export const checkRandomEvent = (player: Player): string | null => {
  const rand = Math.random() * 100;
  
  // 5% Level Up Bonus
  if (rand < 5) {
    const bonusLevel = Math.floor(Math.random() * 3) + 1;
    const oldLevel = player.level;
    player.level += bonusLevel;
    player.maxHp += (20 * bonusLevel);
    player.hp = player.maxHp;
    player.baseDamage += (5 * bonusLevel);
    return `🎉 Level Up! Kamu mendapatkan bonus level x${bonusLevel}! LV kamu: ${oldLevel} → ${player.level} 💪 Damage & HP meningkat!`;
  } 
  
  // 7% Unlucky Penalty
  else if (rand < 12) {
    const percent = Math.floor(Math.random() * 70) + 10;
    const penalty = Math.floor(player.coins * (percent / 100));
    player.coins -= penalty;
    return `💸 Malang! Koinmu berkurang ${percent}% → sekarang ${player.coins} coins`;
  } 
  
  // 3% Pet Evolusi
  else if (rand < 15) {
    const petData = PETS.find(p => p.name === player.activePet);
    if (petData && petData.nextForm) {
      const oldPet = player.activePet;
      player.activePet = petData.nextForm;
      // Also update inventory of pets
      player.pets = player.pets.map(p => p === oldPet ? petData.nextForm : p);
      const newPetData = PETS.find(p => p.name === player.activePet);
      return `🔥 Pet Evolusi! ${oldPet} → ${player.activePet} ⚔️ Damage meningkat!`;
    }
  } 
  
  // 10% Extra Loot
  else if (rand < 25) {
    const rareItem = rollGacha(Rarity.RARE);
    player.inventory.push(rareItem.name);
    return `🎁 Kejutan Loot! Kamu mendapatkan item langka: ${rareItem.name} 🛡️`;
  } 
  
  // 2% Gacha Super
  else if (rand < 27) {
    const legendaryItem = rollGacha(Rarity.LEGENDARY);
    player.inventory.push(legendaryItem.name);
    return `🌟 Gacha Super! Kamu beruntung! ${legendaryItem.name} Legendary ditambahkan ke inventori!`;
  }
  
  return null;
};
