
import { Item, ItemCategory, Rarity, Monster, Pet, Dungeon, Skill, PlayerClass } from './types';

export const INITIAL_ITEMS: Item[] = [
  // Top Tier (100k - 5 Hours)
  { name: "🔱 Spear of Eternity", category: ItemCategory.WEAPON, damage: 1500, crit: 100, price: 100000, rarity: Rarity.MYTHIC, durationHours: 5 },
  
  // High Tier
  { name: "🐉 Emperor Plate", category: ItemCategory.ARMOR, hp: 5000, price: 75000, rarity: Rarity.LEGENDARY, durationHours: 4 },
  { name: "⚡ Void Dagger", category: ItemCategory.WEAPON, damage: 800, crit: 50, price: 50000, rarity: Rarity.LEGENDARY, durationHours: 3 },
  
  // Mid Tier
  { name: "🔥 Phoenix Amulet", category: ItemCategory.ACCESSORY, hp: 1500, price: 25000, rarity: Rarity.EPIC, durationHours: 2 },
  { name: "❄️ Frost Shield", category: ItemCategory.ARMOR, hp: 800, price: 10000, rarity: Rarity.EPIC, durationHours: 1 },
  
  // Low Tier
  { name: "🩸 Warrior Band", category: ItemCategory.ACCESSORY, damage: 100, price: 5000, rarity: Rarity.RARE, durationHours: 0.5 },
  { name: "🧪 Power Elixir", category: ItemCategory.POTION, damage: 50, price: 2000, rarity: Rarity.RARE, maxUses: 20 },
  
  // Basic / Starter
  { name: "🪵 Wood Staff", category: ItemCategory.WEAPON, damage: 30, price: 500, rarity: Rarity.COMMON, maxUses: 50 },
  { name: "🩹 Small Bandage", category: ItemCategory.POTION, heal: 20, price: 200, rarity: Rarity.COMMON, maxUses: 5 },
  
  // Lowest Tier (50 Coins - 1 Hunt)
  { name: "🦴 Rusty Dagger", category: ItemCategory.WEAPON, damage: 15, crit: 5, price: 50, rarity: Rarity.COMMON, maxUses: 1 },
];

export const SKILL_TREE: Record<PlayerClass, Skill[]> = {
  'Warrior': [{ name: 'Power Slash', bonus: 20, description: 'Increases Damage' }, { name: 'Critical Master', bonus: 10, description: 'Increases Crit' }],
  'Mage': [{ name: 'Fireball', bonus: 30, description: 'High Burst Damage' }, { name: 'Mana Boost', bonus: 15, description: 'Bonus Damage from Mana' }],
  'Assassin': [{ name: 'Shadow Strike', bonus: 20, description: 'Quick Lethal Damage' }, { name: 'Stealth', bonus: 15, description: 'Critical Strike Chance' }],
  'None': []
};

export const MONSTERS_LOW: Monster[] = [
  { name: "🌑 Shadow Stalker", level: 5, hp: 80, damage: 8, xp: 10, drop: "🌑 Essence" },
  { name: "🦴 Bone Gnawer", level: 10, hp: 150, damage: 15, xp: 15, drop: "🦴 Bone" },
];

export const MONSTERS_MID: Monster[] = [
  { name: "🔥 Blazing Efreet", level: 30, hp: 1200, damage: 120, xp: 50, drop: "🔥 Flame" },
  { name: "❄️ Frost Gargoyle", level: 45, hp: 3000, damage: 300, xp: 80, drop: "❄️ Ice" },
];

export const MONSTERS_HIGH: Monster[] = [
  { name: "🌌 Abyss Walker", level: 80, hp: 18000, damage: 1800, xp: 200, drop: "🌌 Void" },
  { name: "🐉 Star Dragon", level: 250, hp: 300000, damage: 25000, xp: 1000, drop: "💎 Soul" },
];

export const BOSS_MONSTERS: Monster[] = [
  { name: "👑 MiMi, Chaos Goddess", level: 500, hp: 5000000, damage: 150000, xp: 100000, drop: "✨ Chaos Shard" },
];

export const MONSTERS: Monster[] = [...MONSTERS_LOW, ...MONSTERS_MID, ...MONSTERS_HIGH];
export const PETS: Pet[] = [{ name: "🐰 Forest Bunny", damage: 5, evolveLevel: 10 }];
export const DUNGEONS: Dungeon[] = [];
export const RANKS = [
  { name: "Bronze", min: 1 }, { name: "Silver", min: 20 }, { name: "Gold", min: 50 },
  { name: "Platinum", min: 100 }, { name: "Diamond", min: 250 }, { name: "Mythic", min: 500 },
  { name: "Legend", min: 1000 }, { name: "Immortal", min: 5000 },
];
export const GACHA_RATES = { [Rarity.COMMON]: 60, [Rarity.RARE]: 25, [Rarity.EPIC]: 10, [Rarity.LEGENDARY]: 4, [Rarity.MYTHIC]: 1 };
export const VIP_CONFIG = { bonusCoins: 1.5, bonusXp: 1.3, extraDaily: true };
