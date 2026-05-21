const { app, BrowserWindow, ipcMain, dialog, net, session, shell } = require('electron');
app.setName('cngm');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const fs = require('fs');
const { exec, execFile, spawn } = require('child_process');

const https = require('https');

// Embedded SVG icons for the menu installer
const CNGM_SVG_B64 = 'PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPCEtLSBCYXNlIEJhY2tncm91bmQgLS0+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMTIiIGZpbGw9IiMyQzFFMTYiLz4KICAKICA8IS0tIE91dGVyIENvbm5lY3RvcnMgLS0+CiAgPHBhdGggZD0iTSAyNCAyNTYgSCAxMTYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0Q0QTM3MyIgc3Ryb2tlLXdpZHRoPSIxMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPGNpcmNsZSBjeD0iNzAiIGN5PSIyNTYiIHI9IjgiIGZpbGw9IiNENEEzNzMiLz4KICA8cGF0aCBkPSJNIDM5NiAyNTYgSCA0ODgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0Q0QTM3MyIgc3Ryb2tlLXdpZHRoPSIxMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPGNpcmNsZSBjeD0iNDQyIiBjeT0iMjU2IiByPSI4IiBmaWxsPSIjRDRBMzczIi8+CgogIDwhLS0gVGhlIFBpbGwgQmVhbiBCb2R5IC0tPgogIDxyZWN0IHg9IjExNiIgeT0iODAiIHdpZHRoPSIyODAiIGhlaWdodD0iMzUyIiByeD0iMTQwIiBmaWxsPSIjNDMyODE4IiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMjAiLz4KCiAgPCEtLSBUaGUgUy1DcmFjayBFcmFzZXIgKFNwbGl0cyB0aGUgYmVhbiB1c2luZyBiYWNrZ3JvdW5kIGNvbG9yKSAtLT4KICA8cGF0aCBkPSJNIDI1NiAyNCBWIDEzNiBMIDIxNiAxNzYgViAyMTYgTCAyOTYgMjk2IFYgMzM2IEwgMjU2IDM3NiBWIDQ4OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMkMxRTE2IiBzdHJva2Utd2lkdGg9IjI4IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CgogIDwhLS0gVGhlIEdsb3dpbmcgUy1DcmFjayBDaXJjdWl0IFRyYWNlIC0tPgogIDxwYXRoIGQ9Ik0gMjU2IDI0IFYgMTM2IEwgMjE2IDE3NiBWIDIxNiBMIDI5NiAyOTYgViAzMzYgTCAyNTYgMzc2IFYgNDg4IiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkU2QTciIHN0cm9rZS13aWR0aD0iOCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgoKICA8IS0tIENpcmN1aXQgTm9kZXMgYWxvbmcgdGhlIHRyYWNlIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjEzNiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjIxNiIgY3k9IjE3NiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjIxNiIgY3k9IjIxNiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMTIiIGZpbGw9IiNGRkU2QTciLz4gPCEtLSBDb3JlIENlbnRlciBOb2RlIC0tPgogIDxjaXJjbGUgY3g9IjI5NiIgY3k9IjI5NiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjI5NiIgY3k9IjMzNiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjM3NiIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgoKICA8IS0tIEdvbGRlbiBPdXRlciBCb3JkZXIgKERyYXduIGxhc3QgdG8gb3ZlcmxheSBwZXJmZWN0bHkpIC0tPgogIDxyZWN0IHg9IjI0IiB5PSIyNCIgd2lkdGg9IjQ2NCIgaGVpZ2h0PSI0NjQiIHJ4PSI4OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOEI1QTJCIiBzdHJva2Utd2lkdGg9IjEyIi8+Cjwvc3ZnPgo=';
const GRINDER_SVG_B64 = 'PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMTIiIGZpbGw9IiMyQzFFMTYiLz4KICAKICA8Y2lyY2xlIGN4PSIyNTYiIGN5PSI2NCIgcj0iOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjkyIiByPSI4IiBmaWxsPSIjRkZFNkE3Ii8+CgogIDxwYXRoIGQ9Ik0gMTM2IDEyNCBMIDM3NiAxMjQgTCAzMjYgMjEwIEwgMTg2IDIxMCBaIiBmaWxsPSIjNDMyODE4IiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMTYiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICAKICA8cmVjdCB4PSIxNjYiIHk9IjIxMCIgd2lkdGg9IjE4MCIgaGVpZ2h0PSIxODAiIHJ4PSIzMiIgZmlsbD0iIzQzMjgxOCIgc3Ryb2tlPSIjRDRBMzczIiBzdHJva2Utd2lkdGg9IjE2Ii8+CgogIDxwYXRoIGQ9Ik0gMjE2IDI2MCBIIDI5NiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZFNkE3IiBzdHJva2Utd2lkdGg9IjEyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8cGF0aCBkPSJNIDIxNiAzMDAgSCAyOTYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRTZBNyIgc3Ryb2tlLXdpZHRoPSIxMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTSAyMTYgMzQwIEggMjk2IiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkU2QTciIHN0cm9rZS13aWR0aD0iMTIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgoKICA8cGF0aCBkPSJNIDIwNiAzOTAgViA0MzAgQyAyMDYgNDQxIDIxNSA0NTAgMjI2IDQ1MCBIIDI4NiBDIDI5NyA0NTAgMzA2IDQ0MSAzMDYgNDMwIFYgMzkwIiBmaWxsPSIjNDMyODE4IiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMTYiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KCiAgPHBhdGggZD0iTSAzNDYgMjcwIEggNDIwIiBmaWxsPSJub25lIiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMTYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIAogIDxjaXJjbGUgY3g9IjM0NiIgY3k9IjI3MCIgcj0iNiIgZmlsbD0iI0ZGRTZBNyIvPgoKICA8Y2lyY2xlIGN4PSI0MzYiIGN5PSIyNzAiIHI9IjE2IiBmaWxsPSIjRkZFNkE3Ii8+CgogIDxyZWN0IHg9IjI0IiB5PSIyNCIgd2lkdGg9IjQ2NCIgaGVpZ2h0PSI0NjQiIHJ4PSI4OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOEI1QTJCIiBzdHJva2Utd2lkdGg9IjEyIi8+Cjwvc3ZnPgo=';
const CREMA_SVG_B64 = 'PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPCEtLSBCYXNlIEJhY2tncm91bmQgLS0+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMTIiIGZpbGw9IiMyQzFFMTYiLz4KICAKICA8IS0tIEdvbGRlbiBJbm5lciBCb3JkZXIgLS0+CiAgPHJlY3QgeD0iMjQiIHk9IjI0IiB3aWR0aD0iNDY0IiBoZWlnaHQ9IjQ2NCIgcng9Ijg4IiBmaWxsPSJub25lIiBzdHJva2U9IiM4QjVBMkIiIHN0cm9rZS13aWR0aD0iMTIiLz4KCiAgPCEtLSBDb2ZmZWUgQ3VwIEhhbmRsZSAtLT4KICA8cGF0aCBkPSJNIDM4MCAyNTYgQyA0OTAgMjU2LCA0OTAgMTUwLCAzODAgMTUwIiBmaWxsPSJub25lIiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgoKICA8IS0tIEVzcHJlc3NvIEN1cCBCYXNlIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMTYwIiBmaWxsPSIjNDMyODE4IiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMTYiLz4KCiAgPCEtLSBDcmVtYSAvIFZpbnlsIFN3aXJscyAtLT4KICA8cGF0aCBkPSJNIDI1NiAxMzYgQSAxMjAgMTIwIDAgMCAxIDM3NiAyNTYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0Q0QTM3MyIgc3Ryb2tlLXdpZHRoPSIxNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTSAyNTYgMzc2IEEgMTIwIDEyMCAwIDAgMSAxMzYgMjU2IiBmaWxsPSJub25lIiBzdHJva2U9IiNENEEzNzMiIHN0cm9rZS13aWR0aD0iMTYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik0gMTg2IDI1NiBBIDcwIDcwIDAgMCAxIDI1NiAxODYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRTZBNyIgc3Ryb2tlLXdpZHRoPSIxMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTSAzMjYgMjU2IEEgNzAgNzAgMCAwIDEgMjU2IDMyNiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkZFNkE3IiBzdHJva2Utd2lkdGg9IjEyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KCiAgPCEtLSBHYW1lcGFkIEFCWFkgQnV0dG9ucyAtLT4KICA8IS0tIFRvcCBCdXR0b24gKFkvVHJpYW5nbGUpIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIwNCIgcj0iMTgiIGZpbGw9IiNGRkU2QTciLz4KICA8IS0tIEJvdHRvbSBCdXR0b24gKEEvQ3Jvc3MpIC0tPgogIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjMwOCIgcj0iMTgiIGZpbGw9IiNGRkU2QTciLz4KICA8IS0tIExlZnQgQnV0dG9uIChYL1NxdWFyZSkgLS0+CiAgPGNpcmNsZSBjeD0iMjA0IiBjeT0iMjU2IiByPSIxOCIgZmlsbD0iI0ZGRTZBNyIvPgogIDwhLS0gUmlnaHQgQnV0dG9uIChCL0NpcmNsZSkgLS0+CiAgPGNpcmNsZSBjeD0iMzA4IiBjeT0iMjU2IiByPSIxOCIgZmlsbD0iI0ZGRTZBNyIvPgo8L3N2Zz4K';

async function searchHltb(gameName) {
    const initData = await new Promise((resolve, reject) => {
        const req = https.get(`https://howlongtobeat.com/api/bleed/init?t=${Date.now()}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'referer': 'https://howlongtobeat.com/',
            }
        }, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    });
    const { token, hpKey, hpVal } = initData;
    const payload = {
        searchType: 'games', searchTerms: gameName.trim().split(' '),
        searchPage: 1, size: 5,
        searchOptions: {
            games: { userId: 0, platform: '', sortCategory: 'popular', rangeCategory: 'main', rangeTime: { min: 0, max: 0 }, gameplay: { perspective: '', flow: '', genre: '', difficulty: '' }, rangeYear: { min: 0, max: 0 }, modifier: '' },
            users: { sortCategory: 'postcount' }, lists: { sortCategory: 'all' },
            filter: '', sort: 0, randomizer: 0
        },
        useCache: true
    };
    if (hpKey) payload[hpKey] = hpVal;
    const body = JSON.stringify(payload);
    return new Promise((resolve, reject) => {
        const req = https.request({ hostname: 'howlongtobeat.com', path: '/api/bleed', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'origin': 'https://howlongtobeat.com', 'referer': 'https://howlongtobeat.com/search',
                'x-auth-token': token, 'x-hp-key': hpKey, 'x-hp-val': hpVal }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data).data || []); } catch(e) { reject(e); } });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
        req.write(body); req.end();
    });
}

let baseDir;
if (process.env.APPIMAGE) {
    baseDir = path.dirname(process.env.APPIMAGE);
} else if (app.isPackaged) {
    baseDir = path.dirname(process.execPath);
} else {
    baseDir = __dirname;
}

const configDir = path.join(baseDir, 'GameManagerConfig');

// Write a minimal game entry to GRINDER's DB (called before opening GRINDER for setup)
function ensureInGrinderDb(id, title, store, appId, installed) {
    const home = os.homedir();
    const candidates = [
        path.join(home, '.config', 'grinder', 'grinder.db'),
        path.join(home, '.config', 'GRINDER', 'grinder.db'),
        path.join(baseDir, 'GRINDERConfig', 'grinder.db'),
    ];
    const gdbPath = candidates.find(p => fs.existsSync(p));
    if (!gdbPath) return false; // GRINDER has never been launched — can't write yet
    try {
        const gdb = new Database(gdbPath, { timeout: 5000 });
        gdb.prepare(`INSERT OR IGNORE INTO games (id, title, store, app_id, installed) VALUES (?, ?, ?, ?, ?)`)
           .run(id, title, store, appId || null, installed ? 1 : 0);
        gdb.close();
        return true;
    } catch { return false; }
}

// Open GRINDER focused on a specific game's setup (called by "Setup with GRINDER" button)
ipcMain.handle('open-grinder-setup', (_, game) => {
    const grinderPath = findGrinderPath();
    if (!grinderPath) return { ok: false, error: 'GRINDER not found.' };

    let grinderGameId = game.GrinderGameId || null;

    if (!grinderGameId) {
        // Determine what ID and store to use for GRINDER
        const steamId = game.SteamAppID ? String(game.SteamAppID).replace(/\.0+$/, '') : null;
        if (steamId) {
            grinderGameId = `steam_${steamId}`;
            ensureInGrinderDb(grinderGameId, game.Game, 'steam', steamId, game.Installed);
            // Link back so verifyAndLaunch routes to GRINDER's headless engine
            if (db) db.prepare("UPDATE games SET GrinderGameId=? WHERE id=?").run(grinderGameId, game.id);
        } else {
            // Others/Physical/non-catalogued — use a deterministic CNGM-prefixed ID
            const safe = (game.Game || 'game').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
            grinderGameId = `cngm_${safe}_${Date.now().toString(36)}`;
            const launchCmd = game.LaunchCommand || '';
            const storeGuess = /heroic.*gog/i.test(launchCmd) ? 'gog'
                             : /heroic.*epic/i.test(launchCmd) ? 'epic'
                             : 'custom';
            ensureInGrinderDb(grinderGameId, game.Game, storeGuess, null, game.Installed);
            // Write back the GrinderGameId to CNGM's DB so future calls reuse it
            if (db) db.prepare("UPDATE games SET GrinderGameId=? WHERE id=?").run(grinderGameId, game.id);
        }
    }

    spawn(grinderPath, ['setup', grinderGameId], { detached: true, stdio: 'ignore' }).unref();
    return { ok: true };
});
const imagesDir = path.join(configDir, 'images');
const trailersDir = path.join(configDir, 'videos');
const dbPath = path.join(configDir, 'games.db');

// YT-DLP Paths
const baseAssetPath = app.isPackaged ? process.resourcesPath : __dirname;
const binDir = path.join(baseAssetPath, 'assets', 'bin', 'linux');
const ytDlpPath = path.join(binDir, 'yt-dlp');
const ffmpegPath = path.join(binDir, 'ffmpeg');
const ytDlpConfigPath = path.join(binDir, 'yt-dlp.conf');

let db;

function createWindow () {
    const win = new BrowserWindow({
        width: 1400,
        height: 950,
        frame: false,
        show: false,
        backgroundColor: '#2C1E16',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
                                  contextIsolation: true,
                                  nodeIntegration: false,
                                  webSecurity: false
        }
    });

    win.setMenu(null);
    win.loadFile('index.html');

    // Show only after the renderer has applied the theme — eliminates blank screen and color flash.
    // Fallback: if renderer never signals within 3s, show anyway.
    const showWin = () => { if (!win.isVisible()) win.show(); };
    ipcMain.once('renderer-ready', showWin);
    win.once('ready-to-show', () => setTimeout(showWin, 3000));
    win.webContents.once('did-finish-load', () => startSteamInstallWatcher(win));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const w = BrowserWindow.getAllWindows()[0];
        if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
    });
}

app.whenReady().then(() => {
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
    if (!fs.existsSync(trailersDir)) fs.mkdirSync(trailersDir, { recursive: true });

    try {
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.prepare(`
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT, Store TEXT, FAV TEXT, WANT_TO_PLAY TEXT,
            PLAYING TEXT, FINISHED TEXT, Game TEXT, METACRITIC TEXT, RELEASED TEXT, GENRE TEXT,
            DEV TEXT, PUB TEXT, Acquired TEXT, HLTB_Main TEXT, HLTB_Main_Side TEXT, HLTB_Comp TEXT,
            CoverArt TEXT, Screenshot TEXT, Description TEXT, Tags TEXT,
            SteamAppID TEXT, SteamRating TEXT, Price TEXT, LowestPrice TEXT,
            Coop TEXT, NumPlayers TEXT, SimilarGames TEXT, LaunchCommand TEXT
        )
        `).run();

        try { db.prepare("ALTER TABLE games ADD COLUMN ProtonTier TEXT").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN LastPlayed INTEGER DEFAULT 0").run(); } catch(e) {}

        try { db.prepare("ALTER TABLE games ADD COLUMN HeroArt TEXT").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN Logo TEXT").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN Icon TEXT").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN SteamDesc TEXT").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN SteamTrailer TEXT").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN Description_i18n TEXT DEFAULT ''").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN Franchise TEXT DEFAULT ''").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN IGDBTrailer TEXT DEFAULT ''").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN Installed INTEGER DEFAULT 1").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN GrinderGameId TEXT").run(); } catch(e) {}
        try { db.prepare("ALTER TABLE games ADD COLUMN prefer_heroic INTEGER DEFAULT 0").run(); } catch(e) {}

        db.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`).run();
    } catch (err) {
        console.error("Could not connect to database:", err);
    }
    createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

function findGrinderPath() {
    try {
        const f = fs.readdirSync(baseDir).find(n => /^GRINDER\.(AppImage|appimage)$/i.test(n));
        return f ? path.join(baseDir, f) : null;
    } catch { return null; }
}

function findCremaPath() {
    try {
        const f = fs.readdirSync(baseDir).find(n => /^CREMA\.(AppImage|appimage)$/i.test(n));
        return f ? path.join(baseDir, f) : null;
    } catch(e) { return null; }
}
ipcMain.handle('check-crema', () => !!findCremaPath());

// ── INSTALL STATUS HELPERS ────────────────────────────────────────────────
function getSteamLibraryPaths() {
    const home = os.homedir();
    const roots = [
        path.join(home, '.local', 'share', 'Steam'),
        path.join(home, '.var', 'app', 'com.valvesoftware.Steam', 'data', 'steam'),
        path.join(home, '.steam', 'steam'),
    ];
    const dirs = new Set();
    for (const root of roots) {
        const sa = path.join(root, 'steamapps');
        if (!fs.existsSync(sa)) continue;
        dirs.add(sa);
        try {
            const vdf = path.join(sa, 'libraryfolders.vdf');
            if (fs.existsSync(vdf)) {
                const content = fs.readFileSync(vdf, 'utf8');
                for (const m of content.matchAll(/"path"\s+"([^"]+)"/g)) {
                    const extra = path.join(m[1], 'steamapps');
                    if (fs.existsSync(extra)) dirs.add(extra);
                }
            }
        } catch(e) {}
    }
    return [...dirs];
}
function isSteamGameInstalled(appId) {
    if (!appId || appId === 'None' || appId === '') return false;
    const id = String(appId).replace(/\.0+$/, '');
    return getSteamLibraryPaths().some(dir => fs.existsSync(path.join(dir, `appmanifest_${id}.acf`)));
}

function isHeroicGameInstalled(launchCommand) {
    if (!launchCommand) return null;
    const match = launchCommand.match(/heroic:\/\/launch\/(epic|gog)\/([^"\s]+)/i);
    if (!match) return null;
    const [, storeType, appId] = match;
    const home = os.homedir();
    const heroicBase = [
        path.join(home, '.config', 'heroic'),
        path.join(home, '.var', 'app', 'com.heroicgameslauncher.hgl', 'config', 'heroic')
    ];
    const relPaths = {
        epic: path.join('legendaryConfig', 'legendary', 'installed.json'),
        gog:  path.join('gog_store', 'installed.json')
    };
    for (const base of heroicBase) {
        const p = path.join(base, relPaths[storeType] || '');
        if (!fs.existsSync(p)) continue;
        try { const ids = parseHeroicInstalledIds(JSON.parse(fs.readFileSync(p, 'utf8'))); return ids.has(appId) ? true : null; } catch(e) {}
    }
    return null; // positive install not confirmed — preserve existing DB value (defaults to 1)
}

function resolveInstallState(launchCommand, steamAppId) {
    const cmd = launchCommand || '';
    if (/heroic:\/\/launch/i.test(cmd)) {
        const h = isHeroicGameInstalled(cmd);
        return h === true ? 1 : null; // only write 1 when confirmed; never force 0
    }
    if (/steam:\/\/rungameid/i.test(cmd) && steamAppId && steamAppId !== 'None' && steamAppId !== '') {
        return isSteamGameInstalled(steamAppId) ? 1 : 0;
    }
    return null;
}

ipcMain.handle('verify-install-status', (e, gameId) => {
    if (!db) return { installed: 1 };
    const game = db.prepare("SELECT id, SteamAppID, LaunchCommand, Installed FROM games WHERE id=?").get(gameId);
    if (!game) return { installed: 1 };
    const installed = resolveInstallState(game.LaunchCommand, game.SteamAppID);
    if (installed !== null) db.prepare("UPDATE games SET Installed=? WHERE id=?").run(installed, gameId);
    return { installed: installed ?? game.Installed ?? 1 };
});

// ── DYNAMIC INSTALL WATCHER ───────────────────────────────────────────────
let steamInstallWatchers = [];
function startSteamInstallWatcher(win) {
    steamInstallWatchers.forEach(w => { try { w.close(); } catch(e) {} });
    steamInstallWatchers = [];
    let debounce = null;
    const onChange = (ev, filename) => {
        if (!filename || !filename.startsWith('appmanifest_')) return;
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            if (!db) return;
            const games = db.prepare("SELECT id, SteamAppID, LaunchCommand FROM games WHERE LaunchCommand IS NOT NULL AND LaunchCommand != ''").all();
            for (const g of games) {
                const s = resolveInstallState(g.LaunchCommand, g.SteamAppID);
                if (s !== null) db.prepare("UPDATE games SET Installed=? WHERE id=?").run(s, g.id);
            }
            if (win) win.webContents.send('install-status-updated');
        }, 1500);
    };
    for (const dir of getSteamLibraryPaths()) {
        try { steamInstallWatchers.push(fs.watch(dir, { persistent: false }, onChange)); } catch(e) {}
    }
}

ipcMain.handle('open-install-url', async (e, url) => {
    if (url) await shell.openExternal(url);
});

ipcMain.handle('check-all-install-status', async () => {
    if (!db) return { updated: 0 };
    let updated = 0;

    // ── STEAM: filesystem detection ──────────────────────────────────────────
    const steamGames = db.prepare("SELECT id, SteamAppID, LaunchCommand FROM games WHERE LaunchCommand LIKE '%steam://rungameid%'").all();
    for (const g of steamGames) {
        const s = resolveInstallState(g.LaunchCommand, g.SteamAppID);
        if (s !== null) { db.prepare("UPDATE games SET Installed=? WHERE id=?").run(s, g.id); updated++; }
    }

    // ── HEROIC: snapshot scraped data → delete → resync → restore ────────────
    const heroicGames = db.prepare("SELECT * FROM games WHERE LaunchCommand LIKE '%heroic://launch%'").all();
    if (heroicGames.length > 0) {
        // Key = stable heroic://launch/... URL extracted from launch command
        const snapshot = {};
        for (const g of heroicGames) {
            const m = (g.LaunchCommand || '').match(/heroic:\/\/launch\/[^"\s]+/i);
            const key = m ? m[0].toLowerCase() : null;
            if (key) snapshot[key] = {
                CoverArt: g.CoverArt, HeroArt: g.HeroArt, Logo: g.Logo, Icon: g.Icon,
                Screenshot: g.Screenshot, Description: g.Description, SteamDesc: g.SteamDesc,
                Description_i18n: g.Description_i18n, DEV: g.DEV, PUB: g.PUB,
                RELEASED: g.RELEASED, GENRE: g.GENRE, METACRITIC: g.METACRITIC,
                HLTB_Main: g.HLTB_Main, ProtonTier: g.ProtonTier, SteamAppID: g.SteamAppID,
                Coop: g.Coop, NumPlayers: g.NumPlayers, SimilarGames: g.SimilarGames,
                Franchise: g.Franchise, IGDBTrailer: g.IGDBTrailer, SteamTrailer: g.SteamTrailer,
                FAV: g.FAV, WANT_TO_PLAY: g.WANT_TO_PLAY, LastPlayed: g.LastPlayed
            };
            db.prepare("DELETE FROM games WHERE id=?").run(g.id);
        }

        // Re-sync: INSERT path reads installed.json fresh → correct Installed status
        await doHeroicSync();

        // Restore scraped data onto re-inserted rows
        const reinserted = db.prepare("SELECT id, LaunchCommand FROM games WHERE LaunchCommand LIKE '%heroic://launch%'").all();
        for (const g of reinserted) {
            const m = (g.LaunchCommand || '').match(/heroic:\/\/launch\/[^"\s]+/i);
            const key = m ? m[0].toLowerCase() : null;
            const saved = key ? snapshot[key] : null;
            if (saved) {
                db.prepare(`UPDATE games SET CoverArt=?,HeroArt=?,Logo=?,Icon=?,Screenshot=?,Description=?,SteamDesc=?,Description_i18n=?,DEV=?,PUB=?,RELEASED=?,GENRE=?,METACRITIC=?,HLTB_Main=?,ProtonTier=?,SteamAppID=?,Coop=?,NumPlayers=?,SimilarGames=?,Franchise=?,IGDBTrailer=?,SteamTrailer=?,FAV=?,WANT_TO_PLAY=?,LastPlayed=? WHERE id=?`)
                  .run(saved.CoverArt,saved.HeroArt,saved.Logo,saved.Icon,saved.Screenshot,saved.Description,saved.SteamDesc,saved.Description_i18n,saved.DEV,saved.PUB,saved.RELEASED,saved.GENRE,saved.METACRITIC,saved.HLTB_Main,saved.ProtonTier,saved.SteamAppID,saved.Coop,saved.NumPlayers,saved.SimilarGames,saved.Franchise,saved.IGDBTrailer,saved.SteamTrailer,saved.FAV,saved.WANT_TO_PLAY,saved.LastPlayed,g.id);
                updated++;
            }
        }
    }



    // ── PHYSICAL / OTHERS / EMULATION / APPS: installed = has launch command ──
    const manualResult = db.prepare(`
        UPDATE games SET Installed = CASE WHEN LaunchCommand IS NOT NULL AND LaunchCommand != '' THEN 1 ELSE 0 END
        WHERE (LOWER(Store) LIKE '%physical%' OR LOWER(Store) LIKE '%others%' OR LOWER(Store) LIKE '%emulation%' OR LOWER(Store) LIKE '%apps%')
          AND LOWER(Store) NOT LIKE '%steam%' AND LOWER(Store) NOT LIKE '%epic%'
          AND LOWER(Store) NOT LIKE '%gog%' AND LOWER(Store) NOT LIKE '%heroic%'
    `).run();
    updated += manualResult.changes;

    return { updated };
});

ipcMain.handle('set-launch-command', (e, gameId, cmd) => {
    if (!db) return false;
    const installed = (cmd && cmd.trim() !== '') ? 1 : 0;
    db.prepare("UPDATE games SET LaunchCommand=?, Installed=? WHERE id=?").run(cmd || '', installed, gameId);
    return true;
});

ipcMain.handle('open-grinder', (_, gameName) => {
    const p = findGrinderPath();
    if (!p) return { ok: false, error: 'GRINDER not found.' };
    // Pass 'search <name>' args so GRINDER pre-fills the search box
    const args = gameName ? ['search', gameName] : [];
    const child = spawn(p, args, { detached: true, stdio: 'ignore' });
    child.unref();
    return { ok: true };
});

ipcMain.handle('set-grinder-game', (_, gameId, grinderGameId) => {
    if (!db) return false;
    if (grinderGameId === null) {
        // User explicitly chose Heroic — remember preference, clear GRINDER override
        db.prepare("UPDATE games SET GrinderGameId=NULL, prefer_heroic=1 WHERE id=?").run(gameId);
    } else {
        // User chose GRINDER — clear Heroic preference
        db.prepare("UPDATE games SET GrinderGameId=?, prefer_heroic=0 WHERE id=?").run(grinderGameId, gameId);
    }
    return true;
});

// Auto-sync GRINDER installed status into CNGM library.
// installedIds = array of GRINDER game IDs that are installed (from grinderStatus).
// Sets GrinderGameId + Installed=1 for matching Heroic games unless user prefers Heroic.
ipcMain.handle('sync-grinder-installed', (_, installedIds) => {
    if (!db || !Array.isArray(installedIds)) return { synced: 0 };
    const idSet = new Set(installedIds);
    let synced = 0;
    const games = db.prepare(
        "SELECT id, LaunchCommand, GrinderGameId, prefer_heroic FROM games WHERE LaunchCommand LIKE '%heroic://launch/%'"
    ).all();
    for (const g of games) {
        const epicMatch = (g.LaunchCommand || '').match(/heroic:\/\/launch\/epic\/([^"\s]+)/i);
        const gogMatch  = (g.LaunchCommand || '').match(/heroic:\/\/launch\/gog\/([^"\s]+)/i);
        const m = epicMatch || gogMatch;
        if (!m) continue;
        const gid = epicMatch ? `epic_${epicMatch[1]}` : `gog_${gogMatch[1]}`;
        if (idSet.has(gid) && !g.prefer_heroic) {
            db.prepare("UPDATE games SET GrinderGameId=?, Installed=1 WHERE id=?").run(gid, g.id);
            synced++;
        } else if (!idSet.has(gid) && g.GrinderGameId && !g.prefer_heroic) {
            // No longer installed in GRINDER — clear the auto-set override
            db.prepare("UPDATE games SET GrinderGameId=NULL WHERE id=?").run(g.id);
        }
    }
    return { synced };
});

ipcMain.handle('grinder-status', () => {
    const home = os.homedir();
    const grinderPath = findGrinderPath();
    if (!grinderPath) return { found: false, installedGames: [] };

    // Electron uses lowercase app name for userData: ~/.config/grinder/
    const candidates = [
        path.join(home, '.config', 'grinder', 'grinder.db'),   // packaged (actual)
        path.join(home, '.config', 'GRINDER', 'grinder.db'),   // capitalised fallback
        path.join(baseDir, 'GRINDERConfig', 'grinder.db'),     // dev mode fallback
    ];
    const grinderDb = candidates.find(p => fs.existsSync(p));
    if (!grinderDb) return { found: true, path: grinderPath, installedGames: [], error: 'Launch GRINDER once to create its database.' };

    try {
        const gdb = new Database(grinderDb, { readonly: true });
        const installed = gdb.prepare("SELECT id FROM games WHERE installed=1").all();
        const allGames  = gdb.prepare("SELECT id, title, store, app_id, installed, platform FROM games").all();
        gdb.close();
        return { found: true, path: grinderPath,
                 installedGames: installed.map(r => r.id),
                 allGames };
    } catch (e) {
        return { found: true, path: grinderPath, installedGames: [], allGames: [], error: `Could not read GRINDER DB: ${e.message}` };
    }
});

// Sync ALL GRINDER games into CNGM (installed and not installed).
// Matches by app_id for GOG/Epic; inserts new entries for unmatched games.
ipcMain.handle('sync-all-grinder-games', (_, allGrinderGames, grinderPath) => {
    if (!allGrinderGames?.length) return { synced: 0 };
    let synced = 0;

    for (const gg of allGrinderGames) {
        // Try to find a matching CNGM game by app_id embedded in the Heroic LaunchCommand
        let existing = null;
        if (gg.app_id) {
            existing = db.prepare(
                "SELECT id, GrinderGameId FROM games WHERE LaunchCommand LIKE ? AND (GrinderGameId IS NULL OR GrinderGameId=?)"
            ).get(`%${gg.app_id}%`, gg.id);
        }

        if (existing) {
            // Matched — update GrinderGameId and install status
            db.prepare("UPDATE games SET GrinderGameId=?, Installed=? WHERE id=?")
              .run(gg.id, gg.installed ? 1 : 0, existing.id);
            synced++;
        } else {
            // No CNGM equivalent — insert as new entry if not already imported
            const alreadyIn = db.prepare("SELECT id FROM games WHERE GrinderGameId=?").get(gg.id);
            if (!alreadyIn) {
                // Build a synthetic LaunchCommand so CNGM can launch via Heroic as fallback
                let launchCmd = '';
                if (gg.store === 'gog' && gg.app_id)   launchCmd = `heroic://launch/gog/${gg.app_id}`;
                if (gg.store === 'epic' && gg.app_id)  launchCmd = `heroic://launch/epic/${gg.app_id}`;
                const store = gg.store === 'gog' ? 'GOG' : gg.store === 'epic' ? 'EPIC' : 'GRINDER';
                db.prepare(
                    "INSERT INTO games (Game, LaunchCommand, Store, Installed, GrinderGameId) VALUES (?, ?, ?, ?, ?)"
                ).run(gg.title || gg.id, launchCmd, store, gg.installed ? 1 : 0, gg.id);
                synced++;
            }
        }
    }
    return { synced };
});

ipcMain.on('launch-crema', () => {
    const p = findCremaPath();
    if (!p) return;
    const child = spawn(p, [], { detached: true, stdio: 'ignore' });
    child.unref();
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.minimize();
});

ipcMain.handle('install-to-menu', () => {
    try {
        const appsDir = path.join(os.homedir(), '.local', 'share', 'applications');
        const iconsDir = path.join(baseDir, 'icons');
        if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
        fs.writeFileSync(path.join(iconsDir, 'CNGM.svg'),    Buffer.from(CNGM_SVG_B64,    'base64'));
        fs.writeFileSync(path.join(iconsDir, 'CREMA.svg'),   Buffer.from(CREMA_SVG_B64,   'base64'));
        fs.writeFileSync(path.join(iconsDir, 'GRINDER.svg'), Buffer.from(GRINDER_SVG_B64, 'base64'));
        if (!fs.existsSync(appsDir)) fs.mkdirSync(appsDir, { recursive: true });
        const files = fs.readdirSync(baseDir);
        const cngmFile    = files.find(f => /^CNGM.*\.AppImage$/i.test(f));
        const cremaFile   = files.find(f => /^CREMA.*\.AppImage$/i.test(f));
        const grinderFile = files.find(f => /^GRINDER.*\.AppImage$/i.test(f));
        const installed = [];
        if (cngmFile) {
            const p = path.join(baseDir, cngmFile); fs.chmodSync(p, '755');
            fs.writeFileSync(path.join(appsDir, 'cafe-neurotico-game-manager.desktop'),
                `[Desktop Entry]\nVersion=1.0\nType=Application\nName=Cafe Neurotico Game Manager\nComment=The neurotic manager for your gaming library.\nExec="${p}"\nIcon=${path.join(iconsDir,'CNGM.svg')}\nTerminal=false\nCategories=Game;Utility;\n`);
            installed.push('CNGM');
        }
        if (cremaFile) {
            const p = path.join(baseDir, cremaFile); fs.chmodSync(p, '755');
            fs.writeFileSync(path.join(appsDir, 'cafe-neurotico-crema.desktop'),
                `[Desktop Entry]\nVersion=1.0\nType=Application\nName=CREMA\nComment=The Bon Vivant Fullscreen Gamepad-Centered Interface.\nExec="${p}"\nIcon=${path.join(iconsDir,'CREMA.svg')}\nTerminal=false\nCategories=Game;\n`);
            installed.push('CREMA');
        }
        if (grinderFile) {
            const p = path.join(baseDir, grinderFile); fs.chmodSync(p, '755');
            fs.writeFileSync(path.join(appsDir, 'cafe-neurotico-grinder.desktop'),
                `[Desktop Entry]\nVersion=1.0\nType=Application\nName=GRINDER\nComment=Cafe Neurotico GRINDER — Epic game launcher and install engine.\nExec="${p}"\nIcon=${path.join(iconsDir,'GRINDER.svg')}\nTerminal=false\nCategories=Game;\n`);
            installed.push('GRINDER');
        }
        execFile('update-desktop-database', [appsDir], () => {});
        if (installed.length === 0) return { success: false, message: 'No AppImages found in the app folder.' };
        return { success: true, message: `Installed to menu: ${installed.join(' + ')}` };
    } catch(err) { return { success: false, message: err.message }; }
});

let manualWin = null;
ipcMain.on('open-manual', () => {
    if (manualWin && !manualWin.isDestroyed()) { manualWin.focus(); return; }
    manualWin = new BrowserWindow({ width: 1100, height: 800, minWidth: 800, minHeight: 500, frame: false, backgroundColor: '#2C1E16',
        webPreferences: { contextIsolation: true, nodeIntegration: false } });
    manualWin.loadFile('manual.html');
    manualWin.setMenu(null);
    manualWin.on('closed', () => { manualWin = null; });
});

ipcMain.on('window-minimize', () => { const win = BrowserWindow.getFocusedWindow(); if(win) win.minimize(); });
ipcMain.on('window-maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if(win) { if(win.isMaximized()) win.unmaximize(); else win.maximize(); }
});
ipcMain.on('window-close', () => { const win = BrowserWindow.getFocusedWindow(); if(win) win.close(); });

const STEAM_LANG_MAP = { en: 'english', pt_BR: 'brazilian' };
async function fetchDescI18n(appId, enDesc) {
    const lang = db?.prepare("SELECT value FROM settings WHERE key='language'").get()?.value || 'en';
    const i18n = { en: enDesc };
    if (lang !== 'en' && STEAM_LANG_MAP[lang]) {
        try {
            const r = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=${STEAM_LANG_MAP[lang]}`);
            const d = await r.json();
            if (d[appId]?.success) i18n[lang] = d[appId].data.short_description || enDesc;
        } catch(e) {}
    }
    return JSON.stringify(i18n);
}

// ── IGDB / Twitch ──────────────────────────────────────────────────────────
async function getIgdbToken() {
    const clientId = db?.prepare("SELECT value FROM settings WHERE key='igdb_client_id'").get()?.value;
    const secret   = db?.prepare("SELECT value FROM settings WHERE key='igdb_client_secret'").get()?.value;
    if (!clientId || !secret) return null;

    const cached  = db.prepare("SELECT value FROM settings WHERE key='igdb_token'").get()?.value;
    const expiry  = db.prepare("SELECT value FROM settings WHERE key='igdb_token_expiry'").get()?.value;
    if (cached && expiry && Date.now() < parseInt(expiry)) return { token: cached, clientId };

    try {
        const res  = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${secret}&grant_type=client_credentials`, { method: 'POST' });
        const data = await res.json();
        if (!data.access_token) return null;
        const exp = Date.now() + (data.expires_in * 1000) - 86400000;
        db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('igdb_token',?)").run(data.access_token);
        db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('igdb_token_expiry',?)").run(String(exp));
        return { token: data.access_token, clientId };
    } catch(e) { return null; }
}

async function igdbQuery(auth, body) {
    const res = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: { 'Client-ID': auth.clientId, 'Authorization': `Bearer ${auth.token}`, 'Content-Type': 'text/plain' },
        body
    });
    const data = await res.json();
    // IGDB returns error objects with a 'title' field instead of 'name'
    if (!Array.isArray(data) || data[0]?.title) return null;
    return data[0] || null;
}

async function igdbSearch(gameName, steamAppId) {
    const auth = await getIgdbToken();
    if (!auth) return null;
    const fields = 'fields name,summary,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,genres.name,themes.name,first_release_date,aggregated_rating,cover.url,screenshots.url,videos.video_id,similar_games.name,franchises.name,collection.name,external_games.category,external_games.uid;';
    try {
        // Try Steam App ID lookup first (precise), fall back to name search
        if (steamAppId) {
            const byId = await igdbQuery(auth, `${fields} where external_games.uid = "${steamAppId}" & external_games.category = 1; limit 1;`);
            if (byId) return byId;
        }
        return await igdbQuery(auth, `search "${gameName.replace(/"/g, '')}"; ${fields} limit 3;`);
    } catch(e) { return null; }
}

function igdbImg(url, size = 'cover_big') {
    if (!url) return null;
    return 'https:' + url.replace('t_thumb', `t_${size}`);
}

ipcMain.handle('igdb-test', async () => {
    const auth = await getIgdbToken();
    if (!auth) return { success: false, message: 'No credentials saved.' };
    // Use name search for the test — most reliable, no external_games dependency
    const result = await igdbQuery(auth, 'search "Portal 2"; fields name; limit 1;');
    if (result?.name) return { success: true, message: `✅ Connected! Found: ${result.name}` };
    return { success: false, message: '❌ Token OK but IGDB query failed. Try again in a moment.' };
});
// ───────────────────────────────────────────────────────────────────────────

ipcMain.handle('get-basedir', () => baseDir);
ipcMain.handle('get-setting', (e, key) => { try { const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key); return row ? row.value : null; } catch(e) { return null; } });
ipcMain.handle('set-setting', (e, key, val) => { try { db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, val); return true; } catch(e) { return false; } });

ipcMain.handle('open-web-popup', async (event, url) => {
    const popupWin = new BrowserWindow({
        width: 1000, height: 700, title: "Web Search", autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    popupWin.setMenu(null);
    popupWin.loadURL(url);
});

// --- DATA MANAGEMENT TOOLS ---
ipcMain.handle('clear-browser-data', async () => {
    try {
        await session.defaultSession.clearStorageData();
        return { success: true, message: "Browser data (cookies, active logins, cache) successfully wiped!" };
    } catch (err) {
        return { success: false, message: err.message };
    }
});

// FIX: New handler to ruthlessly clean orphaned images
ipcMain.handle('clean-unused-images', () => {
    try {
        const files = fs.readdirSync(imagesDir);
        const rows = db.prepare("SELECT CoverArt, HeroArt, Logo, Icon, Screenshot FROM games").all();
        const usedSet = new Set();

        rows.forEach(r => {
            if (r.CoverArt) usedSet.add(path.basename(r.CoverArt));
            if (r.HeroArt) usedSet.add(path.basename(r.HeroArt));
            if (r.Logo) usedSet.add(path.basename(r.Logo));
            if (r.Icon) usedSet.add(path.basename(r.Icon));
            if (r.Screenshot) {
                r.Screenshot.split('|').filter(s => s.trim() !== '').forEach(s => {
                    usedSet.add(path.basename(s));
                });
            }
        });

        let deletedCount = 0;
        files.forEach(file => {
            if (!usedSet.has(file)) {
                fs.unlinkSync(path.join(imagesDir, file));
                deletedCount++;
            }
        });
        return { success: true, message: `Successfully deleted ${deletedCount} unused/orphaned images!` };
    } catch (err) {
        return { success: false, message: `Cleanup failed: ${err.message}` };
    }
});

// FIX: New handler for the nuclear option (Clear All Images)
ipcMain.handle('clear-all-images', () => {
    try {
        const files = fs.readdirSync(imagesDir);
        let deletedCount = 0;
        files.forEach(file => {
            fs.unlinkSync(path.join(imagesDir, file));
            deletedCount++;
        });
        db.prepare("UPDATE games SET CoverArt='', HeroArt='', Logo='', Icon='', Screenshot=''").run();
        return { success: true, message: `Successfully wiped ${deletedCount} images from the system and reset the database!` };
    } catch (err) {
        return { success: false, message: `Failed to wipe images: ${err.message}` };
    }
});

ipcMain.handle('backup-zip', async (event) => {
    const win = BrowserWindow.getFocusedWindow();
    const { filePath } = await dialog.showSaveDialog(win, {
        title: 'Save ZIP Backup',
        defaultPath: 'CNGM_Backup.zip',
            filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
    });
    if (!filePath) return { success: false, canceled: true };

    event.sender.send('zip-started');

    return new Promise((resolve) => {
        const isWin = process.platform === 'win32';
        const [prog, args] = isWin
            ? ['powershell', ['-command', `Compress-Archive -Path '${configDir}' -DestinationPath '${filePath}' -Force`]]
            : ['zip', ['-r', filePath, 'GameManagerConfig']];
        const opts = isWin ? {} : { cwd: baseDir };

        execFile(prog, args, opts, (error) => {
            if (error) resolve({ success: false, message: `Backup failed: ${error.message}` });
            else resolve({ success: true, message: "ZIP Backup successfully created!" });
        });
    });
});

ipcMain.handle('restore-zip', async (event) => {
    const win = BrowserWindow.getFocusedWindow();
    const { filePaths } = await dialog.showOpenDialog(win, {
        title: 'Restore ZIP Backup',
        filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
        properties: ['openFile']
    });
    if (!filePaths || filePaths.length === 0) return { success: false, canceled: true };

    event.sender.send('zip-started');

    const filePath = filePaths[0];
    return new Promise((resolve) => {
        const isWin = process.platform === 'win32';
        const [prog, args] = isWin
            ? ['powershell', ['-command', `Expand-Archive -Path '${filePath}' -DestinationPath '${baseDir}' -Force`]]
            : ['unzip', ['-o', filePath, '-d', baseDir]];

        execFile(prog, args, (error) => {
            if (error) resolve({ success: false, message: `Restore failed: ${error.message}` });
            else resolve({ success: true, message: "Restore successful! Please restart the app to load the new database." });
        });
    });
});

ipcMain.handle('get-games', () => {
    if (!db) return { games: [] };
    try { return { games: db.prepare("SELECT * FROM games ORDER BY Game ASC").all() }; }
    catch (err) { return { games: [] }; }
});

ipcMain.handle('add-game', (e, name) => {
    try {
        const gameName = (name && name.trim()) ? name.trim() : 'New Game';
        const info = db.prepare("INSERT INTO games (Game, Store, LaunchCommand, FAV, WANT_TO_PLAY) VALUES (?, '', '', 'NO', 'NO')").run(gameName);
        return { success: true, id: info.lastInsertRowid };
    } catch (err) { return { success: false }; }
});

ipcMain.handle('update-game', (event, id, data) => {
    try {
        // Preserve existing translations when English description is edited manually
        let descI18n = data.Description_i18n || null;
        if (!descI18n && data.Description) {
            const existing = db.prepare("SELECT Description_i18n FROM games WHERE id=?").get(id);
            try { const p = JSON.parse(existing?.Description_i18n || '{}'); p.en = data.Description; descI18n = JSON.stringify(p); }
            catch(e) { descI18n = JSON.stringify({ en: data.Description }); }
        }
        const stmt = db.prepare(`UPDATE games SET Game=?, Store=?, GENRE=?, RELEASED=?, LaunchCommand=?, FAV=?, WANT_TO_PLAY=?, METACRITIC=?, HLTB_Main=?, DEV=?, PUB=?, Coop=?, NumPlayers=?, Tags=?, SimilarGames=?, Franchise=?, Description=?, Description_i18n=?, SteamAppID=?, ProtonTier=?, HeroArt=?, Logo=?, Icon=?, SteamDesc=?, SteamTrailer=?, CoverArt=?, Screenshot=?, IGDBTrailer=? WHERE id=?`);
        stmt.run(data.Game, data.Store, data.GENRE, data.RELEASED, data.LaunchCommand, data.FAV, data.WANT_TO_PLAY, data.METACRITIC, data.HLTB_Main, data.DEV, data.PUB, data.Coop, data.NumPlayers, data.Tags, data.SimilarGames, data.Franchise || "", data.Description, descI18n, data.SteamAppID, data.ProtonTier, data.HeroArt, data.Logo, data.Icon, data.SteamDesc, data.SteamTrailer, data.CoverArt, data.Screenshot, data.IGDBTrailer || "", id);
        return true;
    } catch (err) { return false; }
});

ipcMain.handle('delete-game', (event, id) => {
    try { db.prepare(`DELETE FROM games WHERE id=?`).run(id); return true; } catch (err) { return false; }
});

ipcMain.on('launch-game', (event, cmd) => {
    if (!cmd) return;

    // GOG/Epic via GRINDER (headless umu-run)
    const heroicMatch = cmd.match(/heroic:\/\/launch\/(epic|gog)\/([^"\s]+)/i);
    if (heroicMatch) {
        const appId = heroicMatch[2];
        const gMap  = getGrinderMap();
        const gId   = gMap.get(appId);
        const gPath = _grinderPath || findGrinderPath();
        if (gId && gPath) {
            spawn(gPath, ['launch', gId], { detached: true, stdio: 'ignore' }).unref();
            return;
        }
    }

    const child = spawn(cmd, [], { shell: true, detached: true, stdio: 'ignore' });
    child.unref();
});

ipcMain.handle('update-last-played', (event, id) => {
    if (!db) return false;
    try { db.prepare("UPDATE games SET LastPlayed = ? WHERE id = ?").run(Date.now(), id); return true; } catch(err) { return false; }
});

ipcMain.handle('clear-history', (event) => {
    if (!db) return false;
    try { db.prepare("UPDATE games SET LastPlayed = 0").run(); return true; } catch(err) { return false; }
});

ipcMain.handle('get-strings', (_, lang) => require('./i18n')(lang || 'en'));

// Normalises Heroic installed.json regardless of format:
//   Epic  → flat dict  { "appId": { app_name, ... } }
//   GOG   → wrapped    { "installed": [ { appName, ... }, ... ] }
//   plain → bare array [ { appName, ... }, ... ]
function parseHeroicInstalledIds(raw) {
    const items = Array.isArray(raw) ? raw
        : Array.isArray(raw.installed) ? raw.installed
        : Object.values(raw);
    const ids = new Set();
    for (const item of items) {
        const id = String(item.app_name || item.appName || item.appID || '');
        if (id) ids.add(id);
    }
    return ids;
}

// --- SYNC ENGINES ---
async function doHeroicSync() {
    if (!db) return { success: false, message: "Database not initialized." };
    const home = os.homedir();
    let importedCount = 0;

    const heroicPaths = [
        { type: 'NATIVE',  base: path.join(home, '.config', 'heroic'), cmdPrefix: 'heroic' },
        { type: 'FLATPAK', base: path.join(home, '.var', 'app', 'com.heroicgameslauncher.hgl', 'config', 'heroic'), cmdPrefix: 'flatpak run com.heroicgameslauncher.hgl' }
    ];
    const storeConfigs = [
        { name: 'EPIC', relInstalled: path.join('legendaryConfig', 'legendary', 'installed.json'), relLibraries: [ path.join('store_cache', 'legendary_library.json'), path.join('store_cache', 'epic_library.json'), path.join('store', 'epic', 'library.json') ], protocolId: 'epic' },
        { name: 'GOG',  relInstalled: path.join('gog_store', 'installed.json'), relLibraries: [ path.join('store_cache', 'gog_library.json'), path.join('gog_store', 'library.json') ], protocolId: 'gog' }
    ];

    for (const env of heroicPaths) {
        if (!fs.existsSync(env.base)) continue;
        for (const store of storeConfigs) {
            const gamesFound = new Map();
            const installedIds = new Set();
            let installedJsonLoaded = false;
            for (const relLib of store.relLibraries) {
                const libPath = path.join(env.base, relLib);
                if (!fs.existsSync(libPath)) continue;
                try {
                    const raw = JSON.parse(fs.readFileSync(libPath, 'utf8'));
                    let items = Array.isArray(raw) ? raw : raw.library || raw.games || (typeof raw === 'object' ? Object.values(raw) : []);
                    for (const item of items) {
                        const appId = item.app_name || item.appName || item.id || item.name;
                        const title = item.title || item.name || item.appName;
                        if (appId && title) gamesFound.set(appId, title);
                    }
                } catch (err) {}
            }
            const installedPath = path.join(env.base, store.relInstalled);
            if (fs.existsSync(installedPath)) {
                try {
                    const raw = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
                    const ids = parseHeroicInstalledIds(raw);
                    for (const id of ids) installedIds.add(id);
                    installedJsonLoaded = true;
                } catch (err) {}
            }
            for (const [appId, gameTitle] of gamesFound.entries()) {
                const launchCommand = `${env.cmdPrefix} "heroic://launch/${store.protocolId}/${appId}"`;
                // Use actual detected state when json was loadable; default to 1 when file not found
                const isInstalled = installedJsonLoaded ? (installedIds.has(appId) ? 1 : 0) : 1;
                const existing = db.prepare("SELECT * FROM games WHERE LaunchCommand = ? OR LOWER(Game) = LOWER(?)").get(launchCommand, gameTitle);
                if (existing) {
                    let stores = existing.Store ? existing.Store.split(',').map(s => s.trim()) : [];
                    if (!stores.some(s => s.toLowerCase() === store.name.toLowerCase())) stores.push(store.name);
                    db.prepare("UPDATE games SET LaunchCommand = ?, Store = ?, Installed = ? WHERE id = ?").run(launchCommand, stores.join(', '), isInstalled, existing.id);
                } else {
                    db.prepare("INSERT INTO games (Game, Store, LaunchCommand, FAV, WANT_TO_PLAY, Installed) VALUES (?, ?, ?, 'NO', 'NO', ?)").run(gameTitle, store.name, launchCommand, isInstalled);
                }
                importedCount++;
            }
        }
    }
    return { success: true, count: importedCount, message: `Successfully synced ${importedCount} games from Heroic.` };
}

ipcMain.handle('sync-heroic', async () => doHeroicSync());


// ── LAUNCH & AUTO-WATCH ────────────────────────────────────────────────────
let heroicWatchState = null;

function stopHeroicWatch() {
    if (!heroicWatchState) return;
    heroicWatchState.watchers.forEach(w => { try { w.close(); } catch(e) {} });
    clearTimeout(heroicWatchState.debounceTimer);
    clearTimeout(heroicWatchState.timeoutTimer);
    heroicWatchState = null;
}

// ── FLATPAK ────────────────────────────────────────────────────────────────

ipcMain.handle('scan-flatpak', () => {
    const GAME_CATS = new Set(['Game','ActionGame','ArcadeGame','BoardGame','CardGame',
        'KidsGame','LogicGame','RolePlaying','Shooter','Simulation','SportsGame','StrategyGame']);
    const dirs = [
        '/var/lib/flatpak/exports/share/applications',
        path.join(os.homedir(), '.local/share/flatpak/exports/share/applications')
    ];

    // Collect all game app IDs currently on disk
    const found = new Set();
    for (const dir of dirs) {
        let files;
        try { files = fs.readdirSync(dir).filter(f => f.endsWith('.desktop')); }
        catch { continue; }
        for (const file of files) {
            let content;
            try { content = fs.readFileSync(path.join(dir, file), 'utf8'); }
            catch { continue; }
            let name = '', cats = '';
            for (const line of content.split('\n')) {
                if (line.startsWith('Name=') && !name) name = line.slice(5).trim();
                if (line.startsWith('Categories=') && !cats) cats = line.slice(11).trim();
            }
            if (!cats.split(';').map(c => c.trim()).some(c => GAME_CATS.has(c))) continue;
            const appId = file.slice(0, -8);
            if (!name) name = appId;
            const launchCmd = `flatpak run ${appId}`;
            found.add(launchCmd);
            const row = db.prepare('SELECT id, Store FROM games WHERE LaunchCommand = ?').get(launchCmd);
            if (row) {
                const stores = (row.Store || '').split(',').map(s => s.trim());
                if (!stores.some(s => s.toLowerCase() === 'flatpak'))
                    db.prepare('UPDATE games SET Store=?, Installed=1 WHERE id=?').run([...stores, 'Flatpak'].join(', '), row.id);
                else
                    db.prepare('UPDATE games SET Installed=1 WHERE id=?').run(row.id);
            } else {
                db.prepare('INSERT INTO games (Game,Store,LaunchCommand,Installed) VALUES (?,?,?,1)').run(name, 'Flatpak', launchCmd);
            }
        }
    }

    // Remove games that are no longer installed (desktop file gone)
    const existing = db.prepare("SELECT id, LaunchCommand FROM games WHERE Store = 'Flatpak'").all();
    for (const row of existing) {
        if (!found.has(row.LaunchCommand))
            db.prepare('DELETE FROM games WHERE id=?').run(row.id);
    }

    return { success: true, count: found.size };
});

ipcMain.handle('launch-and-watch-heroic', async (event) => {
    const win = BrowserWindow.getFocusedWindow();
    stopHeroicWatch();

    const home = os.homedir();
    const candidates = [
        { base: path.join(home, '.config', 'heroic'), cmd: 'heroic' },
        { base: path.join(home, '.var', 'app', 'com.heroicgameslauncher.hgl', 'config', 'heroic'), cmd: 'flatpak run com.heroicgameslauncher.hgl' }
    ];
    const valid = candidates.filter(c => fs.existsSync(c.base));
    if (valid.length === 0) return { success: false, message: 'Heroic not found.' };

    // Launch Heroic (fire-and-forget)
    exec(valid[0].cmd, () => {});

    // Collect directories to watch across all valid installs
    const watchDirs = [];
    for (const v of valid) {
        const sub = ['store_cache', path.join('legendaryConfig', 'legendary'), 'gog_store', path.join('nile_config', 'nile')];
        for (const s of sub) { const d = path.join(v.base, s); if (fs.existsSync(d)) watchDirs.push(d); }
    }
    if (watchDirs.length === 0) return { success: false, message: 'Heroic library directories not found.' };

    heroicWatchState = { watchers: [], debounceTimer: null, timeoutTimer: null };

    const onFileChange = () => {
        clearTimeout(heroicWatchState.debounceTimer);
        heroicWatchState.debounceTimer = setTimeout(async () => {
            stopHeroicWatch();
            if (win) win.webContents.send('heroic-watch-status', { phase: 'syncing' });
            const result = await doHeroicSync();
            if (win) win.webContents.send('heroic-watch-status', { phase: 'done', success: result.success, message: result.message, count: result.count });
        }, 2500);
    };

    heroicWatchState.watchers = watchDirs.map(d => { try { return fs.watch(d, { persistent: false }, onFileChange); } catch(e) { return null; } }).filter(Boolean);

    heroicWatchState.timeoutTimer = setTimeout(() => {
        stopHeroicWatch();
        if (win) win.webContents.send('heroic-watch-status', { phase: 'timeout' });
    }, 300000);

    return { success: true };
});

ipcMain.handle('cancel-heroic-watch', () => { stopHeroicWatch(); });

ipcMain.handle('sync-steam', async (event, steamId, apiKey) => {
    if (!steamId || !apiKey) return { success: false, message: "Missing SteamID or API Key." };
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=true`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        const data = await response.json();
        if (!data.response || !data.response.games) return { success: false, message: "Could not read games." };

        let added = 0;
        let updated = 0;
        const games = data.response.games;
        const insertStmt = db.prepare("INSERT INTO games (Store, Game, SteamAppID, LaunchCommand, FAV, WANT_TO_PLAY) VALUES (?, ?, ?, ?, 'NO', 'NO')");

        for (const g of games) {
            const appid = String(g.appid);
            const name = g.name ? g.name.trim() : 'Unknown Game';
            if (!name) continue;

            const launchCommand = `steam steam://rungameid/${appid} -silent`;
            const isInstalled = isSteamGameInstalled(appid) ? 1 : 0;

            // Match only by exact LaunchCommand or SteamAppID — never by game name,
            // to prevent merging separate store entries (e.g. GOG + Steam of the same title).
            const existing = db.prepare(
                "SELECT * FROM games WHERE LaunchCommand = ? OR (SteamAppID = ? AND SteamAppID IS NOT NULL AND SteamAppID != '' AND SteamAppID != 'None')"
            ).get(launchCommand, appid);

            if (existing) {
                // Same Steam game already in library — update metadata and install status
                db.prepare("UPDATE games SET Store = 'Steam', SteamAppID = ?, Installed = ? WHERE id = ?")
                  .run(appid, isInstalled, existing.id);
                updated++;
            } else {
                db.prepare("INSERT INTO games (Store, Game, SteamAppID, LaunchCommand, FAV, WANT_TO_PLAY, Installed) VALUES (?, ?, ?, ?, 'NO', 'NO', ?)").run("Steam", name, appid, launchCommand, isInstalled);
                added++;
            }
        }
        return { success: true, count: added, message: `Imported ${added} new games from Steam.\n(Updated ${updated} existing entries).` };
    } catch (err) {
        return { success: false, message: `Steam API Error: ${err.message}` };
    }
});

ipcMain.handle('sync-gog', async () => {
    return new Promise((resolve) => {
        const parentWin = BrowserWindow.getFocusedWindow();
        const gogWin = new BrowserWindow({
            parent: parentWin, modal: true, width: 1000, height: 800, title: "Log in to GOG",
            webPreferences: { nodeIntegration: false, contextIsolation: true }
        });
        gogWin.setMenu(null);
        gogWin.loadURL('https://www.gog.com/');
        gogWin.webContents.on('did-finish-load', () => {
            gogWin.webContents.executeJavaScript(`
            if (!document.getElementById('cngm-gog-banner')) {
                const banner = document.createElement('div');
                banner.id = 'cngm-gog-banner';
                banner.innerHTML = "<strong style='font-size:16px;'>Cafe Neurotico:</strong> Log in to your GOG account using the menu at the top, then <u>CLOSE THIS WINDOW</u> to fetch your games!";
                banner.style.cssText = "position: fixed; bottom: 0; left: 0; width: 100%; background: #673ab7; color: white; text-align: center; padding: 15px; z-index: 9999999; box-shadow: 0 -4px 6px rgba(0,0,0,0.3); font-family: sans-serif;";
                document.body.appendChild(banner);
            }
            `);
        });
        gogWin.on('closed', async () => {
            try {
                const url = "https://www.gog.com/account/getFilteredProducts?hiddenFlag=0&mediaType=1&page=1&totalPages=50";
                const response = await net.fetch(url);
                if (!response.ok) { resolve({ success: false, message: "Could not fetch GOG data. Make sure you logged in successfully." }); return; }
                const data = await response.json();
                if (!data.products) { resolve({ success: false, message: "No games found or login failed." }); return; }

                let added = 0;
                let updated = 0;
                const insertStmt = db.prepare("INSERT INTO games (Store, Game, FAV, WANT_TO_PLAY) VALUES ('GOG', ?, 'NO', 'NO')");

                for (const product of data.products) {
                    const title = product.title.trim();
                    if (!title) continue;

                    const existing = db.prepare("SELECT * FROM games WHERE LOWER(Game) = LOWER(?)").get(title);

                    if (existing) {
                        let stores = existing.Store ? existing.Store.split(',').map(s => s.trim()) : [];
                        if (!stores.some(s => s.toLowerCase() === 'gog')) {
                            stores.push('GOG');
                            db.prepare("UPDATE games SET Store = ? WHERE id = ?").run(stores.join(', '), existing.id);
                            updated++;
                        }
                    } else {
                        insertStmt.run(title);
                        added++;
                    }
                }
                resolve({ success: true, message: `Imported ${added} new games from GOG!\n(Updated ${updated} existing entries).` });
            } catch (err) { resolve({ success: false, message: `GOG Fetch Error: ${err.message}` }); }
        });
    });
});

// --- LOCAL FILE PICKER ---
ipcMain.handle('select-local-image', async (event, gameId, type) => {
    const win = BrowserWindow.getFocusedWindow();

    let titleStr = "Image";
    if (type === 'cover') titleStr = "Cover Art";
    else if (type === 'screenshot') titleStr = "Screenshot";
    else if (type === 'hero') titleStr = "Hero Art";
    else if (type === 'logo') titleStr = "Logo (Transparent PNG)";
    else if (type === 'icon') titleStr = "Icon";

    const { filePaths } = await dialog.showOpenDialog(win, {
        title: `Select Local ${titleStr}`,
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'ico'] }],
        properties: ['openFile']
    });

    if (filePaths && filePaths.length > 0) {
        try {
            const source = filePaths[0];
            const ext = path.extname(source);
            const fileName = `${gameId}_local_${type}_${Date.now()}${ext}`;
            const dest = path.join(imagesDir, fileName);
            fs.copyFileSync(source, dest);

            const dbPath = `GameManagerConfig/images/${fileName}`;

            let column = 'CoverArt';
            if (type === 'screenshot') column = 'Screenshot';
            else if (type === 'hero') column = 'HeroArt';
            else if (type === 'logo') column = 'Logo';
            else if (type === 'icon') column = 'Icon';

            db.prepare(`UPDATE games SET ${column} = ? WHERE id = ?`).run(dbPath, gameId);
            return dbPath;
        } catch (e) { return null; }
    }
    return null;
});

// --- TRAILER LOGIC ---
function getBeautifulName(gameName) { return gameName.replace(/[\\/:*?"<>|#]/g, '').trim(); }
function getOldCrushedName(gameName) { return gameName.replace(/[^a-z0-9]/gi, '_').toLowerCase(); }

ipcMain.handle('check-local-trailer', (event, gameName) => {
    const beautifulPath = path.join(trailersDir, `${getBeautifulName(gameName)}.mp4`);
    const oldPath = path.join(trailersDir, `${getOldCrushedName(gameName)}.mp4`);
    if (fs.existsSync(beautifulPath)) return `file://${beautifulPath}`;
        if (fs.existsSync(oldPath)) return `file://${oldPath}`;
            return null;
});

ipcMain.handle('delete-trailer', (event, gameName) => {
    const beautifulPath = path.join(trailersDir, `${getBeautifulName(gameName)}.mp4`);
    const oldPath = path.join(trailersDir, `${getOldCrushedName(gameName)}.mp4`);
    let deleted = false;
    try {
        if (fs.existsSync(beautifulPath)) { fs.unlinkSync(beautifulPath); deleted = true; }
        if (fs.existsSync(oldPath)) { fs.unlinkSync(oldPath); deleted = true; }
    } catch(e) {}
    return deleted;
});

ipcMain.handle('search-youtube', async (event, gameName) => {
    const runSearch = (query) => new Promise((resolve) => {
        const args = ['--config-location', ytDlpConfigPath, `ytsearch5:${query}`, '--print', '%(id)s|%(thumbnail)s|%(title)s', '--no-playlist'];
        execFile(ytDlpPath, args, { timeout: 20000 }, (error, stdout) => {
            if (!stdout?.trim()) { resolve([]); return; }
            const lines = stdout.split('\n').filter(l => l.trim());
            resolve(lines.map(line => { const parts = line.split('|'); return { id: parts[0], thumbnail: parts[1], title: parts.slice(2).join('|') }; }));
        });
    });
    // Try "official trailer" first — broader and catches branded trailers; fall back to plain "trailer"
    let results = await runSearch(`${gameName} official trailer`);
    if (results.length === 0) results = await runSearch(`${gameName} trailer`);
    return results;
});

ipcMain.handle('download-trailer', (event, gameName, videoId) => {
    const fileName = `${getBeautifulName(gameName)}.mp4`;
    const filePath = path.join(trailersDir, fileName);
    const win = BrowserWindow.getFocusedWindow();
    const args = [ '--config-location', ytDlpConfigPath, '--ffmpeg-location', ffmpegPath, `https://www.youtube.com/watch?v=${videoId}`, '-f', 'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4]/best', '-o', filePath, '--no-part', '--newline' ];
    return new Promise((resolve) => {
        const ytdlp = spawn(ytDlpPath, args);
        ytdlp.stdout.on('data', (data) => {
            const match = data.toString().match(/\[download\]\s+(\d+(\.\d+)?)%/);
            if (match && match[1]) { if (win) win.webContents.send('download-progress', parseFloat(match[1])); }
        });
        ytdlp.on('close', (code) => resolve(code === 0));
    });
});

ipcMain.handle('fetch-steam-trailer', async (event, appId) => {
    try {
        if (!appId || appId === 'None') return null;
        const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}`;
        const detailsRes = await fetch(detailsUrl);
        const detailsData = await detailsRes.json();

        if (!detailsData[appId].success) return null;

        const appData = detailsData[appId].data;
        if (appData.movies && appData.movies.length > 0) {
            const movie = appData.movies[0];
            if (movie.mp4 && movie.mp4.max) return movie.mp4.max;
            if (movie.webm && movie.webm.max) return movie.webm.max;
            if (movie.webm && movie.webm['480']) return movie.webm['480'];
        }
        return null;
    } catch (e) {
        return null;
    }
});


// --- OTHER FETCHERS ---
ipcMain.handle('fetch-hltb', async (event, gameName) => {
    try {
        let results = await searchHltb(gameName);
        if (results.length === 0) {
            let cleanName = gameName.replace(/[:\-].*/, '').replace(/[™®©]/g, '').trim();
            results = await searchHltb(cleanName);
        }
        if (results.length > 0 && results[0].comp_main > 0) return `${Math.round(results[0].comp_main / 3600)} Hours`;
        return "Unknown";
    } catch (e) {
        if (e.message.includes('404')) return "API Offline";
        return "Error";
    }
});

ipcMain.handle('fetch-proton', async (event, appId) => {
    try {
        const response = await fetch(`https://www.protondb.com/api/v1/reports/summaries/${appId}.json`);
        if (!response.ok) return "ERROR";
        const data = await response.json();
        return data.tier ? data.tier.toUpperCase() : "UNKNOWN";
    } catch (e) { return "ERROR"; }
});

ipcMain.handle('search-steam', async (e, gameName) => {
    try {
        let res = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`);
        let data = await res.json();
        if (!data.items || data.items.length === 0) return [];
        return data.items.map(item => ({ id: item.id, name: item.name }));
    } catch(e) { return []; }
});

async function sgdbFetchFirst(gameName, apiKey, appId, assetType) {
    try {
        const headers = { "Authorization": `Bearer ${apiKey}`, "User-Agent": "Mozilla/5.0" };
        let sgdbId = null;
        if (appId) {
            const r = await fetch(`https://www.steamgriddb.com/api/v2/games/steam/${appId}`, { headers });
            const d = await r.json();
            if (d.success && d.data) sgdbId = d.data.id;
        }
        if (!sgdbId) {
            const res = await fetch(`https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(gameName)}`, { headers });
            const data = await res.json();
            if (!data.success || !data.data?.length) return null;
            sgdbId = data.data[0].id;
        }
        const endpoint = assetType === 'hero' ? 'heroes' : assetType === 'logo' ? 'logos' : 'grids';
        const res2 = await fetch(`https://www.steamgriddb.com/api/v2/${endpoint}/game/${sgdbId}`, { headers });
        const data2 = await res2.json();
        if (!data2.success || !data2.data?.length) return null;
        const url = data2.data[0].url;
        const ext = assetType === 'logo' ? 'png' : 'jpg';
        const safeN = gameName.replace(/[\\/:*?"<>|#]/g, '').trim();
        const fileName = `${safeN} - SGDB ${assetType}.${ext}`;
        if (await downloadImage(url, path.join(imagesDir, fileName))) return `GameManagerConfig/images/${fileName}`;
        return null;
    } catch(e) { return null; }
}

ipcMain.handle('sgdb-search', async (e, gameName, apiKey, appId, assetType = 'cover') => {
    try {
        const headers = { "Authorization": `Bearer ${apiKey}`, "User-Agent": "Mozilla/5.0" };
        let sgdbId = null;
        if (appId) {
            let r = await fetch(`https://www.steamgriddb.com/api/v2/games/steam/${appId}`, {headers});
            let d = await r.json();
            if (d.success && d.data) sgdbId = d.data.id;
        }
        if (!sgdbId) {
            let res = await fetch(`https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(gameName)}`, {headers});
            let data = await res.json();
            if (!data.success || !data.data || data.data.length === 0) return [];
            sgdbId = data.data[0].id;
        }

        let endpoint = 'grids';
        if (assetType === 'hero') endpoint = 'heroes';
        else if (assetType === 'logo') endpoint = 'logos';
        else if (assetType === 'icon') endpoint = 'icons';

        let queryStr = assetType === 'cover' ? '?dimensions=600x900' : '';

        let res2 = await fetch(`https://www.steamgriddb.com/api/v2/${endpoint}/game/${sgdbId}${queryStr}`, {headers});
        let data2 = await res2.json();
        if (!data2.success || !data2.data) return [];
        return data2.data.map(g => ({ thumb: g.thumb, url: g.url }));
    } catch(e) { return []; }
});

ipcMain.handle('sgdb-apply', async (e, gameId, url, assetType = 'cover') => {
    try {
        const ext = assetType === 'cover' || assetType === 'hero' ? 'jpg' : 'png';
        const fileName = `${gameId}_Custom${assetType}_${Date.now()}.${ext}`;
        const savePath = path.join(imagesDir, fileName);

        const success = await downloadImage(url, savePath);
        if (success) {
            const dbPath = `GameManagerConfig/images/${fileName}`;

            let col = 'CoverArt';
            if (assetType === 'hero') col = 'HeroArt';
            else if (assetType === 'logo') col = 'Logo';
            else if (assetType === 'icon') col = 'Icon';

            db.prepare(`UPDATE games SET ${col} = ? WHERE id = ?`).run(dbPath, gameId);
            return dbPath;
        }
        return false;
    } catch(err) { return false; }
});

async function downloadImage(url, destPath) {
    try {
        const res = await fetch(url);
        if (!res.ok) return false;
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(destPath, Buffer.from(buffer));
        return true;
    } catch (err) { return false; }
}

ipcMain.handle('auto-fetch', async (event, gameId, gameName, specificAppId) => {
    try {
        const safeName = gameName.replace(/[\\/:*?"<>|#]/g, '').trim();
        let appId = specificAppId;

        // ── 1. STEAM SEARCH (find App ID if missing) ──────────────────────
        if (!appId) {
            try {
                const sr = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`);
                const sd = await sr.json();
                if (sd.items?.length > 0) appId = sd.items[0].id;
            } catch(e) {}
        }

        // ── 2. STEAM DETAILS ──────────────────────────────────────────────
        // Read existing local images — preserved if already set; never overwritten
        const existing = db.prepare("SELECT CoverArt, HeroArt, Logo, Icon, Screenshot FROM games WHERE id=?").get(gameId) || {};
        const isLocal = (v) => v && String(v).startsWith('GameManagerConfig');

        let steamSuccess = false, appData = null;
        let desc = "", htmlDesc = "", dev = "", pub = "", released = "", meta = "";
        let genre = "", coop = "None", players = "", tags = "";
        let hltbResult = "", protonResult = "", steamTrailerUrl = "";
        let dbCoverPath  = isLocal(existing.CoverArt)   ? existing.CoverArt   : "";
        let dbHeroPath   = isLocal(existing.HeroArt)    ? existing.HeroArt    : "";
        let dbLogoPath   = isLocal(existing.Logo)       ? existing.Logo       : "";
        let dbScreenPath = isLocal(existing.Screenshot) ? existing.Screenshot : "";

        if (appId) {
            try {
                const dr = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}`);
                const dd = await dr.json();
                if (dd[appId]?.success) {
                    steamSuccess = true;
                    appData = dd[appId].data;

                    desc     = appData.short_description || "";
                    htmlDesc = appData.detailed_description || "";
                    dev      = appData.developers?.join(', ') || "";
                    pub      = appData.publishers?.join(', ') || "";
                    released = appData.release_date?.date?.slice(-4) || "";
                    meta     = appData.metacritic ? String(appData.metacritic.score) : "";
                    genre    = appData.genres?.map(g => g.description).join(', ') || "";

                    const cats = appData.categories?.map(c => c.description) || [];
                    if (cats.includes("Online Co-op") && cats.includes("Shared/Split Screen Co-op")) coop = "Local & Online";
                    else if (cats.includes("Online Co-op")) coop = "Online";
                    else if (cats.includes("Shared/Split Screen Co-op")) coop = "Local";
                    else if (cats.includes("Co-op")) coop = "Online/Local";
                    players = [cats.includes("Single-player") && "Single-player", cats.includes("Multi-player") && "Multi-player"].filter(Boolean).join(', ');
                    tags    = cats.slice(0, 5).join(", ");

                    // HLTB
                    try {
                        let hr = await searchHltb(gameName);
                        if (!hr.length) hr = await searchHltb(gameName.replace(/[:\-].*/, '').replace(/[™®©]/g, '').trim());
                        if (hr.length > 0 && hr[0].comp_main > 0) hltbResult = `${Math.round(hr[0].comp_main / 3600)} Hours`;
                    } catch(e) {}

                    // ProtonDB
                    try {
                        const pr = await fetch(`https://www.protondb.com/api/v1/reports/summaries/${appId}.json`);
                        if (pr.ok) { const pd = await pr.json(); if (pd.tier) protonResult = pd.tier.toUpperCase(); }
                    } catch(e) {}

                    // Cover (skip if already have a local file)
                    if (!dbCoverPath) {
                        const coverFileName = `${safeName} - Cover.jpg`;
                        const coverPath = path.join(imagesDir, coverFileName);
                        let coverOk = await downloadImage(`https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`, coverPath);
                        if (!coverOk && appData.header_image) coverOk = await downloadImage(appData.header_image, coverPath);
                        if (coverOk) dbCoverPath = `GameManagerConfig/images/${coverFileName}`;
                    }

                    // Hero (skip if already have a local file)
                    if (!dbHeroPath) {
                        const heroFileName = `${safeName} - Hero.jpg`;
                        if (await downloadImage(`https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_hero.jpg`, path.join(imagesDir, heroFileName)))
                            dbHeroPath = `GameManagerConfig/images/${heroFileName}`;
                    }

                    // Logo (skip if already have a local file)
                    if (!dbLogoPath) {
                        const logoFileName = `${safeName} - Logo.png`;
                        if (await downloadImage(`https://steamcdn-a.akamaihd.net/steam/apps/${appId}/logo.png`, path.join(imagesDir, logoFileName)))
                            dbLogoPath = `GameManagerConfig/images/${logoFileName}`;
                    }

                    // Screenshots (skip if already have local screenshots)
                    if (!dbScreenPath && appData.screenshots?.length > 0) {
                        const saved = [];
                        for (let i = 0; i < Math.min(5, appData.screenshots.length); i++) {
                            const fn = `${safeName} - Screen ${i+1}.jpg`;
                            if (await downloadImage(appData.screenshots[i].path_full, path.join(imagesDir, fn)))
                                saved.push(`GameManagerConfig/images/${fn}`);
                        }
                        if (saved.length) dbScreenPath = saved.join('|');
                    }

                    // Steam trailer
                    const movie = appData.movies?.[0];
                    if (movie) steamTrailerUrl = movie.mp4?.max || movie.webm?.max || movie.webm?.['480'] || "";
                }
            } catch(e) {}
        }

        // ── 3. SGDB FALLBACK — Hero Art & Logo ───────────────────────────
        const sgdbApiKey = db?.prepare("SELECT value FROM settings WHERE key='steamgriddb_api'").get()?.value;
        if (sgdbApiKey) {
            if (!dbHeroPath) dbHeroPath = await sgdbFetchFirst(gameName, sgdbApiKey, appId, 'hero') || "";
            if (!dbLogoPath) dbLogoPath = await sgdbFetchFirst(gameName, sgdbApiKey, appId, 'logo') || "";
        }

        // ── 4. IGDB ENRICHMENT ────────────────────────────────────────────
        let similarGames = "", franchise = "", igdbTrailerId = "";
        const igdb = await igdbSearch(gameName, appId);

        if (igdb) {
            // Similar games & franchise (for all games)
            if (igdb.similar_games?.length) similarGames = igdb.similar_games.map(g => g.name).slice(0, 6).join(', ');
            franchise = igdb.franchises?.[0]?.name || igdb.collection?.name || "";
            igdbTrailerId = igdb.videos?.[0]?.video_id || "";

            // Fill gaps — used when Steam failed or game is non-Steam
            if (!desc   && igdb.summary)               desc    = igdb.summary;
            if (!dev    && igdb.involved_companies)     dev     = igdb.involved_companies.filter(c => c.developer).map(c => c.company.name).join(', ');
            if (!pub    && igdb.involved_companies)     pub     = igdb.involved_companies.filter(c => c.publisher).map(c => c.company.name).join(', ');
            if (!genre  && igdb.genres)                 genre   = [...(igdb.genres?.map(g => g.name) || []), ...(igdb.themes?.map(t => t.name) || [])].slice(0, 3).join(', ');
            if (!released && igdb.first_release_date)   released = new Date(igdb.first_release_date * 1000).getFullYear().toString();
            if (!meta   && igdb.aggregated_rating)      meta    = Math.round(igdb.aggregated_rating).toString();

            // Discover Steam App ID for non-Steam games → enables ProtonDB
            if (!appId) {
                const steamExt = igdb.external_games?.find(e => e.category === 1);
                if (steamExt?.uid) {
                    appId = String(steamExt.uid).replace(/\.0+$/, '');
                    try {
                        const pr = await fetch(`https://www.protondb.com/api/v1/reports/summaries/${appId}.json`);
                        if (pr.ok) { const pd = await pr.json(); if (pd.tier) protonResult = pd.tier.toUpperCase(); }
                    } catch(e) {}
                }
            }

            // Cover from IGDB (fallback)
            if (!dbCoverPath && igdb.cover?.url) {
                const fn = `${safeName} - Cover.jpg`;
                if (await downloadImage(igdbImg(igdb.cover.url, 'cover_big'), path.join(imagesDir, fn)))
                    dbCoverPath = `GameManagerConfig/images/${fn}`;
            }

            // Screenshots from IGDB (fallback)
            if (!dbScreenPath && igdb.screenshots?.length) {
                const saved = [];
                for (let i = 0; i < Math.min(5, igdb.screenshots.length); i++) {
                    const fn = `${safeName} - Screen ${i+1}.jpg`;
                    if (await downloadImage(igdbImg(igdb.screenshots[i].url, 'screenshot_big'), path.join(imagesDir, fn)))
                        saved.push(`GameManagerConfig/images/${fn}`);
                }
                if (saved.length) dbScreenPath = saved.join('|');
            }
        }

        // ── 5. SAVE ───────────────────────────────────────────────────────
        if (!steamSuccess && !igdb) return { success: false, message: "No data found on Steam or IGDB." };

        const descI18n = await fetchDescI18n(appId, desc);
        db.prepare(`UPDATE games SET Description=?, SteamDesc=?, Description_i18n=?, DEV=?, PUB=?, RELEASED=?, METACRITIC=?, GENRE=?, CoverArt=?, HeroArt=?, Logo=?, Screenshot=?, SteamAppID=?, Coop=?, NumPlayers=?, Tags=?, HLTB_Main=?, ProtonTier=?, SteamTrailer=?, SimilarGames=?, Franchise=?, IGDBTrailer=? WHERE id=?`)
        .run(desc, htmlDesc, descI18n, dev, pub, released, meta, genre, dbCoverPath, dbHeroPath, dbLogoPath, dbScreenPath, appId || "", coop, players, tags, hltbResult, protonResult, steamTrailerUrl, similarGames, franchise, igdbTrailerId, gameId);

        const sources = [steamSuccess && 'Steam', igdb && 'IGDB'].filter(Boolean).join(' + ');
        return { success: true, message: `Data fetched via ${sources}!` };
    } catch (err) { return { success: false, message: `Scraping error: ${err.message}` }; }
});

ipcMain.handle('download-csv-template', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const { filePath } = await dialog.showSaveDialog(win, {
        title: 'Save CSV Template',
        defaultPath: 'GameManager_Template.csv',
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (filePath) {
        const headers = "Store,FAV,WANT_TO_PLAY,Game,LaunchCommand,GENRE,RELEASED,SteamAppID,ProtonTier,METACRITIC,HLTB_Main,DEV,PUB,Coop,NumPlayers,Tags,SimilarGames,HeroArt,Logo,Icon,SteamTrailer,SteamDesc,Description\n";
        fs.writeFileSync(filePath, headers, 'utf8');
        return { success: true, message: "Template generated successfully!" };
    }
    return { success: false };
});

ipcMain.handle('export-csv', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const { filePath } = await dialog.showSaveDialog(win, {
        title: 'Export Library to CSV',
        defaultPath: 'GameManager_Export.csv',
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (filePath) {
        try {
            const rows = db.prepare("SELECT Store, FAV, WANT_TO_PLAY, Game, LaunchCommand, GENRE, RELEASED, SteamAppID, ProtonTier, METACRITIC, HLTB_Main, DEV, PUB, Coop, NumPlayers, Tags, SimilarGames, HeroArt, Logo, Icon, SteamTrailer, SteamDesc, Description FROM games").all();

            let csvContent = "Store,FAV,WANT_TO_PLAY,Game,LaunchCommand,GENRE,RELEASED,SteamAppID,ProtonTier,METACRITIC,HLTB_Main,DEV,PUB,Coop,NumPlayers,Tags,SimilarGames,HeroArt,Logo,Icon,SteamTrailer,SteamDesc,Description\n";
            rows.forEach(r => {
                const safeStore = `"${(r.Store || '').replace(/"/g, '""')}"`;
                const safeFav = `"${(r.FAV || '').replace(/"/g, '""')}"`;
                const safeWant = `"${(r.WANT_TO_PLAY || '').replace(/"/g, '""')}"`;
                const safeGame = `"${(r.Game || '').replace(/"/g, '""')}"`;
                const safeLaunch = `"${(r.LaunchCommand || '').replace(/"/g, '""')}"`;
                const safeGenre = `"${(r.GENRE || '').replace(/"/g, '""')}"`;
                const safeRel = `"${(r.RELEASED || '').replace(/"/g, '""')}"`;
                const safeAppId = `"${(r.SteamAppID || '').replace(/"/g, '""')}"`;
                const safeProton = `"${(r.ProtonTier || '').replace(/"/g, '""')}"`;
                const safeMeta = `"${(r.METACRITIC || '').replace(/"/g, '""')}"`;
                const safeHltb = `"${(r.HLTB_Main || '').replace(/"/g, '""')}"`;
                const safeDev = `"${(r.DEV || '').replace(/"/g, '""')}"`;
                const safePub = `"${(r.PUB || '').replace(/"/g, '""')}"`;
                const safeCoop = `"${(r.Coop || '').replace(/"/g, '""')}"`;
                const safePlayers = `"${(r.NumPlayers || '').replace(/"/g, '""')}"`;
                const safeTags = `"${(r.Tags || '').replace(/"/g, '""')}"`;
                const safeSimilar = `"${(r.SimilarGames || '').replace(/"/g, '""')}"`;

                const safeHero = `"${(r.HeroArt || '').replace(/"/g, '""')}"`;
                const safeLogo = `"${(r.Logo || '').replace(/"/g, '""')}"`;
                const safeIcon = `"${(r.Icon || '').replace(/"/g, '""')}"`;
                const safeSteamTrailer = `"${(r.SteamTrailer || '').replace(/"/g, '""')}"`;
                const safeSteamDesc = `"${(r.SteamDesc || '').replace(/"/g, '""')}"`;
                const safeDesc = `"${(r.Description || '').replace(/"/g, '""')}"`;

                csvContent += `${safeStore},${safeFav},${safeWant},${safeGame},${safeLaunch},${safeGenre},${safeRel},${safeAppId},${safeProton},${safeMeta},${safeHltb},${safeDev},${safePub},${safeCoop},${safePlayers},${safeTags},${safeSimilar},${safeHero},${safeLogo},${safeIcon},${safeSteamTrailer},${safeSteamDesc},${safeDesc}\n`;
            });

            fs.writeFileSync(filePath, csvContent, 'utf8');
            return { success: true, message: "Library exported successfully!" };
        } catch (err) {
            return { success: false, message: `Export failed: ${err.message}` };
        }
    }
    return { success: false };
});

ipcMain.handle('import-csv', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const { filePaths } = await dialog.showOpenDialog(win, {
        title: 'Import CSV',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        properties: ['openFile']
    });

    if (filePaths && filePaths.length > 0) {
        try {
            const fileContent = fs.readFileSync(filePaths[0], 'utf8');

            const rows = [];
            let currentRow = [];
            let currentCell = "";
            let insideQuotes = false;

            for (let i = 0; i < fileContent.length; i++) {
                const char = fileContent[i];
                const nextChar = fileContent[i+1];

                if (char === '"' && insideQuotes && nextChar === '"') {
                    currentCell += '"'; i++;
                } else if (char === '"') {
                    insideQuotes = !insideQuotes;
                } else if (char === ',' && !insideQuotes) {
                    currentRow.push(currentCell.trim()); currentCell = "";
                } else if ((char === '\n' || char === '\r') && !insideQuotes) {
                    if (char === '\r' && nextChar === '\n') i++;
                    currentRow.push(currentCell.trim());
                    if (currentRow.length > 1 || currentRow[0] !== "") rows.push(currentRow);
                    currentRow = []; currentCell = "";
                } else {
                    currentCell += char;
                }
            }
            if (currentCell || currentRow.length > 0) {
                currentRow.push(currentCell.trim());
                rows.push(currentRow);
            }

            if (rows.length < 2) return { success: false, message: "CSV file appears empty or invalid." };

            const headers = rows[0].map(h => h.toLowerCase().replace(/ /g, '_'));
            const gameIdx = headers.indexOf('game');
            const storeIdx = headers.indexOf('store');

            if (gameIdx === -1) return { success: false, message: "CSV is missing the required 'Game' header." };

            let added = 0;
            let skipped = 0;

            const existingRows = db.prepare("SELECT LOWER(Game), LOWER(Store) FROM games").all();
            const existingCache = new Set(existingRows.map(r => `${r['LOWER(Game)']}|${r['LOWER(Store)'] || ''}`));

            const insertStmt = db.prepare(`INSERT INTO games (Store, FAV, WANT_TO_PLAY, Game, LaunchCommand, GENRE, RELEASED, SteamAppID, ProtonTier, METACRITIC, HLTB_Main, DEV, PUB, Coop, NumPlayers, Tags, SimilarGames, HeroArt, Logo, Icon, SteamTrailer, SteamDesc, Description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const gameName = row[gameIdx];
                const storeName = storeIdx !== -1 ? row[storeIdx] : '';

                if (!gameName) continue;

                const cacheKey = `${gameName.toLowerCase()}|${storeName.toLowerCase()}`;
                if (existingCache.has(cacheKey)) {
                    skipped++;
                    continue;
                }

                const getVal = (colName) => { const idx = headers.indexOf(colName.toLowerCase()); return idx !== -1 ? row[idx] : ""; };

                insertStmt.run(
                    storeName,
                    getVal('fav'),
                               getVal('want_to_play') || getVal('want to play'),
                               gameName,
                               getVal('launchcommand') || getVal('launch_command'),
                               getVal('genre'),
                               getVal('released') || getVal('released_(year)'),
                               getVal('steamappid') || getVal('steam_app_id'),
                               getVal('protontier') || getVal('protondb_tier') || getVal('proton_tier'),
                               getVal('metacritic') || getVal('metacritic_score'),
                               getVal('hltb_main') || getVal('hltb_(hours)'),
                               getVal('dev') || getVal('developer'),
                               getVal('pub') || getVal('publisher'),
                               getVal('coop') || getVal('co-op'),
                               getVal('numplayers') || getVal('players'),
                               getVal('tags'),
                               getVal('similargames') || getVal('similar_games'),
                               getVal('heroart') || getVal('hero_art'),
                               getVal('logo'),
                               getVal('icon'),
                               getVal('steamtrailer') || getVal('steam_trailer'),
                               getVal('steamdesc') || getVal('steam_desc'),
                               getVal('description')
                );

                added++;
                existingCache.add(cacheKey);
            }

            return { success: true, message: `Imported ${added} new games!\nSkipped ${skipped} duplicates.` };

        } catch (err) {
            return { success: false, message: `Import failed: ${err.message}` };
        }
    }
    return { success: false };
});
