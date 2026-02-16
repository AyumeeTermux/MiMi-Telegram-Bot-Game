
import React, { useState, useEffect, useRef } from 'react';
import { Player, GameMessage, Item, Monster, PlayerClass } from './types';
import { INITIAL_ITEMS, MONSTERS, VIP_CONFIG } from './constants';
import { createNewPlayer, getPlayerTotalStats, handleLevelUp, rollGacha, checkRandomEvent } from './gameLogic';

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number; first_name?: string; username?: string };
    text?: string;
    from: { id: number; first_name: string; username?: string };
  };
}

const App: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [isBotStarted, setIsBotStarted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'console' | 'database' | 'players'>('console');
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [logs, setLogs] = useState<{ id: string; type: 'in' | 'out' | 'sys'; text: string; user: string; time: Date }[]>([]);
  const [offset, setOffset] = useState<number>(0);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  
  // Load players from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('mimi_players_db');
    if (saved) {
      try {
        setPlayers(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse players db", e);
      }
    }
  }, []);

  // Save players whenever they change
  useEffect(() => {
    localStorage.setItem('mimi_players_db', JSON.stringify(players));
  }, [players]);

  const addLog = (type: 'in' | 'out' | 'sys', text: string, user: string = "System") => {
    const newLog = { id: Math.random().toString(), type, text, user, time: new Date() };
    setLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100 logs
  };

  const sendMessage = async (chatId: number, text: string) => {
    try {
      await fetch(`${TELEGRAM_API_BASE}${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'Markdown' })
      });
      addLog('out', text, `Chat ID: ${chatId}`);
    } catch (error) {
      addLog('sys', `Error sending message: ${error}`);
    }
  };

  const processCommand = (chatId: number, username: string, text: string) => {
    const userId = chatId.toString();
    let player = players[userId];

    const cmd = text.toLowerCase().trim();
    const [command, ...args] = cmd.split(' ');
    const arg = args.join(' ');

    if (command === '/start') {
      if (!player) {
        // Simple class selection logic for real bot: 
        // In a real bot we'd send buttons (ReplyKeyboardMarkup), 
        // but for this implementation we'll auto-assign or wait for next cmd.
        const newP = createNewPlayer(username, 'Warrior');
        setPlayers(prev => ({ ...prev, [userId]: newP }));
        sendMessage(chatId, `🎮 *Selamat Datang di MiMi Games RPG!*\n\nKaraktermu telah dibuat sebagai *Warrior*.\n\n📜 *Daftar Perintah:*\n/profile - Cek status\n/hunt - Lawan monster\n/inv - Cek inventory\n/shop - Toko item\n/heal - Pulihkan HP\n/help - Bantuan lengkap`);
        return;
      } else {
        sendMessage(chatId, `Selamat datang kembali, *${player.username}*! Siap berpetualang lagi?`);
        return;
      }
    }

    if (!player) {
      sendMessage(chatId, "Ketik /start untuk memulai petualangan!");
      return;
    }

    // Clone player to update
    let up = { ...player };
    let responseText = "";

    if (command === '/profile' || command === '/me') {
      const stats = getPlayerTotalStats(up);
      responseText = `👤 *PROFILE: ${up.username}* [${up.playerClass}]\n\n` +
        `Level: ${up.level} (${up.xp}/${up.level * 100} XP)\n` +
        `Rank: 🏅 ${up.rank}\n` +
        `HP: ❤️ ${up.hp}/${stats.hp}\n` +
        `Coins: 💰 ${up.coins}\n` +
        `Damage: ⚔️ ${stats.damage}\n` +
        `Crit: 💥 ${stats.crit}%\n\n` +
        `Weapon: ${up.equippedWeapon || 'None'}\n` +
        `Armor: ${up.equippedArmor || 'None'}\n` +
        `Pet Active: ${up.activePet || 'None'}\n` +
        `VIP: ${up.vip ? '🌟 YES' : 'NO'}`;
    } else if (command === '/hunt') {
      const availableMonsters = MONSTERS.filter(m => m.level <= up.level + 2);
      const monster = availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
      const stats = getPlayerTotalStats(up);
      const turnsToKill = Math.ceil(monster.hp / stats.damage);
      const totalDamageTaken = turnsToKill * monster.damage;
      
      if (up.hp <= totalDamageTaken) {
        up.hp = 10;
        responseText = `💀 Kamu kalah melawan *${monster.name}*! HP-mu kritis, perlu istirahat. (/heal)`;
      } else {
        up.hp -= totalDamageTaken;
        let xpGain = monster.xp;
        let coinGain = Math.floor(monster.xp * 1.5);
        if (up.vip) {
          xpGain = Math.floor(xpGain * VIP_CONFIG.bonusXp);
          coinGain = Math.floor(coinGain * VIP_CONFIG.bonusCoins);
        }
        up.xp += xpGain;
        up.coins += coinGain;
        responseText = `⚔️ Bertarung melawan *${monster.name}*!\nKamu menang!\n💰 +${coinGain} Coins\n✨ +${xpGain} XP\n❤️ Sisa HP: ${up.hp}`;
        const lvlMsg = handleLevelUp(up);
        if (lvlMsg) responseText += `\n\n${lvlMsg}`;
        const eventMsg = checkRandomEvent(up);
        if (eventMsg) responseText += `\n\n⚠️ *EVENT:* ${eventMsg}`;
      }
    } else if (command === '/heal') {
      const stats = getPlayerTotalStats(up);
      if (up.hp >= stats.hp) {
        responseText = "❤️ HP kamu sudah penuh!";
      } else if (up.coins >= 50) {
        up.coins -= 50;
        up.hp = stats.hp;
        responseText = "🧪 Kamu meminum ramuan penyembuh! HP Penuh! (-50 Coins)";
      } else {
        responseText = "💰 Coins tidak cukup untuk membeli ramuan (Butuh 50)!";
      }
    } else if (command === '/inv' || command === '/inventory') {
      responseText = `🎒 *INVENTORY*\n\n${up.inventory.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}\n\n💡 Ketik \`/equip [nama]\` untuk memakai.`;
    } else if (command === '/shop') {
      responseText = `🛒 *SHOP*\n\n/buy_katana - 1200 💰\n/buy_spear - 2500 💰\n/buy_armor - 1800 💰\n/buy_gacha - 500 💰\n/buy_vip - 10000 💰`;
    } else if (command === '/help') {
      responseText = `📜 *COMMANDS MI-MI RPG*\n/profile - Cek status\n/hunt - Lawan monster\n/inv - Cek inventory\n/equip [nama] - Pakai item\n/shop - Toko item\n/heal - Pulihkan HP\n/buy_gacha - Gacha (500)\n/leaderboard - Papan peringkat`;
    } else if (command === '/leaderboard') {
      // Fix: Cast Object.values to Player[] to avoid unknown type errors
      const sorted = (Object.values(players) as Player[]).sort((a, b) => b.level - a.level).slice(0, 5);
      responseText = `🏆 *TOP 5 PLAYERS*\n\n` + sorted.map((p, i) => `${i+1}. ${p.username} - LV ${p.level}`).join('\n');
    } else {
      responseText = "❓ Command tidak dikenal. Ketik /help untuk bantuan.";
    }

    setPlayers(prev => ({ ...prev, [userId]: up }));
    sendMessage(chatId, responseText);
  };

  const pollUpdates = async () => {
    if (!token || isPolling) return;
    setIsPolling(true);
    try {
      const response = await fetch(`${TELEGRAM_API_BASE}${token}/getUpdates?offset=${offset}&timeout=30`);
      const data = await response.json();
      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          if (update.message && update.message.text) {
            addLog('in', update.message.text, update.message.from.first_name || "User");
            processCommand(update.message.chat.id, update.message.from.first_name || "Adventurer", update.message.text);
          }
          setOffset(update.update_id + 1);
        }
      }
    } catch (e) {
      addLog('sys', `Polling error: ${e}`);
    } finally {
      setIsPolling(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isBotStarted) {
      interval = setInterval(pollUpdates, 1000);
    }
    return () => clearInterval(interval);
  }, [isBotStarted, offset, token, isPolling, players]);

  if (!isBotStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-md w-full">
          <div className="text-center mb-8">
            <i className="fa-brands fa-telegram text-blue-500 text-6xl mb-4 animate-bounce"></i>
            <h1 className="text-2xl font-bold">MiMi Games RPG Bot</h1>
            <p className="text-slate-400 mt-2">Connect your real Telegram Bot Token</p>
          </div>
          <div className="space-y-4">
            <input 
              type="password" 
              placeholder="PASTE YOUR BOT TOKEN HERE"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button 
              onClick={() => {
                if(token.includes(":")) {
                   setIsBotStarted(true);
                   addLog('sys', "Bot engine started. Long polling active.");
                } else {
                   alert("Token format invalid. Should be 12345:ABC...");
                }
              }}
              disabled={!token}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-plug"></i> Connect & Start Server
            </button>
            <p className="text-[10px] text-slate-500 text-center">
              Create a bot at <a href="https://t.me/botfather" target="_blank" className="text-blue-400 underline">@BotFather</a> on Telegram to get a token.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-200">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="text-blue-500">MiMi</span> RPG <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">LIVE</span>
          </h2>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <button onClick={() => setActiveTab('console')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'console' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800'}`}>
            <i className="fa-solid fa-terminal text-sm"></i> Bot Console
          </button>
          <button onClick={() => setActiveTab('players')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'players' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800'}`}>
            <i className="fa-solid fa-users text-sm"></i> Active Players
          </button>
          <button onClick={() => setActiveTab('database')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'database' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800'}`}>
            <i className="fa-solid fa-database text-sm"></i> Export Data
          </button>
        </nav>
        <div className="p-4 bg-slate-800/30 m-3 rounded-2xl border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${isPolling ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-xs font-bold uppercase tracking-wider">{isPolling ? 'Polling' : 'Idle'}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">{token.split(':')[0]}:***</div>
          <button onClick={() => window.location.reload()} className="mt-3 w-full text-[10px] bg-slate-700 hover:bg-slate-600 py-1.5 rounded-lg transition">Disconnect Bot</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'console' && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <i className="fa-solid fa-list-ul text-blue-500"></i> Server Activity Logs
              </h3>
              <span className="text-xs text-slate-500">Showing last 100 events</span>
            </div>
            <div className="flex-1 bg-black border border-slate-800 rounded-2xl p-4 font-mono text-xs overflow-y-auto space-y-2">
              {logs.length === 0 && <div className="text-slate-700 italic">Waiting for incoming messages on Telegram...</div>}
              {logs.map(log => (
                <div key={log.id} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                  <span className="text-slate-600 shrink-0">[{log.time.toLocaleTimeString()}]</span>
                  <span className={`shrink-0 font-bold ${log.type === 'in' ? 'text-green-500' : log.type === 'out' ? 'text-blue-400' : 'text-amber-500'}`}>
                    {log.type === 'in' ? '⬅ RECV' : log.type === 'out' ? '➡ SEND' : '⚡ SYS'}
                  </span>
                  <span className="text-slate-400 shrink-0">@{log.user}:</span>
                  <span className="text-slate-300 break-words">{log.text}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-center gap-3">
              <i className="fa-solid fa-circle-info text-base"></i>
              <p>Bot is running! Open Telegram and search for your bot to start playing. Any command sent there will appear here in real-time.</p>
            </div>
          </div>
        )}

        {activeTab === 'players' && (
          <div className="p-8 overflow-y-auto">
             <h2 className="text-2xl font-bold mb-6">User Database ({Object.keys(players).length} Players)</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {/* Fix: Cast Object.values to Player[] to avoid unknown type errors */}
               {(Object.values(players) as Player[]).map(p => (
                 <div key={p.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl hover:border-blue-500/50 transition-all group">
                   <div className="flex justify-between items-start mb-3">
                     <div>
                       <h4 className="font-bold text-lg group-hover:text-blue-400 transition">{p.username}</h4>
                       <span className="text-[10px] text-slate-500 uppercase font-mono">Chat ID: {p.id}</span>
                     </div>
                     <span className="bg-blue-600/20 text-blue-400 text-[10px] px-2 py-1 rounded-full font-bold">LV {p.level}</span>
                   </div>
                   <div className="grid grid-cols-2 gap-2 text-xs">
                     <div className="bg-slate-800/50 p-2 rounded-lg">💰 {p.coins} Coins</div>
                     <div className="bg-slate-800/50 p-2 rounded-lg">🏅 {p.rank}</div>
                     <div className="bg-slate-800/50 p-2 rounded-lg col-span-2">⚔️ {p.equippedWeapon || 'No Weapon'}</div>
                   </div>
                 </div>
               ))}
               {Object.keys(players).length === 0 && (
                 <div className="col-span-full py-20 text-center text-slate-600 italic">No players registered yet. Message the bot to appear here.</div>
               )}
             </div>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="p-8 flex-1 flex flex-col overflow-hidden">
            <h2 className="text-2xl font-bold mb-4">Master Database Export</h2>
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-4">
                 <p className="text-sm text-slate-400 italic">JSON format compatible with most analytics tools.</p>
                 <button 
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(players, null, 2));
                    alert("Database copied to clipboard!");
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2"
                 >
                   <i className="fa-solid fa-copy"></i> Copy JSON
                 </button>
              </div>
              <textarea 
                readOnly 
                value={JSON.stringify(players, null, 2)} 
                className="flex-1 bg-black text-blue-400 font-mono text-xs p-4 rounded-xl focus:outline-none resize-none border border-slate-800 scrollbar-hide"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
