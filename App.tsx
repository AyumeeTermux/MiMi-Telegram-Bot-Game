import React, { useState, useEffect, useRef } from 'react';
import { Player, Item, Monster, PlayerClass, Rarity, ItemCategory, GlobalState, ActiveItem, EventData } from './types';
import { INITIAL_ITEMS, MONSTERS_LOW, MONSTERS_MID, MONSTERS_HIGH, BOSS_MONSTERS } from './constants';
import { createNewPlayer, getPlayerTotalStats, handleLevelUp } from './gameLogic';

// --- CONFIGURATION ---
const TELEGRAM_API_BASE = "https://api.telegram.org/bot";
const CORS_PROXY = "https://corsproxy.io/?"; 

const DEFAULT_TOKEN = "8444920948:AAFnK4FWUo1xwNv_xdCqdI8GQZ-Oj824dXU"; 
const CLOUD_BUCKET_ID = "TiH4ZUwVtMisykR1sUVwdU";
const CLOUD_API_URL = `https://kvdb.io/${CLOUD_BUCKET_ID}/global_state`;

const OFFICIAL_CHANNEL = "-1003755267859"; 
const GROUP_CHAT_ID = -1003750633888; 
const OFFICIAL_GROUP_LINK = "https://t.me/+fb10AiZUKo02MzA1";

const GUILD_MARKET = [
  { name: "👑 OLYMPUS LORDS", price: 100000, topic: 15, link: "https://t.me/c/3750633888/15", msg: "Selamat bergabung di 👑 OLYMPUS LORDS! Kekuasaan langit kini bersamamu.", rewards: ["🌟 Celestial Blade", "✨ Divine Armor"] },
  { name: "⚔️ VALKYRIE ELITE", price: 80000, topic: 16, link: "https://t.me/c/3750633888/16", msg: "Selamat bergabung di ⚔️ VALKYRIE ELITE! Pedangmu akan menjadi legenda.", rewards: ["💀 Soul Reaper", "🐲 Dragon Scale"] },
  { name: "🌌 VOID SPECTRES", price: 50000, topic: 17, link: "https://t.me/c/3750633888/17", msg: "Selamat bergabung di 🌌 VOID SPECTRES! Kegelapan tunduk padamu.", rewards: ["⚡ Thunder Spear", "👑 Royal Guard"] },
  { name: "🔥 PHOENIX ORDER", price: 20000, topic: 20, link: "https://t.me/c/3750633888/20", msg: "Selamat bergabung di 🔥 PHOENIX ORDER! Bangkitlah dari abu kejayaan.", rewards: ["🔥 Flame Katana"] },
  { name: "🍃 FOREST RANGERS", price: 7000, topic: 21, link: "https://t.me/c/3750633888/21", msg: "Selamat bergabung di 🍃 FOREST RANGERS! Alam melindungimu.", rewards: ["🪵 Wood Sword", "💍 Ring of Luck"] }
];

// Silent audio loop to keep browser tab active (Anti-Sleep)
const SILENT_AUDIO = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTSVMAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMD//////////////////////////////////////////////////////////////////wAAAAA=";

export const App: React.FC = () => {
  // State
  const [token, setToken] = useState<string>(() => localStorage.getItem("MIMI_BOT_TOKEN") || DEFAULT_TOKEN);
  const [isBotRunning, setIsBotRunning] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'server' | 'players'>('server');
  const [logs, setLogs] = useState<{ id: string; type: 'in' | 'out' | 'sys' | 'err'; text: string; user: string; time: Date }[]>([]);
  const [uptime, setUptime] = useState<string>("00:00:00");
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Database State
  const [globalState, setGlobalState] = useState<GlobalState>({
    players: {}, guilds: {}, metadata: { lastOffset: 0, serverStartTime: new Date().toISOString(), totalCommandsProcessed: 0 }
  });

  // Refs for "Real-time" access inside intervals without dependency issues
  const stateRef = useRef<GlobalState>(globalState);
  const offsetRef = useRef<number>(0);
  const isPollingRef = useRef<boolean>(false);
  const processedUpdates = useRef<Set<number>>(new Set());
  const audioRef = useRef<HTMLAudioElement>(null);

  // Auto scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  // --- KEYBOARD GENERATORS ---
  const getMainKeyboard = (isEventActive: boolean | undefined) => {
    const baseKeyboard = [
      [{ text: "👤 Profile" }, { text: "⚔️ Hunt" }],
      [{ text: "🏰 Guild" }, { text: "⚔️ Battle" }],
      [{ text: "🛒 Shop" }, { text: "🎒 Inventory" }],
      [{ text: "🏆 Top" }, { text: "👥 Online Players" }],
      [{ text: "🎀 Donasi" }]
    ];
    if (isEventActive) {
      return { keyboard: [[{ text: "🌟 JOIN EVENT SEKARANG! 🌟" }], ...baseKeyboard], resize_keyboard: true };
    }
    return { keyboard: baseKeyboard, resize_keyboard: true };
  };

  const KEYBOARD_HUNT = { keyboard: [[{ text: "🟢 Rendah (Lv 1-20)" }], [{ text: "🟡 Sedang (Lv 21-50)" }], [{ text: "🔴 Tinggi (Lv 51+)" }], [{ text: "🔙 Kembali" }]], resize_keyboard: true };
  const KEYBOARD_BATTLE = { keyboard: [[{ text: "🔥 PvP Players" }], [{ text: "🐲 Boss Monster" }], [{ text: "🔙 Kembali" }]], resize_keyboard: true };
  const KEYBOARD_SHOP = { keyboard: [[{ text: "🔱 Spear of Eternity (100k)" }, { text: "🐉 Emperor Plate (75k)" }], [{ text: "⚡ Void Dagger (50k)" }, { text: "🔥 Phoenix Amulet (25k)" }], [{ text: "❄️ Frost Shield (10k)" }, { text: "🩸 Warrior Band (5k)" }], [{ text: "🧪 Power Elixir (2k)" }, { text: "🪵 Wood Staff (500)" }], [{ text: "🩹 Small Bandage (200)" }, { text: "🦴 Rusty Dagger (50)" }], [{ text: "🔙 Kembali" }]], resize_keyboard: true };

  // --- INITIALIZATION ---
  useEffect(() => {
    if (Object.keys(globalState.players).length > 0 && Object.keys(stateRef.current.players).length === 0) {
         stateRef.current = globalState; 
    }
    if (offsetRef.current === 0) offsetRef.current = globalState.metadata.lastOffset;
  }, [globalState]);

  // --- STARTUP LOGIC ---
  const startServer = async () => {
    if (!token) {
        alert("Masukkan Token Bot terlebih dahulu!");
        return;
    }
    setIsConnecting(true);

    // 1. Force Audio Play
    if (audioRef.current) {
        audioRef.current.volume = 0.01;
        audioRef.current.play().catch(e => console.log("Audio autoplay restricted, will try again after user gesture"));
    }

    // 2. Test Connection
    try {
        const targetUrl = `${TELEGRAM_API_BASE}${token}/getMe`;
        // Bypass cache
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}&_t=${Date.now()}`;
        
        const res = await fetch(proxyUrl);
        const data = await res.json();
        
        if (data.ok) {
            setIsBotRunning(true);
            setTimeout(() => addLog('sys', `✅ Bot Started: @${data.result.username}`), 500);
            syncWithCloud();
        } else {
            alert(`Koneksi Ditolak Telegram.\n\nPesan: ${data.description}\n\nPastikan Token Bot anda benar.`);
        }
    } catch (e) {
        alert("Gagal terhubung ke Proxy Server.\n\nCek koneksi internet anda atau coba refresh halaman.");
        console.error(e);
    } finally {
        setIsConnecting(false);
    }
  };

  // --- KEEP AWAKE LOGIC (PENTING) ---
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          addLog('sys', '✅ Layar dikunci agar tidak mati (WakeLock Active)');
        } catch (err) { }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isBotRunning) {
        requestWakeLock();
      }
    };

    if (isBotRunning) {
      requestWakeLock();
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => { 
      if (wakeLock) wakeLock.release(); 
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isBotRunning]);

  // --- GAME LOOP & AUTO SAVE ---
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isBotRunning) return;
      
      const currentState = { ...stateRef.current };
      let changed = false;
      const now = Date.now();

      // Uptime Logic
      const start = new Date(currentState.metadata.serverStartTime).getTime();
      const diff = now - start;
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setUptime(`${h}:${m}:${s}`);

      // Event Logic
      const isEventActive = currentState.activeEvent?.isActive && new Date(currentState.activeEvent.endTime).getTime() > now;

      // Item Expiry Check
      for (const uid in currentState.players) {
        const p = currentState.players[uid];
        const expired = p.activeItems.filter(ai => ai.expiresAt && ai.expiresAt <= now);
        if (expired.length > 0) {
          p.activeItems = p.activeItems.filter(ai => !ai.expiresAt || ai.expiresAt > now);
          changed = true;
          expired.forEach(ex => {
            const msg = `⚠️ *ITEM EXPIRED*\n\nMasa berlaku *${ex.name}* telah habis. Kekuatan kembali normal.`;
            sendMessage(uid, "EXPIRED", msg, getMainKeyboard(isEventActive));
          });
        }
      }
      
      // Random Global Event Generator
      if (!isEventActive && Math.random() < 0.02) { 
        const duration = 10 * 60 * 1000;
        currentState.activeEvent = {
          isActive: true, theme: "BERKAH MIMI (XP BOOST 65%)",
          startTime: new Date().toISOString(), endTime: new Date(now + duration).toISOString(),
          xpMultiplier: 1.65
        };
        changed = true;
        const msg = `🚨 *GLOBAL EVENT STARTED*\n\nEvent: *${currentState.activeEvent.theme}*\nDurasi: 10 Menit\nEffect: XP +65%\n\n🔥 BURUAN HUNTING!`;
        await sendMessage(OFFICIAL_CHANNEL, "EVENT", msg, null);
        await sendMessage(GROUP_CHAT_ID, "EVENT", msg, null);
      } else if (currentState.activeEvent?.isActive && !isEventActive) {
        currentState.activeEvent.isActive = false;
        changed = true;
        await sendMessage(GROUP_CHAT_ID, "EVENT", "🛑 *EVENT SELESAI*", null);
      }
      
      if (changed) {
        stateRef.current = currentState;
        setGlobalState(currentState);
        await syncWithCloud(currentState);
      }
    }, 5000); 
    return () => clearInterval(interval);
  }, [isBotRunning]);

  // --- HELPERS ---
  const addLog = (type: 'in' | 'out' | 'sys' | 'err', text: string, user: string = "System") => {
    setLogs(prev => {
      const newLogs = [...prev, { id: Math.random().toString(), type, text, user, time: new Date() }];
      return newLogs.slice(-100); 
    });
  };

  const syncWithCloud = async (newState?: GlobalState) => {
    try {
      const options: RequestInit = newState ? { method: 'POST', body: JSON.stringify(newState) } : { method: 'GET' };
      const res = await fetch(CLOUD_API_URL, options);
      if (res.ok && !newState) {
         const data = await res.json();
         if (data?.players) {
             setGlobalState(data);
             stateRef.current = data;
             addLog('sys', '☁️ Data Downloaded from Cloud');
         }
      }
    } catch (e) { }
  };

  const sendMessage = async (chatId: number | string, title: string, content: string, keyboard: any, threadId?: number) => {
    if (!token) return;
    const text = content.startsWith('┏') || content.startsWith('🚨') || content.startsWith('⚠️') ? content : `┏━━━━━━━━━━━━━━━━━━━━┓\n┃ .${title.toUpperCase()}\n┣━━━━━━━━━━━━━━━━━━━━┫\n${content}\n┗━━━━━━━━━━━━━━━━━━━━┛`;
    
    const payload: any = { chat_id: chatId, text, parse_mode: 'Markdown' };
    if (keyboard) payload.reply_markup = keyboard;
    if (threadId) payload.message_thread_id = threadId;

    try {
      const targetUrl = `${TELEGRAM_API_BASE}${token}/sendMessage`;
      const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
      
      const res = await fetch(proxyUrl, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.ok) addLog('out', title, `ID:${chatId}`);
      else addLog('err', data.description || "Telegram Error", `ID:${chatId}`);
    } catch (e) { 
      addLog('err', "Gagal kirim (Cek Koneksi)", (e as Error).message); 
    }
  };

  const escapeMd = (str: string) => str.replace(/[_*[`]/g, '\\$&');

  // --- COMMAND PROCESSOR ---
  const processCommand = async (chatId: number, first_name: string, text: string, threadId?: number, senderId?: string, rawUsername?: string) => {
    const currentState = { ...stateRef.current }; 
    const uid = senderId || chatId.toString();
    const safeFirstName = escapeMd(first_name);
    const mention = rawUsername ? `@${escapeMd(rawUsername)}` : safeFirstName;
    
    if (!currentState.players[uid]) currentState.players[uid] = createNewPlayer(safeFirstName, 'Warrior');
    let p = currentState.players[uid];
    
    const isGod = rawUsername?.toLowerCase() === 'haiyumee';
    if (isGod) { p.level = 9999; p.coins = 9999999; p.vip = true; p.rank = "GOD"; }

    const cmd = text.trim();
    const say = (t: string, c: string, k: any) => sendMessage(chatId, t, c, k, threadId);
    
    const isEventActive = currentState.activeEvent?.isActive && new Date(currentState.activeEvent.endTime).getTime() > Date.now();
    const currentMainKeyboard = getMainKeyboard(isEventActive);

    // --- LOGIC MAP ---
    if (cmd === "/start" || cmd === "🔙 Kembali") {
      say("DASHBOARD", `👋 Halo ${mention}!\n\n🏰 *MIMI RPG CENTRAL*\n💰 Gold: ${p.coins.toLocaleString()}\n🛡️ Rank: ${p.rank}\n\n👇 Pilih menu dibawah:`, currentMainKeyboard);
    } 
    else if (cmd === "🌟 JOIN EVENT SEKARANG! 🌟") {
       if (isEventActive) say("EVENT ZONE", "🔥 *EVENT BOOST AKTIF*\nXP Hunt +65%!", KEYBOARD_HUNT);
       else say("INFO", "Event sudah berakhir.", currentMainKeyboard);
    }
    else if (cmd === "👤 Profile") {
      const s = getPlayerTotalStats(p);
      const xpNeeded = p.level * 100;
      const wpn = p.activeItems.find(ai => INITIAL_ITEMS.find(ii => ii.name === ai.name)?.category === ItemCategory.WEAPON)?.name || "-";
      say("STATUS", `👤 ${mention} (Lv ${p.level})\n\n❤️ HP: ${p.hp}/${s.hp}\n⚔️ ATK: ${s.damage}\n✨ XP: ${p.xp}/${xpNeeded}\n💰 Gold: ${p.coins.toLocaleString()}\n🤺 Class: ${p.playerClass}\n🔫 Wpn: ${wpn}`, currentMainKeyboard);
    }
    else if (cmd === "🛒 Shop") say("MARKET", "Pilih barang:", KEYBOARD_SHOP);
    else if (cmd === "⚔️ Hunt") say("HUNTING GROUND", "Pilih level monster:", KEYBOARD_HUNT);
    else if (["🟢","🟡","🔴"].some(x => cmd.startsWith(x))) {
       let mList = MONSTERS_LOW, xpBase = 0.1, coinBase = 50;
       if (cmd.startsWith("🟡")) { 
         if (p.level < 21 && !isGod) return say("ALERT", "Minimal Level 21!", KEYBOARD_HUNT); 
         mList = MONSTERS_MID; xpBase = 0.05; coinBase = 300; 
       }
       if (cmd.startsWith("🔴")) { 
         if (p.level < 51 && !isGod) return say("ALERT", "Minimal Level 51!", KEYBOARD_HUNT); 
         mList = MONSTERS_HIGH; xpBase = 0.02; coinBase = 1000; 
       }
       
       const mob = mList[Math.floor(Math.random()*mList.length)];
       let xpGain = Math.ceil((p.level * 100) * xpBase);
       let coinGain = coinBase + Math.floor(Math.random() * coinBase);
       if (isEventActive) xpGain = Math.ceil(xpGain * 1.65);

       p.xp += xpGain; p.coins += coinGain;
       p.activeItems = p.activeItems.filter(ai => {
         if (ai.remainingUses) { ai.remainingUses--; return ai.remainingUses > 0; }
         return true;
       });

       let msg = `⚔️ Menang vs *${mob.name}*\n\n✨ XP +${xpGain}\n💰 Gold +${coinGain}`;
       const lvlUp = handleLevelUp(p);
       if(lvlUp) msg += `\n\n${lvlUp}`;
       say("RESULT", msg, KEYBOARD_HUNT);
    }
    else if (cmd === "🎒 Inventory") {
      const invList = p.inventory.length ? p.inventory.map(i => `▫️ ${i}`).join('\n') : "(Kosong)";
      const activeList = p.activeItems.length ? p.activeItems.map(ai => `✨ ${ai.name}`).join('\n') : "(Tidak ada)";
      const invKbd = [...new Set(p.inventory)].map(i => [{text: `Gunakan: ${i}`}]);
      say("TAS", `🎒 *Inventory:*\n${invList}\n\n🔥 *Sedang Dipakai:*\n${activeList}`, {keyboard: [...invKbd, [{text:"🔙 Kembali"}]], resize_keyboard:true});
    }
    else if (cmd.startsWith("Gunakan: ")) {
       const iName = cmd.replace("Gunakan: ", "");
       const item = INITIAL_ITEMS.find(i => i.name === iName);
       if (item) {
         const idx = p.inventory.indexOf(iName);
         if (idx > -1) {
           p.inventory.splice(idx, 1);
           const newItem: ActiveItem = { name: iName };
           if (item.durationHours) newItem.expiresAt = Date.now() + (item.durationHours * 3600000);
           if (item.maxUses) newItem.remainingUses = item.maxUses;
           p.activeItems.push(newItem);
           say("EQUIP", `✅ Menggunakan ${iName}`, currentMainKeyboard);
         }
       }
    }
    else if (cmd.includes("(") && cmd.includes(")")) {
       const isGuild = GUILD_MARKET.find(g => cmd.includes(g.name));
       const isItem = INITIAL_ITEMS.find(i => cmd.includes(i.name));
       
       if (isItem) {
          if (p.coins >= isItem.price) {
             p.coins -= isItem.price; p.inventory.push(isItem.name);
             say("SUKSES", `Membeli ${isItem.name}`, KEYBOARD_SHOP);
          } else say("GAGAL", "Gold kurang!", KEYBOARD_SHOP);
       }
       else if (isGuild) {
          if (p.coins >= isGuild.price) {
             p.coins -= isGuild.price; p.guild = isGuild.name; p.inventory.push(...isGuild.rewards);
             say("WELCOME", `Selamat datang di ${isGuild.name}`, currentMainKeyboard);
             if (isGuild.topic) sendMessage(GROUP_CHAT_ID, "RECRUIT", `${mention} joined ${isGuild.name}!`, null, isGuild.topic);
          } else say("GAGAL", "Gold kurang!", currentMainKeyboard);
       }
    }
    else if (cmd === "🏰 Guild") {
      if (p.guild) say("INFO", `Guild: *${p.guild}*`, {keyboard:[[{text:"🚪 Keluar"}],[{text:"🔙 Kembali"}]], resize_keyboard:true});
      else {
        const rows = GUILD_MARKET.map(g => [{text: `${g.name} (${g.price/1000}k)`}]);
        say("GUILD HALL", "Pilih Guild:", {keyboard:[...rows, [{text:"🔙 Kembali"}]], resize_keyboard:true});
      }
    }
    else if (cmd === "🚪 Keluar") {
      p.guild = ""; say("OUT", "Anda keluar dari guild.", currentMainKeyboard);
    }
    else if (cmd === "🏆 Top") {
       const top = (Object.values(currentState.players) as Player[]).sort((a,b) => b.level - a.level).slice(0,10);
       const txt = top.map((x,i) => `${i+1}. ${x.username} (Lv${x.level})`).join('\n');
       say("LEADERBOARD", txt, currentMainKeyboard);
    }
    else if (cmd === "👥 Online Players") {
       say("COMMUNITY", `Join Group Official:\n${OFFICIAL_GROUP_LINK}`, currentMainKeyboard);
    }
    else if (cmd === "🎀 Donasi") {
       say("DONASI", "Saweria / Trakteer Admin:\n[KLIK DISINI](https://t.me/MiMi_RPG_Gamess/5)", currentMainKeyboard);
    }

    currentState.metadata.totalCommandsProcessed++;
    stateRef.current = currentState; 
    setGlobalState(currentState);    
    await syncWithCloud(currentState); 
  };

  // --- POLLING ENGINE ---
  useEffect(() => {
    const poll = async () => {
      if (isPollingRef.current || !isBotRunning || !token) return;
      isPollingRef.current = true;
      try {
        const targetUrl = `${TELEGRAM_API_BASE}${token}/getUpdates?offset=${offsetRef.current}&timeout=0`;
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
        
        const res = await fetch(proxyUrl); 
        const data = await res.json();
        
        if (data.ok) {
          for (const update of data.result) {
             if (processedUpdates.current.has(update.update_id)) continue;
             processedUpdates.current.add(update.update_id);
             offsetRef.current = update.update_id + 1;
             
             const msg = update.message;
             if (msg?.text) {
               await processCommand(msg.chat.id, msg.from.first_name || "User", msg.text, msg.message_thread_id, msg.from.id.toString(), msg.from.username);
               addLog('in', msg.text, msg.from.first_name);
             }
          }
        } else if (data.error_code === 409) {
           addLog('err', "Conflict: Bot dijalankan di tempat lain");
        }
      } catch (e) { } finally {
        isPollingRef.current = false;
      }
    };

    const t = setInterval(poll, 2000); 
    return () => clearInterval(t);
  }, [isBotRunning, token]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-mono overflow-hidden">
      <audio ref={audioRef} src={SILENT_AUDIO} loop />
      
      {/* HEADER */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between shadow-lg z-10 shrink-0">
        <div className="flex items-center gap-3">
           <div className="ring-container">
             <div className={`${isBotRunning ? 'ringring' : ''}`}></div>
             <div className="circle" style={{backgroundColor: isBotRunning ? '#10b981' : '#ef4444'}}></div>
           </div>
           <div className="ml-4">
             <h1 className="font-bold tracking-widest text-lg bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent italic">MIMI RPG <span className="text-slate-600 text-xs not-italic">WEB SERVER</span></h1>
             <div className="text-[10px] text-slate-400">{isBotRunning ? '● SERVER ONLINE - JANGAN TUTUP TAB' : '● SERVER OFFLINE'}</div>
           </div>
        </div>
        <div className="text-xs text-slate-500 hidden md:block text-right">
           <div>UPTIME</div>
           <span className="text-emerald-400 font-bold text-lg">{uptime}</span>
        </div>
      </div>

      {/* MAIN CONTENT */}
      {!isBotRunning ? (
        <div className="flex-1 overflow-y-auto bg-[url('https://cdn.pixabay.com/photo/2016/11/29/05/45/astronomy-1867616_960_720.jpg')] bg-cover bg-center relative">
          <div className="min-h-full flex flex-col items-center justify-center p-6 relative">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"></div>
            <div className="relative z-10 w-full max-w-md space-y-6">
                <div className="w-20 h-20 bg-indigo-500/20 rounded-2xl mx-auto flex items-center justify-center border border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.3)] mb-4 animate-bounce">
                <i className="fa-solid fa-server text-4xl text-indigo-400"></i>
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white">SERVER INITIALIZATION</h2>
                    <p className="text-slate-400 text-sm mt-2">Masukkan Token Bot Telegram anda untuk memulai server.</p>
                </div>
                
                <div className="space-y-4">
                    <input 
                    type="text" 
                    value={token}
                    onChange={e => { setToken(e.target.value); localStorage.setItem("MIMI_BOT_TOKEN", e.target.value); }}
                    placeholder="123456789:AAH... (Token Bot)"
                    className="w-full bg-black/50 border border-slate-700 rounded-xl px-4 py-3 text-center text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    
                    <button 
                    onClick={startServer}
                    disabled={isConnecting}
                    className={`w-full py-4 rounded-xl font-bold tracking-widest transition-all text-white shadow-lg ${isConnecting ? 'bg-slate-700 cursor-wait' : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 hover:shadow-indigo-500/25'}`}
                    >
                    {isConnecting ? 'CONNECTING...' : 'START SERVER'}
                    </button>
                </div>

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-[10px] text-yellow-200 text-left">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                <b>PENTING:</b> Biarkan tab ini tetap terbuka agar bot tetap hidup. Jika anda menutup tab atau HP mati, bot akan berhenti.
                </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* SIDEBAR */}
          <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex shrink-0">
             <div className="p-4 space-y-2">
               <button onClick={() => setActiveTab('server')} className={`w-full text-left px-4 py-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'server' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}>SERVER LOGS</button>
               <button onClick={() => setActiveTab('players')} className={`w-full text-left px-4 py-3 rounded-lg text-xs font-bold transition-all ${activeTab === 'players' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}>PLAYER DATABASE</button>
             </div>
             <div className="mt-auto p-4 border-t border-slate-800">
               <div className="text-[10px] text-slate-500 mb-1">COMMANDS PROCESSED</div>
               <div className="text-2xl font-bold text-white">{globalState.metadata.totalCommandsProcessed}</div>
               <button onClick={() => setIsBotRunning(false)} className="mt-4 w-full border border-red-500/30 text-red-500 hover:bg-red-500/10 py-2 rounded text-xs font-bold">SHUTDOWN</button>
             </div>
          </div>

          {/* DASHBOARD */}
          <div className="flex-1 bg-slate-950 p-4 overflow-y-auto">
             {/* TOP WIDGETS */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                   <div className="text-[10px] text-slate-500 uppercase">Active Event</div>
                   <div className={`text-sm font-bold truncate ${globalState.activeEvent?.isActive ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`}>
                      {globalState.activeEvent?.isActive ? globalState.activeEvent.theme : 'None'}
                   </div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                   <div className="text-[10px] text-slate-500 uppercase">Total Players</div>
                   <div className="text-sm font-bold text-indigo-400">{Object.keys(globalState.players).length}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 md:hidden">
                   <div className="text-[10px] text-slate-500 uppercase">Uptime</div>
                   <div className="text-sm font-bold text-emerald-400">{uptime}</div>
                </div>
                <button onClick={() => setIsBotRunning(false)} className="bg-red-900/20 border border-red-900/50 text-red-500 p-4 rounded-xl font-bold text-xs md:hidden">STOP</button>
             </div>

             {/* LOGS VIEW */}
             {activeTab === 'server' && (
               <div className="space-y-2 font-mono text-xs pb-10">
                 {logs.map(log => (
                   <div key={log.id} className="flex gap-2 border-b border-slate-800/50 pb-1 items-start">
                     <span className="text-slate-600 w-16 shrink-0">[{log.time.toLocaleTimeString([], {hour12:false})}]</span>
                     <span className={`w-8 font-bold shrink-0 ${log.type === 'in' ? 'text-emerald-500' : log.type === 'out' ? 'text-indigo-500' : log.type === 'err' ? 'text-red-500' : 'text-yellow-500'}`}>{log.type.toUpperCase()}</span>
                     <span className="text-slate-400 shrink-0 max-w-[80px] truncate">@{log.user}:</span>
                     <span className="text-slate-300 break-words flex-1">{log.text}</span>
                   </div>
                 ))}
                 <div ref={logsEndRef} />
                 {logs.length === 0 && <div className="text-center text-slate-700 py-10 animate-pulse">Waiting for commands...</div>}
               </div>
             )}

             {/* PLAYER DB VIEW */}
             {activeTab === 'players' && (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                 {(Object.values(globalState.players) as Player[]).sort((a,b) => b.level - a.level).map(p => (
                   <div key={p.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center group hover:border-indigo-500/50 transition-colors">
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                           {p.username}
                           {p.vip && <span className="bg-amber-500/20 text-amber-500 text-[9px] px-1 rounded">VIP</span>}
                        </div>
                        <div className="text-[10px] text-slate-500">Lv {p.level} • {p.playerClass}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-400 font-bold text-xs">{p.coins.toLocaleString()} G</div>
                        <div className="text-[9px] text-slate-600">{p.rank}</div>
                      </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};