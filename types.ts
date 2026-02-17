
export enum Rarity {
  COMMON = 'Common',
  RARE = 'Rare',
  EPIC = 'Epic',
  LEGENDARY = 'Legendary',
  MYTHIC = 'Mythic'
}

export enum ItemCategory {
  WEAPON = 'Weapon',
  ARMOR = 'Armor',
  ACCESSORY = 'Accessory',
  POTION = 'Potion'
}

export type PlayerClass = 'Warrior' | 'Mage' | 'Assassin' | 'None';

export interface Skill {
  name: string;
  bonus: number;
  description: string;
}

export interface Item {
  name: string;
  category: ItemCategory;
  damage?: number;
  crit?: number;
  hp?: number;
  heal?: number;
  price: number;
  rarity: Rarity;
  durationHours?: number; // In hours (0 = infinite)
  maxUses?: number; // Number of uses (0 = infinite)
}

export interface ActiveItem {
  name: string;
  expiresAt?: number; // Timestamp
  remainingUses?: number;
}

export interface Monster {
  name: string;
  level: number;
  hp: number;
  damage: number;
  xp: number;
  drop: string;
}

export interface Pet {
  name: string;
  damage: number;
  evolveLevel: number;
  nextForm?: string;
}

export interface Dungeon {
  name: string;
  levelReq: number;
  boss: string;
  rewardXp: number;
}

export interface GuildData {
  name: string;
  level: number;
  xp: number;
  coins: number;
  territory: number;
  warPoints: number;
  currentRival?: string;
  rivalHp: number;
  maxRivalHp: number;
  lastWarDate: string;
}

export interface EventData {
  isActive: boolean;
  theme: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  xpMultiplier: number;
}

export interface Player {
  id: string;
  username: string;
  playerClass: PlayerClass;
  level: number;
  xp: number;
  coins: number;
  hp: number;
  maxHp: number;
  baseDamage: number;
  baseCrit: number;
  inventory: string[];
  activeItems: ActiveItem[];
  equippedWeapon?: string;
  equippedArmor?: string;
  equippedAccessory?: string;
  pets: string[];
  activePet?: string;
  guild: string;
  rank: string;
  vip: boolean;
  dailyClaimed: boolean;
  dailyDate: string;
  registerDate: string;
  dungeonsCleared: number;
  warAttacks: number;
}

export interface GlobalState {
  players: Record<string, Player>;
  guilds: Record<string, GuildData>;
  activeEvent?: EventData;
  metadata: {
    lastOffset: number;
    serverStartTime: string;
    totalCommandsProcessed: number;
  };
}
