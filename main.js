const { app, BrowserWindow, ipcMain, dialog, net, session } = require('electron');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const fs = require('fs');
const { exec, execFile, spawn } = require('child_process');

const hltb = require('howlongtobeat');
const hltbService = new hltb.HowLongToBeatService();

let baseDir;
if (process.env.APPIMAGE) {
    baseDir = path.dirname(process.env.APPIMAGE);
} else if (app.isPackaged) {
    baseDir = path.dirname(process.execPath);
} else {
    baseDir = __dirname;
}

const configDir = path.join(baseDir, 'GameManagerConfig');
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
        backgroundColor: '#121212',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
                                  contextIsolation: true,
                                  nodeIntegration: false,
                                  webSecurity: false
        }
    });

    win.setMenu(null);
    win.loadFile('index.html');
}

app.whenReady().then(() => {
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
    if (!fs.existsSync(trailersDir)) fs.mkdirSync(trailersDir, { recursive: true });

    try {
        db = new Database(dbPath);
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

        db.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`).run();
    } catch (err) {
        console.error("Could not connect to database:", err);
    }
    createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.on('window-minimize', () => { const win = BrowserWindow.getFocusedWindow(); if(win) win.minimize(); });
ipcMain.on('window-maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if(win) { if(win.isMaximized()) win.unmaximize(); else win.maximize(); }
});
ipcMain.on('window-close', () => { const win = BrowserWindow.getFocusedWindow(); if(win) win.close(); });

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

ipcMain.handle('add-game', () => {
    try {
        const info = db.prepare(`INSERT INTO games (Game, Store, LaunchCommand, FAV, WANT_TO_PLAY) VALUES ('New Game', '', '', 'NO', 'NO')`).run();
        return { success: true, id: info.lastInsertRowid };
    } catch (err) { return { success: false }; }
});

ipcMain.handle('update-game', (event, id, data) => {
    try {
        const stmt = db.prepare(`UPDATE games SET Game=?, Store=?, GENRE=?, RELEASED=?, LaunchCommand=?, FAV=?, WANT_TO_PLAY=?, METACRITIC=?, HLTB_Main=?, DEV=?, PUB=?, Coop=?, NumPlayers=?, Tags=?, SimilarGames=?, Description=?, SteamAppID=?, ProtonTier=?, HeroArt=?, Logo=?, Icon=?, SteamDesc=?, SteamTrailer=?, CoverArt=?, Screenshot=? WHERE id=?`);
        stmt.run(data.Game, data.Store, data.GENRE, data.RELEASED, data.LaunchCommand, data.FAV, data.WANT_TO_PLAY, data.METACRITIC, data.HLTB_Main, data.DEV, data.PUB, data.Coop, data.NumPlayers, data.Tags, data.SimilarGames, data.Description, data.SteamAppID, data.ProtonTier, data.HeroArt, data.Logo, data.Icon, data.SteamDesc, data.SteamTrailer, data.CoverArt, data.Screenshot, id);
        return true;
    } catch (err) { return false; }
});

ipcMain.handle('delete-game', (event, id) => {
    try { db.prepare(`DELETE FROM games WHERE id=?`).run(id); return true; } catch (err) { return false; }
});

ipcMain.on('launch-game', (event, cmd) => {
    if (!cmd) return;
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

// --- SYNC ENGINES ---
ipcMain.handle('sync-heroic', async () => {
    if (!db) return { success: false, message: "Database not initialized." };
    const home = os.homedir();
    let importedCount = 0;

    const heroicPaths = [
        { type: 'NATIVE', base: path.join(home, '.config', 'heroic'), cmdPrefix: 'heroic' },
               { type: 'FLATPAK', base: path.join(home, '.var', 'app', 'com.heroicgameslauncher.hgl', 'config', 'heroic'), cmdPrefix: 'flatpak run com.heroicgameslauncher.hgl' }
    ];

    const storeConfigs = [
        { name: 'EPIC', relInstalled: path.join('legendaryConfig', 'legendary', 'installed.json'), relLibraries: [ path.join('store_cache', 'legendary_library.json'), path.join('store_cache', 'epic_library.json'), path.join('store', 'epic', 'library.json') ], protocolId: 'epic' },
               { name: 'GOG', relInstalled: path.join('gog_store', 'installed.json'), relLibraries: [ path.join('store_cache', 'gog_library.json'), path.join('gog_store', 'library.json') ], protocolId: 'gog' },
               { name: 'AMAZON', relInstalled: path.join('nile_config', 'nile', 'installed.json'), relLibraries: [ path.join('nile_config', 'nile', 'library.json'), path.join('store_cache', 'amazon_library.json') ], protocolId: 'amazon' }
    ];

    for (const env of heroicPaths) {
        if (!fs.existsSync(env.base)) continue;
        for (const store of storeConfigs) {
            const gamesFound = new Map();

            for (const relLib of store.relLibraries) {
                const libraryJsonPath = path.join(env.base, relLib);
                if (fs.existsSync(libraryJsonPath)) {
                    try {
                        const rawData = fs.readFileSync(libraryJsonPath, 'utf8');
                        const libraryData = JSON.parse(rawData);
                        let items = [];
                        if (Array.isArray(libraryData)) items = libraryData;
                        else if (libraryData.library) items = libraryData.library;
                        else if (libraryData.games) items = libraryData.games;
                        else if (typeof libraryData === 'object') items = Object.values(libraryData);
                        for (const item of items) {
                            const appId = item.app_name || item.appName || item.id || item.name;
                            const title = item.title || item.name || item.appName;
                            if (appId && title) gamesFound.set(appId, title);
                        }
                    } catch (err) {}
                }
            }

            const targetJsonPath = path.join(env.base, store.relInstalled);
            if (fs.existsSync(targetJsonPath)) {
                try {
                    const rawData = fs.readFileSync(targetJsonPath, 'utf8');
                    const installedGames = JSON.parse(rawData);
                    for (const [appId, gameData] of Object.entries(installedGames)) {
                        if (gameData.title) gamesFound.set(appId, gameData.title);
                    }
                } catch (err) {}
            }

            for (const [appId, gameTitle] of gamesFound.entries()) {
                const launchCommand = `${env.cmdPrefix} "heroic://launch/${store.protocolId}/${appId}"`;

                const existing = db.prepare("SELECT * FROM games WHERE LaunchCommand = ? OR LOWER(Game) = LOWER(?)").get(launchCommand, gameTitle);

                if (existing) {
                    let stores = existing.Store ? existing.Store.split(',').map(s => s.trim()) : [];
                    if (!stores.some(s => s.toLowerCase() === store.name.toLowerCase())) stores.push(store.name);
                    db.prepare("UPDATE games SET LaunchCommand = ?, Store = ? WHERE id = ?").run(launchCommand, stores.join(', '), existing.id);
                } else {
                    db.prepare("INSERT INTO games (Game, Store, LaunchCommand, FAV, WANT_TO_PLAY) VALUES (?, ?, ?, 'NO', 'NO')").run(gameTitle, store.name, launchCommand);
                }
                importedCount++;
            }
        }
    }
    return { success: true, count: importedCount, message: `Successfully synced ${importedCount} games from Heroic.` };
});

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

            const existing = db.prepare("SELECT * FROM games WHERE LaunchCommand = ? OR LOWER(Game) = LOWER(?)").get(launchCommand, name);

            if (existing) {
                let stores = existing.Store ? existing.Store.split(',').map(s => s.trim()) : [];
                let needsUpdate = false;

                if (!stores.some(s => s.toLowerCase() === 'steam')) {
                    stores.push('Steam');
                    needsUpdate = true;
                }

                if (!existing.LaunchCommand || existing.LaunchCommand !== launchCommand || !existing.SteamAppID || existing.SteamAppID !== appid) {
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    db.prepare("UPDATE games SET LaunchCommand = ?, Store = ?, SteamAppID = ? WHERE id = ?").run(launchCommand, stores.join(', '), appid, existing.id);
                    updated++;
                }
            } else {
                insertStmt.run("Steam", name, appid, launchCommand);
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
    const query = `${gameName} gameplay trailer no commentary`;
    return new Promise((resolve) => {
        const args = [ '--config-location', ytDlpConfigPath, `ytsearch5:${query}`, '--print', '%(id)s|%(thumbnail)s|%(title)s' ];
        execFile(ytDlpPath, args, (error, stdout, stderr) => {
            if (error || !stdout) resolve([]);
            else {
                const lines = stdout.split('\n').filter(l => l.trim() !== "");
                const results = lines.map(line => { const parts = line.split('|'); return { id: parts[0], thumbnail: parts[1], title: parts.slice(2).join('|') }; });
                resolve(results);
            }
        });
    });
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
        let results = await hltbService.search(gameName);
        if (results.length === 0) {
            let cleanName = gameName.replace(/[:\-].*/, '').replace(/[™®©]/g, '').trim();
            results = await hltbService.search(cleanName);
        }
        if (results.length > 0 && results[0].gameplayMain > 0) return `${results[0].gameplayMain} Hours`;
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
        let appId = specificAppId;
        if (!appId) {
            const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`;
            const searchRes = await fetch(searchUrl);
            const searchData = await searchRes.json();
            if (!searchData.items || searchData.items.length === 0) return { success: false, message: "No match found on Steam." };
            appId = searchData.items[0].id;
        }

        const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}`;
        const detailsRes = await fetch(detailsUrl);
        const detailsData = await detailsRes.json();
        if (!detailsData[appId].success) return { success: false, message: "Failed to pull Steam metadata." };
        const appData = detailsData[appId].data;

        // Extracting standard metadata
        const desc = appData.short_description || "";
        const htmlDesc = appData.detailed_description || "";
        const dev = appData.developers ? appData.developers.join(', ') : "";
        const pub = appData.publishers ? appData.publishers.join(', ') : "";
        const released = appData.release_date && appData.release_date.date ? appData.release_date.date.slice(-4) : "";
        const meta = appData.metacritic ? String(appData.metacritic.score) : "";
        const genre = appData.genres ? appData.genres.map(g => g.description).join(', ') : "";

        const cats = appData.categories ? appData.categories.map(c => c.description) : [];
        let coop = "None";
        if (cats.includes("Online Co-op") && cats.includes("Shared/Split Screen Co-op")) coop = "Local & Online";
        else if (cats.includes("Online Co-op")) coop = "Online";
        else if (cats.includes("Shared/Split Screen Co-op")) coop = "Local";
        else if (cats.includes("Co-op")) coop = "Online/Local";

        let players = cats.includes("Single-player") ? "Single-player" : "";
        if (cats.includes("Multi-player")) players += (players ? ", Multi-player" : "Multi-player");
        let tags = cats.slice(0, 5).join(", ");

        // External API Calls
        let hltbResult = "";
        try {
            let hltbRes = await hltbService.search(gameName);
            if (hltbRes.length === 0) {
                let clean = gameName.replace(/[:\-].*/, '').replace(/[™®©]/g, '').trim();
                hltbRes = await hltbService.search(clean);
            }
            if (hltbRes.length > 0 && hltbRes[0].gameplayMain > 0) hltbResult = `${hltbRes[0].gameplayMain} Hours`;
        } catch(e) {}

        let protonResult = "";
        try {
            const pRes = await fetch(`https://www.protondb.com/api/v1/reports/summaries/${appId}.json`);
            if (pRes.ok) {
                const pData = await pRes.json();
                if (pData.tier) protonResult = pData.tier.toUpperCase();
            }
        } catch(e) {}

        // Asset Downloads
        const safeName = gameName.replace(/[\\/:*?"<>|#]/g, '').trim();

        // 1. Cover
        const coverFileName = `${safeName} - Cover.jpg`;
        const coverPath = path.join(imagesDir, coverFileName);
        let coverDownloaded = await downloadImage(`https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900.jpg`, coverPath);
        if (!coverDownloaded && appData.header_image) coverDownloaded = await downloadImage(appData.header_image, coverPath);
        const dbCoverPath = coverDownloaded ? `GameManagerConfig/images/${coverFileName}` : "";

        // 2. Hero
        const heroFileName = `${safeName} - Hero.jpg`;
        const heroPath = path.join(imagesDir, heroFileName);
        let heroDownloaded = await downloadImage(`https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_hero.jpg`, heroPath);
        const dbHeroPath = heroDownloaded ? `GameManagerConfig/images/${heroFileName}` : "";

        // 3. Logo
        const logoFileName = `${safeName} - Logo.png`;
        const logoPath = path.join(imagesDir, logoFileName);
        let logoDownloaded = await downloadImage(`https://steamcdn-a.akamaihd.net/steam/apps/${appId}/logo.png`, logoPath);
        const dbLogoPath = logoDownloaded ? `GameManagerConfig/images/${logoFileName}` : "";

        // 4. Screenshots
        let savedScreenshots = [];
        if (appData.screenshots && appData.screenshots.length > 0) {
            for (let i = 0; i < Math.min(5, appData.screenshots.length); i++) {
                const screenFileName = `${safeName} - Screen ${i+1}.jpg`;
                const screenPath = path.join(imagesDir, screenFileName);
                if (await downloadImage(appData.screenshots[i].path_full, screenPath)) {
                    savedScreenshots.push(`GameManagerConfig/images/${screenFileName}`);
                }
            }
        }
        const dbScreenPath = savedScreenshots.length > 0 ? savedScreenshots.join('|') : "";

        let steamTrailerUrl = "";
        if (appData.movies && appData.movies.length > 0) {
            const movie = appData.movies[0]; // grab the main trailer
            if (movie.mp4 && movie.mp4.max) steamTrailerUrl = movie.mp4.max;
            else if (movie.webm && movie.webm.max) steamTrailerUrl = movie.webm.max;
            else if (movie.webm && movie.webm['480']) steamTrailerUrl = movie.webm['480'];
        }

        // Save everything!
        db.prepare(`UPDATE games SET Description=?, SteamDesc=?, DEV=?, PUB=?, RELEASED=?, METACRITIC=?, GENRE=?, CoverArt=?, HeroArt=?, Logo=?, Screenshot=?, SteamAppID=?, Coop=?, NumPlayers=?, Tags=?, HLTB_Main=?, ProtonTier=?, SteamTrailer=? WHERE id=?`)
        .run(desc, htmlDesc, dev, pub, released, meta, genre, dbCoverPath, dbHeroPath, dbLogoPath, dbScreenPath, appId, coop, players, tags, hltbResult, protonResult, steamTrailerUrl, gameId);

        return { success: true, message: "Metadata, Art Assets, Trailer URL, HLTB & ProtonDB successfully downloaded!" };
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
                               getVal('hltb_main') || getVal('hltb_(hours)') || getVal('hltb_main'),
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
