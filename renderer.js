let allGames = [];
let currentGameId = null;

function isManualCategory(game) {
    const s = (game.Store || '').toLowerCase();
    return /physical|others|emulation|apps/.test(s) && !/steam|epic|gog|heroic/.test(s);
}

function openAddCmdDialog(gameId, gameName) {
    const modal = document.getElementById('modal-add-cmd');
    const input = document.getElementById('add-cmd-input');
    input.value = '';
    modal.classList.add('active');
    setTimeout(() => input.focus(), 50);
    document.getElementById('add-cmd-save').onclick = async () => {
        const cmd = input.value.trim();
        if (!cmd) return;
        await window.api.setLaunchCommand(gameId, cmd);
        modal.classList.remove('active');
        await loadGames();
    };
    document.getElementById('add-cmd-cancel').onclick = () => modal.classList.remove('active');
}

function getInstallCommand(game) {
    const cmd = game.LaunchCommand || '';
    // Heroic: use the heroic:// URL — Heroic shows install prompt when not installed
    if (/heroic:\/\/launch/i.test(cmd)) {
        const m = cmd.match(/heroic:\/\/launch\/[^"\s]+/i);
        return m ? m[0] : null;
    }
    // Steam: use install protocol
    if (/steam:\/\/rungameid/i.test(cmd) && game.SteamAppID && String(game.SteamAppID).trim() !== '' && String(game.SteamAppID) !== 'None') {
        return `steam://install/${String(game.SteamAppID).replace(/\.0+$/, '')}`;
    }
    return null;
}

// ── Now Playing popup ─────────────────────────────────────────────────────────
let _npTimer = null;

function showNowPlaying(game) {
    const modal    = document.getElementById('modal-now-playing');
    const artBg    = document.getElementById('np-art-bg');
    const logoImg  = document.getElementById('np-logo-img');
    const coverImg = document.getElementById('np-cover-img');
    const artWrap  = document.getElementById('np-art');
    const titleEl  = document.getElementById('np-title');
    if (!modal) return;

    titleEl.textContent = game.Game || '';

    const logo  = game.Logo     ? getSafePath(game.Logo)     : null;
    const cover = game.CoverArt ? getSafePath(game.CoverArt) : null;
    const hero  = game.HeroArt  ? getSafePath(game.HeroArt)  : null;

    logoImg.style.display  = 'none';
    coverImg.style.display = 'none';
    artBg.style.backgroundImage = '';

    if (logo) {
        artWrap.style.display = 'flex';
        logoImg.src = logo; logoImg.style.display = '';
        if (cover || hero) artBg.style.backgroundImage = `url('${cover || hero}')`;
    } else if (cover) {
        artWrap.style.display = 'flex';
        coverImg.src = cover; coverImg.style.display = '';
        artBg.style.backgroundImage = `url('${cover}')`;
    } else {
        artWrap.style.display = 'none';
    }

    modal.classList.add('active');
    clearTimeout(_npTimer);
    _npTimer = setTimeout(closeNowPlaying, 5000);
}

function closeNowPlaying() {
    clearTimeout(_npTimer);
    document.getElementById('modal-now-playing')?.classList.remove('active');
}

document.getElementById('modal-now-playing')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-now-playing')) closeNowPlaying();
});
document.getElementById('np-close-btn')?.addEventListener('click', closeNowPlaying);
// ─────────────────────────────────────────────────────────────────────────────

async function verifyAndLaunch(gameId, launchCmd) {
    const game = allGames.find(g => g.id == gameId);
    if (game) showNowPlaying(game);

    if (game?.GrinderGameId && !game?.prefer_heroic) {
        const s = await window.api.grinderStatus();
        if (s.found && s.path) {
            window.api.launchGame(`"${s.path}" launch ${game.GrinderGameId}`);
            Promise.all([window.api.updateLastPlayed(gameId), window.api.verifyInstallStatus(gameId)]).then(() => loadGames());
            return;
        }
    }
    window.api.launchGame(launchCmd);
    Promise.all([window.api.updateLastPlayed(gameId), window.api.verifyInstallStatus(gameId)]).then(() => loadGames());
}

window.api.onInstallStatusUpdated(() => loadGames());
let currentLaunchCmd = '';
let currentFilter = 'all';
let lastGridView = 'view-gallery';
let baseDir = '';

let strings = {};
let currentLang = 'en';
function t(key, vars = {}) {
  const val = key.split('.').reduce((o, k) => o?.[k], strings);
  if (!val) return key;
  return String(val).replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? vars[k] : `{${k}}`);
}
// ── Custom alert / confirm dialogs ────────────────────────────────────────────
const _dlg        = document.getElementById('modal-dialog');
const _dlgBody    = document.getElementById('modal-dialog-body');
const _dlgOk      = document.getElementById('modal-dialog-ok');
const _dlgCancel  = document.getElementById('modal-dialog-cancel');

function _openDialog(body, okLabel, isDanger, showCancel) {
    return new Promise(resolve => {
        _dlgBody.textContent = body;
        _dlgOk.textContent   = okLabel;
        _dlgOk.className     = isDanger ? '' : 'primary';
        _dlgOk.style.cssText = isDanger
            ? 'flex:1; background:rgba(198,40,40,0.15); border:1px solid #c62828; color:#ef5350;'
            : 'flex:1;';
        _dlgCancel.style.display = showCancel ? '' : 'none';
        _dlg.classList.add('active');
        const done = r => {
            _dlg.classList.remove('active');
            _dlgOk.onclick = _dlgCancel.onclick = _dlg.onclick = null;
            resolve(r);
        };
        _dlgOk.onclick     = () => done(true);
        _dlgCancel.onclick = () => done(false);
        _dlg.onclick       = e => { if (e.target === _dlg) done(false); };
    });
}
function showAlert(body)                            { return _openDialog(body, 'OK',     false, false); }
function showConfirm(body, okLabel = 'Confirm', isDanger = false) { return _openDialog(body, okLabel, isDanger, true); }
// ─────────────────────────────────────────────────────────────────────────────

function getLocalizedDescription(game) {
  if (game.Description_i18n) {
    try { const d = JSON.parse(game.Description_i18n); return d[currentLang] || d['en'] || game.Description || ''; } catch(e) {}
  }
  return game.Description || '';
}

function applyI18nToDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = t(el.getAttribute('data-i18n')); if (v) el.textContent = v; });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { const v = t(el.getAttribute('data-i18n-html')); if (v) el.innerHTML = v; });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { const v = t(el.getAttribute('data-i18n-ph')); if (v) el.placeholder = v; });
}

window.api.getSetting('language').then(lang => {
  currentLang = lang || 'en';
  window.api.getStrings(currentLang).then(s => { strings = s; applyI18nToDOM(); });
});

window.api.checkCrema().then(exists => {
    if (exists) document.getElementById('btn-launch-crema').style.display = 'flex';
});
document.getElementById('btn-launch-crema').addEventListener('click', () => window.api.launchCrema());

// Local variable to hold our gaming history limit preference
let recentGamesCount = 0;
let detailScreenshotInterval = null;
let heroKbInterval = null;
let ssBannerKbInterval = null; // FIX: New Ken Burns interval for the Screenshots Banner

// Language selector logic
window.api.getSetting('language').then(activeLang => {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === (activeLang || 'en'));
        btn.addEventListener('click', async () => {
            const lang = btn.getAttribute('data-lang');
            await window.api.setSetting('language', lang);
            document.body.style.transition = 'opacity 0.15s ease';
            document.body.style.opacity = '0';
            setTimeout(() => window.location.reload(), 160);
        });
    });
});

// SAFE: We only load games AFTER we have the correct base directory path
window.api.getBaseDir().then(dir => {
    baseDir = dir;

    // Load the UI Scale preference at startup
    window.api.getSetting('cngm_ui_scale').then(val => {
        if (val) {
            window.api.setZoomLevel(parseFloat(val));
            document.querySelectorAll('.ui-scale-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-val') === val);
            });
        } else {
            const defaultBtn = document.querySelector('.ui-scale-btn[data-val="1.0"]');
            if(defaultBtn) defaultBtn.classList.add('active');
        }
    });

    // Load the gaming history preference at startup
    window.api.getSetting('recent_games_count').then(val => {
        if (val) {
            recentGamesCount = parseInt(val, 10);
            document.querySelectorAll('#history-segmented-control .segmented-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-val') === val);
            });
        }
        loadGames();
    });
});

// Segmented Control Logic for Gaming History
document.querySelectorAll('#history-segmented-control .segmented-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        document.querySelectorAll('#history-segmented-control .segmented-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const val = e.target.getAttribute('data-val');
        recentGamesCount = parseInt(val, 10);
        await window.api.setSetting('recent_games_count', val);
        applyFilters();
    });
});

// Segmented Control Logic for UI Scaling
document.querySelectorAll('.ui-scale-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        document.querySelectorAll('.ui-scale-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const val = e.target.getAttribute('data-val');
        window.api.setZoomLevel(parseFloat(val));
        await window.api.setSetting('cngm_ui_scale', val);
    });
});

// Clear Gaming History Logic
document.getElementById('btn-clear-history').addEventListener('click', async () => {
    if (await showConfirm(t('confirm.clear_history'), 'Clear', true)) {
        const success = await window.api.clearHistory();
        if (success) { await loadGames(); await showAlert(t('alert.history_cleared')); }
    }
});

// Split internal App assets from external user data & handle absolute paths securely
function getSafePath(rawPath) {
    if (!rawPath) return '';
    let p = String(rawPath).replace(/\\/g, '/');

    // Route User Data to EXTERNAL baseDir
    if (p.startsWith('GameManagerConfig') && baseDir) {
        p = baseDir + '/' + p;
        if (!p.startsWith('/')) p = '/' + p;
        return 'file://' + encodeURI(p).replace(/#/g, '%23').replace(/\?/g, '%3F');
    }
    else if (p.startsWith('~') && baseDir) {
        p = p.replace('~/GameAppBuild', baseDir);
        if (p.startsWith('~')) p = baseDir + p.substring(1);
        if (!p.startsWith('/')) p = '/' + p;
        return 'file://' + encodeURI(p).replace(/#/g, '%23').replace(/\?/g, '%3F');
    }

    // Catch absolute paths (Linux/macOS starts with '/' or Windows starts with 'C:/')
    if (p.startsWith('/') || /^[a-zA-Z]:\//.test(p)) {
        return 'file://' + encodeURI(p).replace(/#/g, '%23').replace(/\?/g, '%3F');
    }

    // Internal ASSETS remain relative so they load securely from inside the AppImage
    return encodeURI(p).replace(/#/g, '%23').replace(/\?/g, '%3F');
}

// --- WINDOW CONTROLS ---
document.getElementById('btn-min').addEventListener('click', () => window.api.minimizeApp());
document.getElementById('btn-max').addEventListener('click', () => window.api.maximizeApp());
document.getElementById('btn-close').addEventListener('click', () => window.api.closeApp());

document.getElementById('btn-view-list').addEventListener('click', () => switchView('view-list'));
document.getElementById('btn-view-gallery').addEventListener('click', () => switchView('view-gallery'));
document.getElementById('btn-refresh-library').addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh-library');
    btn.style.animation = 'spin 0.6s linear';
    setTimeout(() => { btn.style.animation = ''; }, 650);
    await syncGrinderInstalled();
    loadGames();
});

document.getElementById('btn-gamepage-back').addEventListener('click', () => {
    applyFilters();
    switchView('view-gallery');
});

document.getElementById('btn-back-to-gamepage').addEventListener('click', () => {
    clearInterval(detailScreenshotInterval);
    const game = allGames.find(g => g.id === currentGameId);
    if (game) openGamepage(game); else switchView('view-gallery');
});

document.getElementById('btn-gamepage-edit').addEventListener('click', () => {
    const game = allGames.find(g => g.id === currentGameId);
    if(game) openDetails(game);
});

// --- ABOUT BUTTON LOGIC ---
document.getElementById('btn-about').addEventListener('click', () => { document.getElementById('modal-about').classList.add('active'); });
document.getElementById('btn-close-about').addEventListener('click', () => { document.getElementById('modal-about').classList.remove('active'); });

// --- MANUAL (opens as separate window) ---
document.addEventListener('click', (e) => { if (e.target.id === 'btn-open-manual') { document.getElementById('modal-about').classList.remove('active'); window.api.openManual(); } });
document.getElementById('btn-tools-manual').addEventListener('click', () => { document.getElementById('modal-tools').classList.remove('active'); window.api.openManual(); });

// --- FIRST-RUN WELCOME ---
// Shown every launch unless the user has checked "Don't show again"
// (stored in the settings DB, not localStorage, so a fresh GameManagerConfig always shows it).
const _welcomeModal = document.getElementById('modal-welcome');

function dismissWelcome() {
    _welcomeModal.classList.remove('active');
    if (document.getElementById('chk-welcome-noshow').checked) {
        window.api.setSetting('welcome_shown', '1');
    }
}

// Only these two buttons close the modal
document.getElementById('btn-welcome-done').addEventListener('click', dismissWelcome);
document.getElementById('btn-welcome-manual').addEventListener('click', () => { dismissWelcome(); window.api.openManual(); });

// ── Step 1: Heroic sync (inline, no close) ──────────────────────────────────
// Welcome screen — GRINDER status check
(async () => {
    const statusEl = document.getElementById('wlc-grinder-status');
    const openBtn  = document.getElementById('btn-welcome-open-grinder');
    if (!statusEl) return;
    const s = await window.api.grinderStatus();
    if (s.found) {
        const total = s.allGames?.length ?? s.installedGames?.length ?? 0;
        statusEl.style.color = '#66bb6a';
        statusEl.textContent = `✓ GRINDER connected — ${total} game${total !== 1 ? 's' : ''} in library`;
    } else {
        statusEl.style.color = 'var(--text_dim)';
        statusEl.textContent = 'GRINDER.AppImage not found — place it in the same folder as CNGM.';
    }
    if (openBtn) {
        openBtn.style.display = s.found ? '' : 'none';
        openBtn.addEventListener('click', () => window.api.openGrinder());
    }
})();

// ── Step 1: Steam sync (inline, no close) ───────────────────────────────────
document.getElementById('btn-welcome-sync-steam').addEventListener('click', async () => {
    const steamId = document.getElementById('wlc-steam-id').value.trim();
    const apiKey  = document.getElementById('wlc-steam-api-key').value.trim();
    const btn     = document.getElementById('btn-welcome-sync-steam');
    const status  = document.getElementById('wlc-steam-status');
    if (!steamId || !apiKey) {
        status.style.color = '#f57c00';
        status.textContent = '⚠ Enter both SteamID64 and API Key.';
        return;
    }
    await window.api.setSetting('steam_id', steamId);
    await window.api.setSetting('steam_api_key', apiKey);
    // Mirror into the Connect modal fields so they're pre-filled when opened later
    document.getElementById('steam-id').value = steamId;
    document.getElementById('steam-api-key').value = apiKey;
    btn.disabled = true;
    btn.textContent = t('status.fetching');
    status.style.color = 'var(--text_dim)';
    status.textContent = 'Fetching Steam library…';
    const result = await window.api.syncSteam(steamId, apiKey);
    if (result.success) loadGames();
    btn.disabled = false;
    btn.textContent = 'Fetch Steam Library';
    status.style.color = result.success ? '#66bb6a' : '#ef5350';
    status.textContent = result.success ? '✓ Steam library synced!' : '✗ ' + result.message;
});

// ── Step 2: Batch fetch (inline progress, no close) ─────────────────────────
document.getElementById('btn-welcome-batch').addEventListener('click', async () => {
    const btn          = document.getElementById('btn-welcome-batch');
    const statusEl     = document.getElementById('wlc-batch-status');
    const progressWrap = document.getElementById('wlc-batch-progress-wrap');
    const progressFill = document.getElementById('wlc-batch-progress-fill');
    const hasImg  = v => v && String(v).startsWith('GameManagerConfig');
    const hasTxt  = v => v && String(v).trim() !== '';
    const toFetch = allGames.filter(g =>
        !hasImg(g.CoverArt) || !hasImg(g.HeroArt) || !hasImg(g.Logo) ||
        !hasImg(g.Icon) || !hasImg(g.Screenshot) ||
        !hasTxt(g.Description) || !hasTxt(g.DEV) || !hasTxt(g.GENRE));
    if (toFetch.length === 0) { statusEl.style.color = '#66bb6a'; statusEl.textContent = '✓ All games are already up to date!'; return; }
    btn.disabled = true;
    progressWrap.style.display = 'block';
    progressFill.style.width = '0%';
    for (let i = 0; i < toFetch.length; i++) {
        const g = toFetch[i];
        statusEl.style.color = 'var(--text_dim)';
        statusEl.textContent = `Fetching ${i + 1} / ${toFetch.length}: ${g.Game}…`;
        progressFill.style.width = `${Math.round(((i + 1) / toFetch.length) * 100)}%`;
        await window.api.autoFetch(g.id, g.Game, g.SteamAppID);
        await new Promise(r => setTimeout(r, 500));
    }
    progressFill.style.width = '100%';
    statusEl.style.color = '#66bb6a';
    statusEl.textContent = `✓ Finished fetching ${toFetch.length} games!`;
    setTimeout(() => { progressWrap.style.display = 'none'; progressFill.style.width = '0%'; }, 3000);
    btn.disabled = false;
    loadGames();
});

// ── Step 3: SteamGridDB key (inline, no close) ──────────────────────────────
document.getElementById('btn-welcome-save-sgdb').addEventListener('click', async () => {
    const key    = document.getElementById('wlc-sgdb-key').value.trim();
    const status = document.getElementById('wlc-sgdb-status');
    if (!key) { status.style.color = '#f57c00'; status.textContent = '⚠ Paste your API key above.'; return; }
    await window.api.setSetting('steamgriddb_api', key);
    // Mirror into the SGDB api modal input
    document.getElementById('sgdb-api-input').value = key;
    status.style.color = '#66bb6a';
    status.textContent = '✓ SteamGridDB key saved!';
});

// ── Step 3: IGDB credentials (inline, no close) ─────────────────────────────
document.getElementById('btn-welcome-save-igdb').addEventListener('click', async () => {
    const clientId = document.getElementById('wlc-igdb-client-id').value.trim();
    const secret   = document.getElementById('wlc-igdb-client-secret').value.trim();
    const status   = document.getElementById('wlc-igdb-status');
    if (!clientId || !secret) { status.style.color = '#f57c00'; status.textContent = '⚠ Enter both Client ID and Secret.'; return; }
    await window.api.setSetting('igdb_client_id', clientId);
    await window.api.setSetting('igdb_client_secret', secret);
    await window.api.setSetting('igdb_token', '');
    await window.api.setSetting('igdb_token_expiry', '0');
    // Mirror into the Connect modal fields
    document.getElementById('igdb-client-id').value = clientId;
    document.getElementById('igdb-client-secret').value = '••••••••';
    status.style.color = 'var(--text_dim)';
    status.textContent = 'Testing connection…';
    const result = await window.api.igdbTest();
    status.style.color = result.success ? '#66bb6a' : '#ef5350';
    status.textContent = (result.success ? '✓ ' : '✗ ') + result.message;
});

// ── Tools menu: re-open welcome screen ──────────────────────────────────────
document.getElementById('btn-show-welcome').addEventListener('click', () => {
    document.getElementById('modal-tools').classList.remove('active');
    // Reset the "don't show again" flag and uncheck the box so the user starts fresh
    window.api.setSetting('welcome_shown', '');
    document.getElementById('chk-welcome-noshow').checked = false;
    _welcomeModal.classList.add('active');
});

// ── Step 5: Add to system menu (inline, no close) ───────────────────────────
document.getElementById('btn-welcome-add-menu').addEventListener('click', async () => {
    const btn    = document.getElementById('btn-welcome-add-menu');
    const status = document.getElementById('wlc-menu-status');
    btn.disabled = true;
    btn.textContent = 'Installing…';
    status.style.color = 'var(--text_dim)';
    status.textContent = 'Registering shortcuts…';
    const result = await window.api.installToMenu();
    btn.disabled = false;
    btn.textContent = 'Add to Application Menu';
    status.style.color = result.success ? '#66bb6a' : '#ef5350';
    status.textContent = (result.success ? '✓ ' : '✗ ') + result.message;
});

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(viewId);
    target.classList.add('active');
    target.scrollTop = 0;

    // Ensure video pauses when leaving the view
    const vp = document.getElementById('detail-video-player');
    if (vp) vp.pause();

    if (viewId !== 'view-gamepage') clearInterval(ssBannerKbInterval);
    if (viewId !== 'view-gallery') clearInterval(heroKbInterval);
    if (viewId !== 'view-details') clearInterval(detailScreenshotInterval);
    if (viewId === 'view-gallery' || viewId === 'view-list') lastGridView = viewId;
}

// Debounced loadGames — collapses rapid successive calls (e.g. from two parallel .then() chains)
// into a single DB fetch 80ms after the last call, invisible to the user.
let _lgTimer = null;
function loadGames() {
    clearTimeout(_lgTimer);
    return new Promise(resolve => {
        _lgTimer = setTimeout(async () => {
            const res = await window.api.getGames();
            let games = res.games || [];
            allGames = games.filter(g => g.Game && g.Game !== 'null');
            applyFilters();
            resolve();
        }, 80);
    });
}

document.getElementById('search-bar').addEventListener('input', applyFilters);

const filterButtons = document.querySelectorAll('#sidebar-filters button');
filterButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
        filterButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.getAttribute('data-filter');
        if (currentFilter === 'flatpak') {
            const scanResult = await window.api.scanFlatpak();
            await loadGames();
            if (scanResult.iconMap && Object.keys(scanResult.iconMap).length > 0)
                generateFlatpakArt(scanResult.iconMap);
        }
        applyFilters();
        const active = document.querySelector('.view.active');
        if (active && (active.id === 'view-gamepage' || active.id === 'view-details')) {
            switchView(lastGridView);
        }
    });
});

function applyFilters() {
    const query = document.getElementById('search-bar').value.toLowerCase();

    let filtered = allGames.filter(game => {
        let matchesCategory = true;
        const storeLower = (game.Store || '').toLowerCase();

        if (currentFilter === 'playable') matchesCategory = !!game.LaunchCommand;
        else if (currentFilter === 'favs') matchesCategory = game.FAV === 'YES';
        else if (currentFilter === 'want') matchesCategory = game.WANT_TO_PLAY === 'YES';
        else if (currentFilter === 'steam') matchesCategory = storeLower.includes('steam');
        else if (currentFilter === 'epic') matchesCategory = storeLower.includes('epic');
        else if (currentFilter === 'gog') matchesCategory = storeLower.includes('gog');
        else if (currentFilter === 'physical') matchesCategory = storeLower.includes('physical');
        else if (currentFilter === 'flatpak') matchesCategory = storeLower.includes('flatpak');
        else if (currentFilter === 'apps') matchesCategory = storeLower.includes('apps');
        else if (currentFilter === 'others') matchesCategory = storeLower.includes('others');
        else if (currentFilter === 'emulation') matchesCategory = storeLower.includes('emulation');
        else if (currentFilter === 'installed') {
            const cat = (game.Store || '').toLowerCase();
            const isManual = cat.includes('others') || cat.includes('emulation') || cat.includes('physical') || cat.includes('apps');
            matchesCategory = isManual ? !!game.LaunchCommand : game.Installed == 1;
        }

        if (!matchesCategory) return false;
        if (!query) return true;

        const globalMatch = Object.values(game).some(val => String(val).toLowerCase().includes(query));
        return globalMatch;
    });

    if (query) {
        filtered.sort((a, b) => {
            const aName = (a.Game || '').toLowerCase().includes(query);
            const bName = (b.Game || '').toLowerCase().includes(query);
            if (aName && !bName) return -1;
            if (!aName && bName) return 1;
            return 0;
        });
    }

    updateHeroMosaic(filtered, currentFilter);

    let recentGames = [];
    let regularGames = [...filtered];

    if (recentGamesCount > 0) {
        let playedGames = filtered.filter(g => g.LastPlayed && g.LastPlayed > 0).sort((a, b) => b.LastPlayed - a.LastPlayed);
        recentGames = playedGames.slice(0, recentGamesCount);
        const recentIds = new Set(recentGames.map(g => g.id));
        regularGames = filtered.filter(g => !recentIds.has(g.id));
    }

    renderTable(recentGames, regularGames);
    renderGallery(recentGames, regularGames);
}

function renderTable(recent, regular) {
    const tbody = document.getElementById('list-tbody');
    tbody.innerHTML = '';

    const appendRow = (game) => {
        const tr = document.createElement('tr');
        tr.style.cursor = "pointer";
        let displayStore = game.Store ? game.Store.replace(/EPIC/i, 'Epic').replace(/GOG/i, 'GOG') : '';
        const isInstalled = game.Installed == null || game.Installed == 1;
        const storeLc = (game.Store || '').toLowerCase();
        const isGrinderStore = storeLc.includes('gog') || storeLc.includes('epic');
        const installCmd = getInstallCommand(game);
        let actionCell;
        if (game.LaunchCommand) {
            actionCell = isInstalled
                ? `<button class="primary btn-play" data-cmd="${game.LaunchCommand.replace(/"/g, '&quot;')}" data-id="${game.id}" style="padding: 4px 8px;">${t('status.play')}</button>`
                : (isGrinderStore
                    ? `<button class="btn-install" data-grinder="1" data-name="${game.Game.replace(/"/g, '&quot;')}" data-id="${game.id}" style="padding: 4px 8px;">${t('status.install')}</button>`
                    : (installCmd ? `<button class="btn-install" data-url="${installCmd}" data-id="${game.id}" style="padding: 4px 8px;">${t('status.install')}</button>` : `<span style="color:#555; font-size:12px;">${t('status.not_installed')}</span>`));
        } else if (isManualCategory(game)) {
            actionCell = `<button class="btn-install" data-addcmd="1" data-id="${game.id}" data-name="${game.Game.replace(/"/g, '&quot;')}" style="padding: 4px 8px;">${t('status.install')}</button>`;
        } else {
            actionCell = `<span style="color:#555; font-size:12px;">${t('game.no_cmd')}</span>`;
        }
        tr.innerHTML = `
        <td>${actionCell}</td>
        <td style="color: #ffeb3b;">${game.FAV === 'YES' ? '★' : ''}</td>
        <td style="color: #ff9800;">${game.WANT_TO_PLAY === 'YES' ? '⚑' : ''}</td>
        <td style="font-weight: bold;">${game.Game}</td>
        <td>${displayStore}</td>
        <td>${game.GENRE || ''}</td>
        <td>${game.RELEASED || ''}</td>
        `;
        tr.dataset.id = game.id;
        tbody.appendChild(tr);
    };

    if (recent && recent.length > 0) {
        const trLabel = document.createElement('tr');
        trLabel.innerHTML = `<td colspan="7" style="background: var(--bg_menu); color: var(--accent); font-weight: 900; letter-spacing: 2px; text-align: center;">${t('recent.header')}</td>`;
        tbody.appendChild(trLabel);
        recent.forEach(appendRow);

        const trAll = document.createElement('tr');
        trAll.innerHTML = `<td colspan="7" style="background: var(--bg_menu); color: var(--text_sec); font-weight: 900; letter-spacing: 2px; text-align: center;">${t('filter.all')}</td>`;
        tbody.appendChild(trAll);
    }
    regular.forEach(appendRow);

}

// ── Table event delegation (set up once) ──────────────────────────────────────
const _tbody = document.getElementById('list-tbody');
_tbody.addEventListener('click', (e) => {
    const play = e.target.closest('.btn-play');
    if (play) { e.stopPropagation(); verifyAndLaunch(play.dataset.id, play.dataset.cmd); return; }
    const install = e.target.closest('.btn-install');
    if (install) { e.stopPropagation(); install.dataset.addcmd ? openAddCmdDialog(install.dataset.id, install.dataset.name) : install.dataset.grinder ? window.api.openGrinder(install.dataset.name) : window.api.openInstallUrl(install.dataset.url); }
});
_tbody.addEventListener('dblclick', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) { const g = allGames.find(x => String(x.id) === tr.dataset.id); if (g) openGamepage(g); }
});

// ── FLATPAK ART GENERATION ───────────────────────────────────────────────

async function generateFlatpakArt(iconMap) {
    for (const [gameId, iconName] of Object.entries(iconMap)) {
        const iconPath = await window.api.findFlatpakIcon(iconName);
        if (!iconPath) continue;

        const b64 = await window.api.readFileBase64(iconPath);
        if (!b64) continue;

        const isSvg = iconPath.endsWith('.svg');
        const dataUrl = `data:image/${isSvg ? 'svg+xml' : 'png'};base64,${b64}`;

        const img = await new Promise(resolve => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => resolve(null);
            el.src = dataUrl;
        });
        if (!img) continue;

        const color = _flatpakExtractColor(img);
        const coverB64 = _flatpakDrawCover(img, color);
        const heroB64  = _flatpakDrawHero(color);

        await window.api.saveFlatpakArt(Number(gameId), coverB64, heroB64, iconPath);

        // Update in-memory game so the gallery refreshes without a full reload
        const g = allGames.find(x => x.id == gameId);
        if (g) { g.CoverArt = '__pending__'; } // triggers re-render on next loadGames
    }
    if (Object.keys(iconMap).length > 0) await loadGames();
}

function _flatpakExtractColor(img) {
    const c = document.createElement('canvas');
    c.width = c.height = 48;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 48, 48);
    const d = ctx.getImageData(0, 0, 48, 48).data;
    let r = 0, g = 0, b = 0, n = 0;
    let maxSat = -1, sr = 80, sg = 100, sb = 180;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i+3] < 100) continue;
        const pr = d[i], pg = d[i+1], pb = d[i+2];
        r += pr; g += pg; b += pb; n++;
        const mx = Math.max(pr,pg,pb), mn = Math.min(pr,pg,pb);
        const sat = mx < 20 ? 0 : (mx - mn) / mx;
        if (sat > maxSat && mx > 40) { maxSat = sat; sr = pr; sg = pg; sb = pb; }
    }
    // Prefer the most saturated color; fall back to average if icon is mostly greyscale
    if (n === 0) return [80, 100, 180];
    return maxSat > 0.25 ? [sr, sg, sb] : [Math.round(r/n), Math.round(g/n), Math.round(b/n)];
}

function _flatpakGradient(ctx, w, h, r, g, b, dir = 'diagonal') {
    const d1 = `rgb(${Math.round(r*.10)},${Math.round(g*.10)},${Math.round(b*.10)})`;
    const d2 = `rgb(${Math.round(r*.22)},${Math.round(g*.22)},${Math.round(b*.22)})`;
    const grad = dir === 'horizontal'
        ? ctx.createLinearGradient(0,0,w,0)
        : ctx.createLinearGradient(0,0,w,h);
    grad.addColorStop(0, d1); grad.addColorStop(1, d2);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    // Radial glow
    const glow = ctx.createRadialGradient(w/2,h/2,0, w/2,h/2, Math.max(w,h)*.55);
    glow.addColorStop(0, `rgba(${r},${g},${b},.32)`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
}

function _flatpakDrawCover(img, [r,g,b]) {
    const c = document.createElement('canvas');
    c.width = 600; c.height = 900;
    const ctx = c.getContext('2d');
    _flatpakGradient(ctx, 600, 900, r, g, b, 'diagonal');
    const sz = 380;
    ctx.drawImage(img, (600-sz)/2, (900-sz)/2, sz, sz);
    return c.toDataURL('image/png').split(',')[1];
}

function _flatpakDrawHero([r,g,b]) {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 400;
    const ctx = c.getContext('2d');
    _flatpakGradient(ctx, 1200, 400, r, g, b, 'horizontal');
    return c.toDataURL('image/png').split(',')[1];
}

// ─────────────────────────────────────────────────────────────────────────────

function getStoreLogo(store) {
    if (!store) return null;
    const s = store.toLowerCase();
    if (s.includes('steam'))    return 'assets/logos/steam.png';
    if (s.includes('gog'))      return 'assets/logos/gog.png';
    if (s.includes('epic'))     return 'assets/logos/epic.png';
    if (s.includes('flatpak'))  return 'assets/logos/flatpak.svg';
    if (s.includes('physical')) return 'assets/logos/physical.png';
    if (s.includes('emulat'))   return 'assets/logos/emulation.png';
    if (s.includes('app'))      return 'assets/logos/apps.png';
    if (s.includes('other'))    return 'assets/logos/others.png';
    return null;
}

function renderGallery(recent, regular) {
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = '';

    const appendCard = (game) => {
        const div = document.createElement('div');
        div.className = 'gallery-item';
        const imgSrc = game.CoverArt ? getSafePath(game.CoverArt) : '';
        const imgHtml = imgSrc ? `<img src="${imgSrc}" class="gallery-cover" loading="lazy">` : `<div class="gallery-cover" style="display:flex; align-items:center; justify-content:center; color:#555; font-size:12px;">${t('game.no_cover')}</div>`;
        const logo = getStoreLogo(game.Store);
        const badgeHtml = logo ? `<div class="gallery-store-badge" style="-webkit-mask-image: url('${logo}');"></div>` : '';
        const isInstalled = game.Installed == null || game.Installed == 1;
        const dotHtml = game.LaunchCommand ? `<div class="install-dot ${isInstalled ? 'is-installed' : 'not-installed'}" title="${isInstalled ? t('status.installed') : t('status.not_installed')}"></div>` : '';
        let actionBtn = '';
        if (game.LaunchCommand) {
            if (isInstalled) {
                actionBtn = `<button class="btn-play-gallery primary" data-cmd="${game.LaunchCommand.replace(/"/g, '&quot;')}" data-id="${game.id}" style="margin: 5px; font-size: 12px; padding: 4px;">${t('status.play')}</button>`;
            } else {
                const stL = (game.Store || '').toLowerCase();
                if (stL.includes('gog') || stL.includes('epic')) {
                    actionBtn = `<button class="btn-install-gallery" data-grinder="1" data-name="${game.Game.replace(/"/g, '&quot;')}" data-id="${game.id}" style="margin: 5px; font-size: 12px; padding: 4px;">${t('status.install')}</button>`;
                } else {
                    const installCmd = getInstallCommand(game);
                    actionBtn = installCmd ? `<button class="btn-install-gallery" data-url="${installCmd}" data-id="${game.id}" style="margin: 5px; font-size: 12px; padding: 4px;">${t('status.install')}</button>` : '';
                }
            }
        } else if (isManualCategory(game)) {
            actionBtn = `<button class="btn-install-gallery" data-addcmd="1" data-id="${game.id}" data-name="${game.Game.replace(/"/g, '&quot;')}" style="margin: 5px; font-size: 12px; padding: 4px;">${t('status.install')}</button>`;
        }
        div.innerHTML = `
        <div class="gallery-cover-wrap">${imgHtml}${dotHtml}${badgeHtml}</div>
        <div class="gallery-title">${game.Game}</div>
        ${actionBtn}
        `;
        div.dataset.id = game.id;
        grid.appendChild(div);
    };

    if (recent && recent.length > 0) {
        const label = document.createElement('div');
        label.style.gridColumn = "1 / -1";
        label.style.background = "var(--bg_menu)";
        label.style.color = "var(--accent)";
        label.style.padding = "10px";
        label.style.fontWeight = "900";
        label.style.letterSpacing = "2px";
        label.style.textAlign = "center";
        label.style.borderRadius = "8px";
        label.style.border = "1px solid var(--border_solid)";
        label.innerText = t('recent.header');
        grid.appendChild(label);
        recent.forEach(appendCard);

        const labelAll = document.createElement('div');
        labelAll.style.gridColumn = "1 / -1";
        labelAll.style.background = "var(--bg_menu)";
        labelAll.style.color = "var(--text_sec)";
        labelAll.style.padding = "10px";
        labelAll.style.fontWeight = "900";
        labelAll.style.letterSpacing = "2px";
        labelAll.style.textAlign = "center";
        labelAll.style.borderRadius = "8px";
        labelAll.style.border = "1px solid var(--border_solid)";
        labelAll.innerText = t('filter.all');
        grid.appendChild(labelAll);
    }
    regular.forEach(appendCard);

}

// ── Gallery event delegation (set up once) ────────────────────────────────────
const _grid = document.getElementById('gallery-grid');
_grid.addEventListener('click', (e) => {
    const play = e.target.closest('.btn-play-gallery');
    if (play) { e.stopPropagation(); verifyAndLaunch(play.dataset.id, play.dataset.cmd); return; }
    const install = e.target.closest('.btn-install-gallery');
    if (install) { e.stopPropagation(); install.dataset.addcmd ? openAddCmdDialog(install.dataset.id, install.dataset.name) : install.dataset.grinder ? window.api.openGrinder(install.dataset.name) : window.api.openInstallUrl(install.dataset.url); }
});
_grid.addEventListener('dblclick', (e) => {
    const item = e.target.closest('.gallery-item[data-id]');
    if (item) { const g = allGames.find(x => String(x.id) === item.dataset.id); if (g) openGamepage(g); }
});

// --- THE IMMERSIVE GAMEPAGE LOGIC ---
function openGamepage(game) {
    currentGameId = game.id;
    currentLaunchCmd = game.LaunchCommand || '';

    const heroEl = document.getElementById('gamepage-hero');
    const logoEl = document.getElementById('gamepage-logo');
    const titleTextEl = document.getElementById('gamepage-title-text');
    const coverEl = document.getElementById('gamepage-cover');
    const playBtn = document.getElementById('btn-gamepage-play');
    const trailerBtn = document.getElementById('btn-gamepage-trailer');
    const grinderBtn = document.getElementById('btn-gamepage-grinder');

    const favBtn = document.getElementById('btn-gamepage-fav');
    const wantBtn = document.getElementById('btn-gamepage-want');

    // Hero Art — always reset to none first so the previous game's image
    // is cleared immediately, before the new URL starts loading.
    heroEl.style.backgroundImage = "none";
    if (game.HeroArt && game.HeroArt.trim() !== "") {
        heroEl.style.backgroundImage = `url('${getSafePath(game.HeroArt)}')`;
    } else if (game.Screenshot && game.Screenshot.trim() !== "") {
        const screens = String(game.Screenshot).split('|').filter(s => s.trim() !== "");
        heroEl.style.backgroundImage = `url('${getSafePath(screens[0])}')`;
    }

    // Logo vs Text
    if (game.Logo && game.Logo.trim() !== "") {
        logoEl.src = getSafePath(game.Logo);
        logoEl.style.display = 'block';
        titleTextEl.style.display = 'none';
    } else {
        logoEl.style.display = 'none';
        titleTextEl.innerText = game.Game;
        titleTextEl.style.display = 'block';
    }

    // Store Logos
    const storeContainer = document.getElementById('gamepage-store-container');
    storeContainer.innerHTML = '';
    if (game.Store && String(game.Store).trim() !== "") {
        const stores = String(game.Store).split(',').map(s => s.trim().toLowerCase().replace(/\s+/g, '_')).filter(s => s !== "");
        stores.forEach(s => {
            const div = document.createElement('div');
            const path = getSafePath('assets/logos/' + s + '.png');
            div.style.width = '30px'; div.style.height = '30px';
            div.style.backgroundColor = 'var(--text_sec)';
            div.style.webkitMaskSize = 'contain'; div.style.webkitMaskPosition = 'center'; div.style.webkitMaskRepeat = 'no-repeat';
            div.style.webkitMaskImage = `url('${path}')`;
            div.style.filter = "drop-shadow(0 2px 5px rgba(0,0,0,0.8))";
            storeContainer.appendChild(div);
        });
    }

    // Live Toggle Logic for Favs / Wants
    const updateTogglesUI = () => {
        favBtn.classList.toggle('active', game.FAV === 'YES');
        favBtn.innerText = game.FAV === 'YES' ? t('fav.on') : t('fav.off');

        wantBtn.classList.toggle('active', game.WANT_TO_PLAY === 'YES');
        wantBtn.innerText = game.WANT_TO_PLAY === 'YES' ? t('want.on') : t('want.off');
    };
    updateTogglesUI();

    favBtn.onclick = async () => {
        game.FAV = game.FAV === 'YES' ? 'NO' : 'YES';
        updateTogglesUI();
        await window.api.updateGame(game.id, game); // Silently updates DB
        loadGames(); // Refreshes lists in the background
    };

    wantBtn.onclick = async () => {
        game.WANT_TO_PLAY = game.WANT_TO_PLAY === 'YES' ? 'NO' : 'YES';
        updateTogglesUI();
        await window.api.updateGame(game.id, game);
        loadGames();
    };

    // Play / Install / Add Command Button
    if (currentLaunchCmd) {
        playBtn.style.display = 'block';
        const isInstalled = game.Installed == null || game.Installed == 1;
        if (isInstalled) {
            playBtn.innerText = t('status.play');
            playBtn.className = 'primary';
            playBtn.onclick = () => verifyAndLaunch(currentGameId, currentLaunchCmd);
        } else {
            const store = (game.Store || '').toLowerCase();
            const isGrinderStore = store.includes('gog') || store.includes('epic');
            playBtn.innerText = t('status.install');
            playBtn.className = 'btn-install-primary';
            playBtn.style.display = 'block';
            if (isGrinderStore) {
                playBtn.onclick = () => window.api.openGrinder(game.Game);
            } else {
                const installCmd = getInstallCommand(game);
                playBtn.onclick = installCmd ? () => window.api.openInstallUrl(installCmd) : null;
                if (!installCmd) playBtn.style.display = 'none';
            }
        }
    } else if (isManualCategory(game)) {
        playBtn.style.display = 'block';
        playBtn.innerText = t('status.install');
        playBtn.className = 'btn-install-primary';
        playBtn.onclick = () => openAddCmdDialog(currentGameId, game.Game);
    } else {
        playBtn.style.display = 'none';
        playBtn.onclick = null;
    }

    // GRINDER setup button — GOG and Epic games only
    const gpStore = (game.Store || '').toLowerCase();
    if (gpStore.includes('gog') || gpStore.includes('epic')) {
        grinderBtn.style.display = 'block';
        grinderBtn.onclick = () => window.api.openGrinder(game.Game);
    } else {
        grinderBtn.style.display = 'none';
        grinderBtn.onclick = null;
    }

    // Local Trailer Only Logic
    trailerBtn.style.display = 'none';
    trailerBtn.onclick = null;
    const trailerGameId = game.id;
    window.api.checkLocalTrailer(game.Game).then(localUrl => {
        if (localUrl && currentGameId === trailerGameId) {
            trailerBtn.style.display = 'block';
            trailerBtn.onclick = () => {
                document.getElementById('modal-trailer-player').classList.add('active');
                const vid = document.getElementById('detail-video-player');
                vid.src = localUrl;
                vid.play();
            };
        }
    });

    // Info Column
    coverEl.src = (game.CoverArt && game.CoverArt.trim() !== "") ? getSafePath(game.CoverArt) : 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

    document.getElementById('gp-released').innerText = game.RELEASED || "--";
    document.getElementById('gp-dev').innerText = game.DEV || "--";
    document.getElementById('gp-pub').innerText = game.PUB || "--";
    document.getElementById('gp-genre').innerText = game.GENRE || "--";
    document.getElementById('gp-hltb').innerText = game.HLTB_Main || "--";

    const metaEl = document.getElementById('gp-meta');
    metaEl.innerText = game.METACRITIC || "--";
    metaEl.style.color = "var(--text_main)";
    if (game.METACRITIC) {
        let sc = parseInt(game.METACRITIC, 10);
        if (sc >= 80) metaEl.style.color = "#00ff00";
        else if (sc >= 60) metaEl.style.color = "#ffd700";
        else metaEl.style.color = "#ff0000";
    }

    const pEl = document.getElementById('gp-proton');
    pEl.innerText = game.ProtonTier || "--";
    pEl.style.color = "var(--text_main)";
    if (game.ProtonTier) {
        let t = game.ProtonTier.toUpperCase();
        if (t.includes("PLATINUM")) pEl.style.color = "#00e5ff";
        else if (t.includes("GOLD")) pEl.style.color = "#ffd700";
        else if (t.includes("SILVER")) pEl.style.color = "#c0c0c0";
        else if (t.includes("BORKED")) pEl.style.color = "#ff0000";
        else if (t.includes("NATIVE")) pEl.style.color = "#00ff00";
    }

    document.getElementById('gp-coop').innerText = game.Coop || "--";
    document.getElementById('gp-players').innerText = game.NumPlayers || "--";
    const similarEl = document.getElementById('gp-similar');
    if (!game.SimilarGames || !game.SimilarGames.trim() || game.SimilarGames === '--') {
        similarEl.innerText = '--';
    } else {
        const names = game.SimilarGames.split(',').map(n => n.trim()).filter(Boolean);
        similarEl.innerHTML = names.map(name => {
            const match = allGames.find(g => g.Game.toLowerCase() === name.toLowerCase());
            return match
                ? `<span class="similar-link" data-id="${match.id}" title="Open ${name}">${name}</span>`
                : `<span>${name}</span>`;
        }).join(', ');
        similarEl.querySelectorAll('.similar-link').forEach(el => {
            el.addEventListener('click', () => {
                const g = allGames.find(g => g.id === parseInt(el.dataset.id));
                if (g) openGamepage(g);
            });
        });
    }
    document.getElementById('gp-franchise').innerText = game.Franchise || "--";

    // FIX: Screenshots Slideshow Logic with beautiful Ken Burns Effect
    const ssBanner = document.getElementById('gamepage-screenshots-banner');
    const ssKbImg = document.getElementById('gamepage-ss-kb-img');
    const modalSs = document.getElementById('modal-slideshow');
    const ssImg = document.getElementById('slideshow-img');
    const ssCounter = document.getElementById('slideshow-counter');

    clearInterval(ssBannerKbInterval);

    if (game.Screenshot && game.Screenshot.trim() !== "") {
        const screens = String(game.Screenshot).split('|').filter(s => s.trim() !== "");
        if (screens.length > 0) {
            ssBanner.style.display = 'block';

            // Ken Burns setup
            ssKbImg.style.display = 'block';
            let kbIdx = 0;
            const showNextSsImage = () => {
                ssKbImg.style.opacity = '0';
                setTimeout(() => {
                    if (document.getElementById('view-gamepage').classList.contains('active')) {
                        ssKbImg.src = getSafePath(screens[kbIdx]);
                        ssKbImg.style.opacity = '1';
                        kbIdx = (kbIdx + 1) % screens.length;
                    }
                }, 500);
            };
            showNextSsImage();

            if (screens.length > 1) {
                ssBannerKbInterval = setInterval(showNextSsImage, 5000);
            }

            ssBanner.onclick = () => {
                let currentIdx = 0;

                const updateSlide = () => {
                    ssImg.src = getSafePath(screens[currentIdx]);
                    ssCounter.innerText = `${currentIdx + 1} / ${screens.length}`;
                };

                updateSlide();
                modalSs.classList.add('active');

                document.getElementById('btn-slideshow-prev').onclick = () => {
                    currentIdx = (currentIdx - 1 + screens.length) % screens.length;
                    updateSlide();
                };

                document.getElementById('btn-slideshow-next').onclick = () => {
                    currentIdx = (currentIdx + 1) % screens.length;
                    updateSlide();
                };
            };
        } else {
            ssBanner.style.display = 'none';
        }
    } else {
        ssBanner.style.display = 'none';
    }

    document.getElementById('btn-slideshow-close').onclick = () => {
        modalSs.classList.remove('active');
    };

    // FIX: Inject the Short Description above the Steam Description
    const shortDescContainer = document.getElementById('gamepage-short-desc');
    const localDesc = getLocalizedDescription(game);
    if (localDesc && localDesc.trim() !== "") {
        shortDescContainer.innerText = localDesc;
        shortDescContainer.style.display = 'block';
    } else {
        shortDescContainer.style.display = 'none';
    }

    // Rich HTML Description vs Fallback Text
    const steamDescContainer = document.getElementById('gamepage-steam-desc');
    const fallbackDescContainer = document.getElementById('gamepage-fallback-desc');

    if (game.SteamDesc && game.SteamDesc.trim() !== "") {
        steamDescContainer.innerHTML = game.SteamDesc;
        steamDescContainer.style.display = 'block';
        fallbackDescContainer.style.display = 'none';
    } else {
        steamDescContainer.style.display = 'none';
        fallbackDescContainer.innerText = t('game.no_desc');
        // Only show fallback if we also didn't have a short description
        fallbackDescContainer.style.display = (localDesc && localDesc.trim() !== "") ? 'none' : 'block';
    }

    switchView('view-gamepage');
}


// --- DETAILED VIEW / EDIT LOGIC ---
function openDetails(game) {
    currentGameId = game.id;
    currentLaunchCmd = game.LaunchCommand || '';
    let displayStore = game.Store ? game.Store.replace(/EPIC/i, 'Epic').replace(/GOG/i, 'GOG') : '';

    document.getElementById('edit-name').value = game.Game || '';
    document.getElementById('edit-store').value = displayStore;
    document.getElementById('edit-launch').value = game.LaunchCommand || '';
    document.getElementById('edit-genre').value = game.GENRE || '';
    document.getElementById('edit-released').value = game.RELEASED || '';
    document.getElementById('edit-appid').value = game.SteamAppID || '';
    document.getElementById('edit-proton').value = game.ProtonTier || '';
    document.getElementById('edit-meta').value = game.METACRITIC || '';
    document.getElementById('edit-hltb').value = game.HLTB_Main || '';
    document.getElementById('edit-dev').value = game.DEV || '';
    document.getElementById('edit-pub').value = game.PUB || '';
    document.getElementById('edit-coop').value = game.Coop || '';
    document.getElementById('edit-players').value = game.NumPlayers || '';
    document.getElementById('edit-tags').value = game.Tags || '';
    document.getElementById('edit-similar').value = game.SimilarGames || '';
    document.getElementById('edit-franchise').value = game.Franchise || '';
    document.getElementById('edit-desc').value = game.Description || '';

    document.getElementById('edit-fav').checked = game.FAV === 'YES';
    document.getElementById('edit-want').checked = game.WANT_TO_PLAY === 'YES';

    updateGrinderRow(game);

    // Populate Left Column Asset Previews
    const coverDiv = document.getElementById('ui-cover');
    if (game.CoverArt && game.CoverArt.trim() !== "") { coverDiv.innerHTML = `<img src="${getSafePath(game.CoverArt)}" style="width: 100%; height: 100%; object-fit: cover;">`; } else { coverDiv.innerHTML = 'Cover Art'; }

    const heroDiv = document.getElementById('ui-hero');
    if (game.HeroArt && game.HeroArt.trim() !== "") { heroDiv.innerHTML = `<img src="${getSafePath(game.HeroArt)}" style="width: 100%; height: 100%; object-fit: cover;">`; } else { heroDiv.innerHTML = 'Hero Art'; }

    const logoDiv = document.getElementById('ui-logo');
    if (game.Logo && game.Logo.trim() !== "") { logoDiv.innerHTML = `<img src="${getSafePath(game.Logo)}" style="width: 100%; height: 100%; object-fit: contain; padding: 10px;">`; } else { logoDiv.innerHTML = 'Logo'; }

    const iconDiv = document.getElementById('ui-icon');
    if (game.Icon && game.Icon.trim() !== "") { iconDiv.innerHTML = `<img src="${getSafePath(game.Icon)}" style="width: 100%; height: 100%; object-fit: contain; padding: 10px;">`; } else { iconDiv.innerHTML = 'Icon'; }

    clearInterval(detailScreenshotInterval);
    const screenDiv = document.getElementById('ui-screenshot');
    if (game.Screenshot && game.Screenshot.trim() !== "") {
        const screens = String(game.Screenshot).split('|').filter(s => s.trim() !== "");
        if (screens.length > 0) {
            screenDiv.innerHTML = `<img id=\"detail-ss-img\" src=\"${getSafePath(screens[0])}\" style=\"width: 100%; height: 100%; object-fit: cover; transition: opacity 0.5s ease;\">`;
            if (screens.length > 1) {
                let ssIdx = 0;
                detailScreenshotInterval = setInterval(() => {
                    const imgEl = document.getElementById('detail-ss-img');
                    if (!imgEl) { clearInterval(detailScreenshotInterval); return; }
                    imgEl.style.opacity = '0';
                    setTimeout(() => { ssIdx = (ssIdx + 1) % screens.length; imgEl.src = getSafePath(screens[ssIdx]); imgEl.style.opacity = '1'; }, 500);
                }, 4000);
            }
        } else { screenDiv.innerHTML = 'Screenshot'; }
    } else { screenDiv.innerHTML = 'Screenshot'; }

    switchView('view-details');
}

// --- ASSET DELETERS ---
document.getElementById('btn-delete-cover').addEventListener('click', () => { const g = allGames.find(g => g.id === currentGameId); if(g) { g.CoverArt = ""; document.getElementById('ui-cover').innerHTML = 'Cover Art'; } });
document.getElementById('btn-delete-hero').addEventListener('click', () => { const g = allGames.find(g => g.id === currentGameId); if(g) { g.HeroArt = ""; document.getElementById('ui-hero').innerHTML = 'Hero Art'; } });
document.getElementById('btn-delete-logo').addEventListener('click', () => { const g = allGames.find(g => g.id === currentGameId); if(g) { g.Logo = ""; document.getElementById('ui-logo').innerHTML = 'Logo'; } });
document.getElementById('btn-delete-icon').addEventListener('click', () => { const g = allGames.find(g => g.id === currentGameId); if(g) { g.Icon = ""; document.getElementById('ui-icon').innerHTML = 'Icon'; } });
document.getElementById('btn-delete-screenshot').addEventListener('click', () => { clearInterval(detailScreenshotInterval); const g = allGames.find(g => g.id === currentGameId); if(g) { g.Screenshot = ""; document.getElementById('ui-screenshot').innerHTML = 'Screenshot'; } });

document.getElementById('btn-delete-trailer').addEventListener('click', async () => {
    const gameName = document.getElementById('edit-name').value;
    if (!gameName) return;
    const success = await window.api.deleteTrailer(gameName);
    await showAlert(success ? t('alert.trailer_deleted') : t('alert.no_trailer'));
});

document.getElementById('btn-clear-meta').addEventListener('click', () => {
    document.getElementById('edit-genre').value = ""; document.getElementById('edit-released').value = "";
    document.getElementById('edit-appid').value = ""; document.getElementById('edit-proton').value = "";
    document.getElementById('edit-meta').value = ""; document.getElementById('edit-hltb').value = "";
    document.getElementById('edit-dev').value = ""; document.getElementById('edit-pub').value = "";
    document.getElementById('edit-coop').value = ""; document.getElementById('edit-players').value = "";
    document.getElementById('edit-tags').value = ""; document.getElementById('edit-similar').value = ""; document.getElementById('edit-franchise').value = "";
    document.getElementById('edit-desc').value = "";
});


// --- LOCAL ASSET SELECTORS ---
async function handleLocalAsset(type, targetDivId, objFit = 'cover', doPadding = false) {
    if (!currentGameId) return;
    const newPath = await window.api.selectLocalImage(currentGameId, type);
    if (newPath) {
        const div = document.getElementById(targetDivId);
        let padStr = doPadding ? 'padding: 10px;' : '';
        div.innerHTML = `<img src="${getSafePath(newPath)}" style="width: 100%; height: 100%; object-fit: ${objFit}; ${padStr}">`;
        const game = allGames.find(g => g.id === currentGameId);
        if (game) {
            if(type === 'cover') game.CoverArt = newPath;
            else if(type === 'hero') game.HeroArt = newPath;
            else if(type === 'logo') game.Logo = newPath;
            else if(type === 'icon') game.Icon = newPath;
            else if(type === 'screenshot') { clearInterval(detailScreenshotInterval); game.Screenshot = newPath; }
        }
    }
}
document.getElementById('btn-local-cover').addEventListener('click', () => handleLocalAsset('cover', 'ui-cover', 'cover'));
document.getElementById('btn-local-hero').addEventListener('click', () => handleLocalAsset('hero', 'ui-hero', 'cover'));
document.getElementById('btn-local-logo').addEventListener('click', () => handleLocalAsset('logo', 'ui-logo', 'contain', true));
document.getElementById('btn-local-icon').addEventListener('click', () => handleLocalAsset('icon', 'ui-icon', 'contain', true));
document.getElementById('btn-local-screenshot').addEventListener('click', () => handleLocalAsset('screenshot', 'ui-screenshot', 'cover'));


// --- SGDB DYNAMIC FETCHERS ---
let currentSgdbAssetType = 'cover';

async function triggerSgdbModal(assetType) {
    const apiKey = await window.api.getSetting('steamgriddb_api');
    if (!apiKey) { document.getElementById('modal-sgdb-api').classList.add('active'); return; }
    document.getElementById('sgdb-manual-search-input').value = "";
    openSgdbModal(apiKey, assetType, null);
}

document.getElementById('btn-sgdb-cover').addEventListener('click', () => triggerSgdbModal('cover'));
document.getElementById('btn-sgdb-hero').addEventListener('click', () => triggerSgdbModal('hero'));
document.getElementById('btn-sgdb-logo').addEventListener('click', () => triggerSgdbModal('logo'));
document.getElementById('btn-sgdb-icon').addEventListener('click', () => triggerSgdbModal('icon'));

document.getElementById('btn-save-sgdb-api').addEventListener('click', async () => {
    const key = document.getElementById('sgdb-api-input').value.trim();
    if (key) {
        await window.api.setSetting('steamgriddb_api', key);
        document.getElementById('modal-sgdb-api').classList.remove('active');
        openSgdbModal(key, currentSgdbAssetType, null);
    }
});

document.getElementById('btn-close-sgdb-api').addEventListener('click', () => { document.getElementById('modal-sgdb-api').classList.remove('active'); });
document.getElementById('btn-close-sgdb').addEventListener('click', () => { document.getElementById('modal-sgdb').classList.remove('active'); });

document.getElementById('btn-sgdb-manual-search').addEventListener('click', async () => {
    const query = document.getElementById('sgdb-manual-search-input').value.trim();
    if (query) {
        const apiKey = await window.api.getSetting('steamgriddb_api');
        openSgdbModal(apiKey, currentSgdbAssetType, query);
    }
});

async function openSgdbModal(apiKey, assetType, manualQuery) {
    currentSgdbAssetType = assetType;
    document.getElementById('modal-sgdb').classList.add('active');
    const grid = document.getElementById('sgdb-grid');
    const stat = document.getElementById('sgdb-status');
    grid.innerHTML = '';
    stat.innerText = t('sgdb.searching', {type: assetType.toUpperCase()});

    const capturedGameId = currentGameId;
    const gameName = manualQuery || document.getElementById('edit-name').value;
    const appId = manualQuery ? null : document.getElementById('edit-appid').value;

    const results = await window.api.sgdbSearch(gameName, apiKey, appId, assetType);

    if (results.length === 0) { stat.innerText = t('sgdb.no_art'); return; }

    stat.innerText = t('sgdb.select', {type: assetType.toUpperCase()});
    results.forEach(res => {
        const img = document.createElement('img');
        img.src = res.thumb;
        img.style.width = "100%";
        img.style.borderRadius = "8px";
        img.style.cursor = "pointer";
        img.style.border = "2px solid transparent";
        img.style.transition = "transform 0.2s, border 0.2s";

        if (assetType === 'logo' || assetType === 'icon') {
            img.style.objectFit = 'contain';
            img.style.background = 'rgba(0,0,0,0.5)';
            img.style.padding = '10px';
        }

        img.addEventListener('mouseover', () => { img.style.transform = "scale(1.05)"; img.style.borderColor = "var(--accent)"; });
        img.addEventListener('mouseout', () => { img.style.transform = "scale(1)"; img.style.borderColor = "transparent"; });

        img.addEventListener('click', async () => {
            stat.innerText = t('sgdb.downloading');
            grid.style.opacity = "0.5"; grid.style.pointerEvents = "none";

            const newPath = await window.api.sgdbApply(capturedGameId, res.url, assetType);
            if (newPath) {
                const game = allGames.find(g => g.id === capturedGameId);
                if (game) {
                    if (assetType === 'cover') {
                        game.CoverArt = newPath;
                        document.getElementById('ui-cover').innerHTML = `<img src="${getSafePath(newPath)}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    } else if (assetType === 'hero') {
                        game.HeroArt = newPath;
                        document.getElementById('ui-hero').innerHTML = `<img src="${getSafePath(newPath)}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    } else if (assetType === 'logo') {
                        game.Logo = newPath;
                        document.getElementById('ui-logo').innerHTML = `<img src="${getSafePath(newPath)}" style="width: 100%; height: 100%; object-fit: contain; padding: 10px;">`;
                    } else if (assetType === 'icon') {
                        game.Icon = newPath;
                        document.getElementById('ui-icon').innerHTML = `<img src="${getSafePath(newPath)}" style="width: 100%; height: 100%; object-fit: contain; padding: 10px;">`;
                    }
                }
                document.getElementById('modal-sgdb').classList.remove('active');
            } else {
                stat.innerText = t('sgdb.failed');
            }
            grid.style.opacity = "1"; grid.style.pointerEvents = "";
        });
        grid.appendChild(img);
    });
}

// --- SAVE & AUTO-FETCH LOGIC ---
document.getElementById('btn-save-game').addEventListener('click', async () => {
    if (!currentGameId) return;
    const game = allGames.find(g => g.id === currentGameId);

    const data = {
        Game: document.getElementById('edit-name').value,
                                                          Store: document.getElementById('edit-store').value,
                                                          LaunchCommand: document.getElementById('edit-launch').value,
                                                          GENRE: document.getElementById('edit-genre').value,
                                                          RELEASED: document.getElementById('edit-released').value,
                                                          SteamAppID: document.getElementById('edit-appid').value,
                                                          ProtonTier: document.getElementById('edit-proton').value,
                                                          METACRITIC: document.getElementById('edit-meta').value,
                                                          HLTB_Main: document.getElementById('edit-hltb').value,
                                                          DEV: document.getElementById('edit-dev').value,
                                                          PUB: document.getElementById('edit-pub').value,
                                                          Coop: document.getElementById('edit-coop').value,
                                                          NumPlayers: document.getElementById('edit-players').value,
                                                          Tags: document.getElementById('edit-tags').value,
                                                          SimilarGames: document.getElementById('edit-similar').value,
                                                          Franchise: document.getElementById('edit-franchise').value,
                                                          Description: document.getElementById('edit-desc').value,
                                                          FAV: document.getElementById('edit-fav').checked ? 'YES' : 'NO',
                                                          WANT_TO_PLAY: document.getElementById('edit-want').checked ? 'YES' : 'NO',

                                                          CoverArt: game ? game.CoverArt : "",
                                                          Screenshot: game ? game.Screenshot : "",
                                                          HeroArt: game ? game.HeroArt : "",
                                                          Logo: game ? game.Logo : "",
                                                          Icon: game ? game.Icon : "",
                                                          SteamDesc: game ? game.SteamDesc : "",
                                                          SteamTrailer: game ? game.SteamTrailer : ""
    };

    const success = await window.api.updateGame(currentGameId, data);
    if (success) {
        await loadGames();
        const updatedGame = allGames.find(g => g.id === currentGameId);
        if (updatedGame) openGamepage(updatedGame); else switchView('view-gallery');
    } else {
        await showAlert(t('alert.save_failed'));
    }
});

document.getElementById('btn-delete-game').addEventListener('click', async () => {
    if (!currentGameId) return;
    if (await showConfirm(t('confirm.delete_game'), 'Delete', true)) {
        const success = await window.api.deleteGame(currentGameId);
        if (success) {
            loadGames();
            switchView('view-gallery');
        }
    }
});

function triggerAutoFetchSearch(gameId, gameName) {
    const btn = document.getElementById('btn-auto-fetch');
    btn.innerText = t('status.searching'); btn.disabled = true;

    window.api.searchSteam(gameName).then(results => {
        if (results.length === 0) {
            document.getElementById('modal-refine-search').classList.add('active');
            document.getElementById('refine-search-input').value = gameName;
            btn.innerText = t('status.auto_fetch'); btn.disabled = false; return;
        }
        if (results.length === 1) {
            btn.innerText = t('status.fetching_auto');
            executeAutoFetch(gameId, gameName, results[0].id);
        } else {
            openSteamResultsModal(gameId, gameName, results);
            btn.innerText = t('status.auto_fetch'); btn.disabled = false;
        }
    });
}

document.getElementById('btn-auto-fetch').addEventListener('click', () => {
    if (!currentGameId) return;
    const gameName = document.getElementById('edit-name').value.trim();
    triggerAutoFetchSearch(currentGameId, gameName);
});

document.getElementById('btn-refine-search-submit').addEventListener('click', () => {
    const newName = document.getElementById('refine-search-input').value.trim();
    document.getElementById('modal-refine-search').classList.remove('active');
    if (newName) triggerAutoFetchSearch(currentGameId, newName);
});

document.getElementById('btn-close-refine-search').addEventListener('click', () => { document.getElementById('modal-refine-search').classList.remove('active'); });

function openSteamResultsModal(gameId, gameName, results) {
    document.getElementById('modal-steam-results').classList.add('active');
    const list = document.getElementById('steam-results-list');
    list.innerHTML = '';
    results.forEach(res => {
        const btn = document.createElement('button');
        btn.innerText = `${res.name} (${res.id})`;
        btn.style.width = '100%'; btn.style.textAlign = 'left';
        btn.addEventListener('click', () => {
            document.getElementById('modal-steam-results').classList.remove('active');
            document.getElementById('btn-auto-fetch').innerText = t('status.fetching_auto');
            document.getElementById('btn-auto-fetch').disabled = true;
            executeAutoFetch(gameId, gameName, res.id);
        });
        list.appendChild(btn);
    });
}
document.getElementById('btn-close-steam-results').addEventListener('click', () => { document.getElementById('modal-steam-results').classList.remove('active'); });

async function executeAutoFetch(gameId, gameName, appId) {
    const btn = document.getElementById('btn-auto-fetch');
    const result = await window.api.autoFetch(gameId, gameName, appId);
    await showAlert(result.message);
    if (result.success) {
        await loadGames();
        const updatedGame = allGames.find(g => g.id === gameId);
        if (updatedGame) openDetails(updatedGame);
    }
    btn.innerText = t('status.auto_fetch'); btn.disabled = false;
}

// --- EXTERNAL FETCHERS (HLTB/ProtonDB/Youtube) ---
document.getElementById('btn-fetch-hltb').addEventListener('click', async () => {
    const gameName = document.getElementById('edit-name').value;
    if (!gameName) return;
    document.getElementById('btn-fetch-hltb').innerText = "⏳";
    const result = await window.api.fetchHltb(gameName);
    document.getElementById('edit-hltb').value = result;
    document.getElementById('btn-fetch-hltb').innerText = "🔍";
    if (result === "API Offline" || result === "Error" || result === "Unknown") {
        window.api.openWebPopup(`https://howlongtobeat.com/?q=${encodeURIComponent(gameName)}`);
    }
});

document.getElementById('btn-fetch-proton').addEventListener('click', async () => {
    const appId = document.getElementById('edit-appid').value;
    if (!appId) { await showAlert(t('alert.proton_id_required')); return; }
    document.getElementById('btn-fetch-proton').innerText = "⏳";
    const result = await window.api.fetchProton(appId);
    document.getElementById('edit-proton').value = result.toUpperCase();
    document.getElementById('btn-fetch-proton').innerText = "🔍";
    if (result === "ERROR" || result === "UNKNOWN") {
        window.api.openWebPopup(`https://www.protondb.com/app/${appId}`);
    }
});

// Used in Detailed View (Edit Mode)
document.getElementById('btn-watch-trailer').addEventListener('click', async () => {
    const gameName = document.getElementById('edit-name').value;
    if(!gameName) return;
    const localUrl = await window.api.checkLocalTrailer(gameName);
    if (localUrl) {
        document.getElementById('modal-trailer-player').classList.add('active');
        const vid = document.getElementById('detail-video-player');
        vid.src = localUrl; vid.play();
    } else {
        document.getElementById('modal-trailer-search').classList.add('active');
        const lst = document.getElementById('yt-search-list'); const stat = document.getElementById('yt-search-status');
        lst.innerHTML = '';

        // IGDB result is local — show it immediately if available
        const game = allGames.find(g => g.id === currentGameId);
        const igdbId = game?.IGDBTrailer;
        const renderResult = (res) => {
            const div = document.createElement('div');
            div.className = 'yt-search-item';
            if (res.official) div.style.cssText = 'border: 2px solid var(--accent); border-radius: 8px;';
            div.innerHTML = `<img src="${res.thumbnail}" style="width: 120px; border-radius: 4px;"><div style="color: ${res.official ? 'var(--accent)' : 'var(--text_main)'}; font-weight: bold;">${res.title}</div>`;
            div.addEventListener('click', () => { document.getElementById('modal-trailer-search').classList.remove('active'); openTrailerProgress(gameName, res.id); });
            lst.appendChild(div);
        };

        if (igdbId) {
            renderResult({ id: igdbId, thumbnail: `https://img.youtube.com/vi/${igdbId}/hqdefault.jpg`, title: '🎬 Official Trailer (via IGDB)', official: true });
            stat.innerText = 'Official trailer found. Also searching YouTube...';
        } else {
            stat.innerText = t('status.searching_yt', {name: gameName});
        }

        // YouTube search runs in parallel — results appended when ready
        const ytResults = await window.api.searchYoutube(gameName);
        const filtered = ytResults.filter(r => r.id !== igdbId);
        filtered.forEach(res => renderResult(res));

        const total = (igdbId ? 1 : 0) + filtered.length;
        if (total === 0) { stat.innerText = t('status.no_yt'); return; }
        stat.innerText = t('status.select_video');
    }
});

function openTrailerProgress(gameName, videoId) {
    document.getElementById('modal-trailer-progress').classList.add('active');
    document.getElementById('dl-progress-game').innerText = gameName;
    document.getElementById('dl-progress-fill').style.width = "0%"; document.getElementById('dl-progress-text').innerText = "0%";
    window.api.downloadTrailer(gameName, videoId).then(success => {
        document.getElementById('modal-trailer-progress').classList.remove('active');
        showAlert(success ? t('status.download_complete') : t('status.download_failed'));
    });
}
window.api.onDownloadProgress((percentage) => {
    const fill = document.getElementById('dl-progress-fill'); const text = document.getElementById('dl-progress-text');
    if (fill && text) { fill.style.width = `${percentage}%`; text.innerText = `${Math.floor(percentage)}%`; }
});

document.getElementById('btn-close-yt-search').addEventListener('click', () => document.getElementById('modal-trailer-search').classList.remove('active'));
document.getElementById('btn-close-player').addEventListener('click', () => {
    document.getElementById('modal-trailer-player').classList.remove('active');
    const vid = document.getElementById('detail-video-player');
    vid.pause(); vid.removeAttribute('src'); vid.load();
});


// --- ADMIN TOOLS ---
const modalConnect = document.getElementById('modal-connect');
document.getElementById('btn-open-connect').addEventListener('click', async () => {
    const savedSteamId = await window.api.getSetting('steam_id'); const savedApiKey = await window.api.getSetting('steam_api_key');
    if (savedSteamId) document.getElementById('steam-id').value = savedSteamId;
    if (savedApiKey) document.getElementById('steam-api-key').value = savedApiKey;
    const savedIgdbId = await window.api.getSetting('igdb_client_id'); const savedIgdbSecret = await window.api.getSetting('igdb_client_secret');
    if (savedIgdbId) document.getElementById('igdb-client-id').value = savedIgdbId;
    if (savedIgdbSecret) document.getElementById('igdb-client-secret').value = '••••••••';
    const savedSgdbKey = await window.api.getSetting('steamgriddb_api');
    if (savedSgdbKey) document.getElementById('connect-sgdb-key').value = '••••••••';
    document.getElementById('connect-sgdb-status').innerText = '';
    modalConnect.classList.add('active');
    document.getElementById('igdb-status').innerText = '';
    document.getElementById('connect-search').value = '';
    document.querySelectorAll('.connect-section').forEach(c => c.style.display = '');
    document.getElementById('connect-no-results').style.display = 'none';
    setTimeout(() => document.getElementById('connect-search').focus(), 150);
});

document.getElementById('btn-close-modal').addEventListener('click', () => {
    modalConnect.classList.remove('active');
    document.getElementById('connect-search').value = '';
    document.querySelectorAll('.connect-section').forEach(c => c.style.display = '');
    document.getElementById('connect-no-results').style.display = 'none';
});

document.getElementById('connect-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('.connect-section').forEach(card => {
        const haystack = (card.dataset.search || '') + ' ' + card.textContent.toLowerCase();
        const show = !q || haystack.includes(q);
        card.style.display = show ? '' : 'none';
        if (show) visible++;
    });
    document.getElementById('connect-no-results').style.display = visible === 0 ? 'block' : 'none';
});

document.getElementById('btn-connect-save-sgdb').addEventListener('click', async () => {
    const key    = document.getElementById('connect-sgdb-key').value.trim();
    const status = document.getElementById('connect-sgdb-status');
    if (!key || key === '••••••••') { status.style.color = '#f57c00'; status.innerText = 'Paste your API key above.'; return; }
    await window.api.setSetting('steamgriddb_api', key);
    document.getElementById('sgdb-api-input').value = key;
    document.getElementById('connect-sgdb-key').value = '••••••••';
    status.style.color = '#66bb6a'; status.innerText = '✓ Key saved!';
});

document.getElementById('btn-save-igdb').addEventListener('click', async () => {
    const clientId = document.getElementById('igdb-client-id').value.trim();
    const secret   = document.getElementById('igdb-client-secret').value.trim();
    const statusEl = document.getElementById('igdb-status');
    if (!clientId || !secret || secret === '••••••••') { statusEl.style.color = '#f57c00'; statusEl.innerText = 'Enter both Client ID and Secret.'; return; }
    await window.api.setSetting('igdb_client_id', clientId);
    await window.api.setSetting('igdb_client_secret', secret);
    // Clear cached token so it gets refreshed with new credentials
    await window.api.setSetting('igdb_token', ''); await window.api.setSetting('igdb_token_expiry', '0');
    statusEl.style.color = 'var(--text_dim)'; statusEl.innerText = 'Testing...';
    const result = await window.api.igdbTest();
    statusEl.style.color = result.success ? '#4caf50' : '#f44336';
    statusEl.innerText = result.message;
});


document.getElementById('btn-sync-heroic').addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-heroic');
    btn.innerText = t('status.syncing');
    const result = await window.api.syncHeroic();
    await showAlert(result.message);
    if (result.success) { await loadGames(); syncGrinderInstalled(); }
    btn.innerText = t('status.sync_heroic');
});

(function () {
    const launchBtn = document.getElementById('btn-launch-watch-heroic');
    const statusEl  = document.getElementById('heroic-watch-status-text');
    let watching = false;

    function setWatching(on) {
        watching = on;
        launchBtn.innerText = on ? t('status.heroic_watching') : t('html.btn_refresh_heroic');
        launchBtn.style.opacity = on ? '0.7' : '1';
    }

    launchBtn.addEventListener('click', async () => {
        if (watching) { window.api.cancelHeroicWatch(); setWatching(false); statusEl.innerText = ''; return; }
        const result = await window.api.launchAndWatchHeroic();
        if (!result.success) { statusEl.innerText = `⚠️ ${result.message}`; return; }
        setWatching(true);
        statusEl.style.color = 'var(--text_dim)';
        statusEl.innerText = t('status.heroic_waiting');
    });

    window.api.onHeroicWatchStatus(data => {
        if (data.phase === 'syncing') {
            statusEl.style.color = 'var(--text_dim)';
            statusEl.innerText = t('status.heroic_syncing');
        } else if (data.phase === 'done') {
            setWatching(false);
            statusEl.style.color = data.success ? '#66bb6a' : '#ef5350';
            statusEl.innerText = data.success ? `✅ ${data.message}` : `❌ ${data.message}`;
            if (data.success) loadGames();
            setTimeout(() => { statusEl.innerText = ''; }, 6000);
        } else if (data.phase === 'timeout') {
            setWatching(false);
            statusEl.style.color = 'var(--text_dim)';
            statusEl.innerText = t('status.heroic_timeout');
            setTimeout(() => { statusEl.innerText = ''; }, 8000);
        }
    });
})();

document.getElementById('btn-sync-steam').addEventListener('click', async () => {
    const steamId = document.getElementById('steam-id').value.trim();
    const apiKey = document.getElementById('steam-api-key').value.trim();
    if (!steamId || !apiKey) { await showAlert(t('alert.steam_id_required')); return; }
    await window.api.setSetting('steam_id', steamId); await window.api.setSetting('steam_api_key', apiKey);
    const btn = document.getElementById('btn-sync-steam');
    btn.innerText = t('status.fetching'); btn.disabled = true;
    const result = await window.api.syncSteam(steamId, apiKey);
    await showAlert(result.message);
    if (result.success) loadGames();
    btn.innerText = t('status.fetch_steam'); btn.disabled = false;
});


document.getElementById('btn-update-library').addEventListener('click', async () => {
    const btn = document.getElementById('btn-update-library');
    const statusEl = document.getElementById('update-library-status');
    btn.disabled = true;
    btn.innerText = t('status.updating_library');
    statusEl.innerHTML = '';

    const line = (html) => { statusEl.innerHTML += (statusEl.innerHTML ? '<br>' : '') + html; };

    const steamId = await window.api.getSetting('steam_id');
    const steamKey = await window.api.getSetting('steam_api_key');
    const issues = [];
    let anySuccess = false;

    // Heroic sync
    line('🔄 Syncing Heroic...');
    const heroicResult = await window.api.syncHeroic();
    if (heroicResult.success) {
        anySuccess = true;
        statusEl.innerHTML = statusEl.innerHTML.replace('🔄 Syncing Heroic...', `✅ Heroic: ${heroicResult.message}`);
    } else {
        statusEl.innerHTML = statusEl.innerHTML.replace('🔄 Syncing Heroic...', '⚠️ Heroic: not found');
        issues.push('heroic');
    }

    // Steam sync — only if credentials are already saved
    if (steamId && steamKey) {
        line('🔄 Syncing Steam...');
        const steamResult = await window.api.syncSteam(steamId, steamKey);
        if (steamResult.success) {
            anySuccess = true;
            statusEl.innerHTML = statusEl.innerHTML.replace('🔄 Syncing Steam...', `✅ Steam: ${steamResult.message}`);
        } else {
            statusEl.innerHTML = statusEl.innerHTML.replace('🔄 Syncing Steam...', `⚠️ Steam: ${steamResult.message}`);
        }
    } else {
        line('⚠️ Steam: not configured');
        issues.push('steam');
    }

    btn.disabled = false;
    btn.innerText = t('html.btn_update_library');

    // Show setup info modal if anything is missing
    if (issues.length > 0) {
        let body = '';
        if (issues.includes('heroic')) {
            body += `<div style="padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; border-left: 3px solid var(--accent);">
                <strong style="color: var(--accent);">Heroic Games Launcher not found</strong>
                <p style="margin: 6px 0 0 0;">Install Heroic, sync your Epic Games and GOG libraries inside Heroic first, then try again.<br>
                <span style="color: var(--text_dim); font-size: 12px;">heroicgameslauncher.com</span></p>
            </div>`;
        }
        if (issues.includes('steam')) {
            body += `<div style="padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; border-left: 3px solid #66c0f4;">
                <strong style="color: #66c0f4;">Steam not configured</strong>
                <p style="margin: 6px 0 0 0;">Go to <strong>Connect → Steam API Import</strong> and enter your SteamID64 and API Key.<br>
                Get your free API key at:<br>
                <span style="color: var(--text_main); font-size: 12px;">steamcommunity.com/dev/apikey</span></p>
            </div>`;
        }
        document.getElementById('update-info-body').innerHTML = body;
        document.getElementById('modal-update-info').classList.add('active');
    }

    if (anySuccess) {
        await loadGames();
        // Keep the Tools modal open so the user can see batch scrape progress
        if (await showConfirm(t('status.sync_batch_prompt'), 'Fetch Now')) {
            document.getElementById('btn-batch-fetch').click();
        }
    }
});

document.getElementById('btn-close-update-info').addEventListener('click', () => {
    document.getElementById('modal-update-info').classList.remove('active');
});

document.getElementById('btn-clear-data').addEventListener('click', async () => {
    if (await showConfirm(t('confirm.clear_browser'), 'Clear', true)) {
        const result = await window.api.clearBrowserData(); await showAlert(result.message);
    }
});

// Image Cleanup Handlers
document.getElementById('btn-clean-images').addEventListener('click', async () => {
    if (await showConfirm(t('confirm.clean_images'), 'Clean', true)) {
        const result = await window.api.cleanUnusedImages();
        await showAlert(result.message);
    }
});

document.getElementById('btn-clear-all-images').addEventListener('click', async () => {
    if (await showConfirm(t('confirm.clear_all_images'), 'Clear All', true)) {
        const result = await window.api.clearAllImages();
        await showAlert(result.message);
        loadGames();
    }
});


window.api.onZipStarted(() => { document.getElementById('modal-tools').classList.remove('active'); document.getElementById('modal-zip-progress').classList.add('active'); });

document.getElementById('btn-backup-zip').addEventListener('click', async () => {
    const result = await window.api.backupZip();
    document.getElementById('modal-zip-progress').classList.remove('active');
    if (result.message) await showAlert(result.message);
});

document.getElementById('btn-restore-zip').addEventListener('click', async () => {
    if (await showConfirm(t('confirm.restore_backup'), 'Restore', true)) {
        const result = await window.api.restoreZip();
        document.getElementById('modal-zip-progress').classList.remove('active');
        if (result.message) await showAlert(result.message);
    }
});

const modalTools = document.getElementById('modal-tools');
document.getElementById('btn-open-tools').addEventListener('click', () => {
    modalTools.classList.add('active');
    document.getElementById('batch-status').innerText = '';
    document.getElementById('install-menu-status').innerText = '';
    document.getElementById('tools-search').value = '';
    document.querySelectorAll('.tools-section').forEach(c => c.style.display = '');
    document.getElementById('tools-no-results').style.display = 'none';
    setTimeout(() => document.getElementById('tools-search').focus(), 150);
});

document.getElementById('btn-install-menu').addEventListener('click', async () => {
    const btn = document.getElementById('btn-install-menu');
    const status = document.getElementById('install-menu-status');
    btn.disabled = true; btn.innerText = t('status.installing'); status.style.color = 'var(--text_dim)'; status.innerText = '';
    const result = await window.api.installToMenu();
    btn.disabled = false; btn.innerText = t('status.add_to_menu');
    status.style.color = result.success ? '#66bb6a' : '#ef5350';
    status.innerText = result.message;
});
// ── GRINDER tool card ──────────────────────────────────────────────────────────
checkGrinderConnect();

document.getElementById('btn-check-grinder')?.addEventListener('click', checkGrinderConnect);

// Sync ALL GRINDER games into CNGM (installed + not installed).
// Called on startup and after any library sync.
async function syncGrinderInstalled() {
    const s = await window.api.grinderStatus();
    if (!s.found) return;
    // Full sync: match & import all GRINDER games (not just installed ones)
    if (s.allGames?.length) {
        const { synced } = await window.api.syncAllGrinderGames(s.allGames, s.path);
        if (synced > 0) await loadGames();
    } else if (s.installedGames?.length) {
        // Fallback: old-style installed-only sync (if allGames not available yet)
        const { synced } = await window.api.syncGrinderInstalled(s.installedGames);
        if (synced > 0) await loadGames();
    }
}

async function checkGrinderConnect() {
    const statusEl = document.getElementById('grinder-connect-status');
    const openBtn  = document.getElementById('btn-open-grinder-tool');
    if (!statusEl) return;
    statusEl.textContent = 'Checking…';
    statusEl.style.color = 'var(--text_dim)';
    const s = await window.api.grinderStatus();
    if (!s.found) {
        statusEl.textContent = 'GRINDER.AppImage not found — place it in the same folder as CNGM.';
        if (openBtn) openBtn.style.display = 'none';
    } else if (s.error) {
        statusEl.textContent = `⚠ ${s.error}`;
        statusEl.style.color = '#f57c00';
        if (openBtn) openBtn.style.display = '';
    } else {
        const total = s.allGames?.length ?? s.installedGames.length;
        const inst  = s.installedGames.length;
        statusEl.textContent = `✓ Connected — ${total} game${total !== 1 ? 's' : ''} in GRINDER (${inst} installed)`;
        statusEl.style.color = '#66bb6a';
        if (openBtn) openBtn.style.display = '';
    }
}

document.getElementById('btn-open-grinder-tool')?.addEventListener('click', () => window.api.openGrinder());

// ── GRINDER row in detail panel ────────────────────────────────────────────────
async function updateGrinderRow(game) {
    const row       = document.getElementById('grinder-launch-row');
    const statusEl  = document.getElementById('grinder-launch-status');
    const toggleBtn = document.getElementById('btn-toggle-grinder');
    const openBtn   = document.getElementById('btn-open-grinder-detail');
    if (!row) return;

    // Show for Heroic Epic AND GOG games when GRINDER is present
    const epicMatch = (game.LaunchCommand || '').match(/heroic:\/\/launch\/epic\/([^"\s]+)/i);
    const gogMatch  = (game.LaunchCommand || '').match(/heroic:\/\/launch\/gog\/([^"\s]+)/i);
    const storeMatch = epicMatch || gogMatch;
    const s = await window.api.grinderStatus();
    if (!storeMatch || !s.found) { row.style.display = 'none'; return; }

    const grinderGameId = epicMatch ? `epic_${epicMatch[1]}` : `gog_${gogMatch[1]}`;
    row.style.display = 'flex';
    openBtn.style.display = 'none';
    toggleBtn.style.display = 'none';

    const inGrinder = s.installedGames?.includes(grinderGameId);

    if (game.prefer_heroic) {
        // User explicitly chose Heroic
        statusEl.textContent = 'Launching via Heroic (by preference)';
        statusEl.style.color = '#f57c00';
        toggleBtn.style.display = inGrinder ? '' : 'none';
        toggleBtn.textContent = 'Switch to GRINDER';
        toggleBtn.onclick = async () => {
            await window.api.setGrinderGame(game.id, grinderGameId);
            const g = allGames.find(x => x.id == game.id);
            if (g) { g.GrinderGameId = grinderGameId; g.prefer_heroic = 0; }
            updateGrinderRow({ ...game, GrinderGameId: grinderGameId, prefer_heroic: 0 });
            await loadGames();
        };
    } else if (game.GrinderGameId || inGrinder) {
        // GRINDER is active (auto or manual)
        statusEl.textContent = '✓ GRINDER — default launcher';
        statusEl.style.color = '#66bb6a';
        toggleBtn.textContent = 'Switch to Heroic';
        toggleBtn.style.display = '';
        toggleBtn.onclick = async () => {
            await window.api.setGrinderGame(game.id, null);
            const g = allGames.find(x => x.id == game.id);
            if (g) { g.GrinderGameId = null; g.prefer_heroic = 1; }
            updateGrinderRow({ ...game, GrinderGameId: null, prefer_heroic: 1 });
            await loadGames();
        };
    } else {
        // Not installed in GRINDER
        statusEl.textContent = 'Not installed in GRINDER';
        statusEl.style.color = 'var(--text_dim)';
        openBtn.style.display = '';
        openBtn.onclick = () => window.api.openGrinder(game.Game);
    }
}

document.getElementById('btn-close-tools').addEventListener('click', () => {
    modalTools.classList.remove('active');
    document.getElementById('tools-search').value = '';
    document.querySelectorAll('.tools-section').forEach(c => c.style.display = '');
    document.getElementById('tools-no-results').style.display = 'none';
});

document.getElementById('tools-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('.tools-section').forEach(card => {
        const haystack = (card.dataset.search || '') + ' ' + card.textContent.toLowerCase();
        const show = !q || haystack.includes(q);
        card.style.display = show ? '' : 'none';
        if (show) visible++;
    });
    document.getElementById('tools-no-results').style.display = visible === 0 ? 'block' : 'none';
});

// Upgraded Batch Fetcher
document.getElementById('btn-batch-fetch').addEventListener('click', async () => {
    const hasImg = (v) => v && String(v).startsWith('GameManagerConfig');
    const hasText = (v) => v && String(v).trim() !== '';
    const gamesToFetch = allGames.filter(g =>
        !hasImg(g.CoverArt) || !hasImg(g.HeroArt) || !hasImg(g.Logo) ||
        !hasImg(g.Icon) || !hasImg(g.Screenshot) ||
        !hasText(g.Description) || !hasText(g.DEV) || !hasText(g.GENRE) ||
        !hasText(g.SimilarGames) || !hasText(g.Franchise)
    );

    const btn = document.getElementById('btn-batch-fetch');
    const statusText = document.getElementById('batch-status');
    const progressWrap = document.getElementById('batch-progress-wrap');
    const progressFill = document.getElementById('batch-progress-fill');

    if (gamesToFetch.length === 0) { statusText.innerText = t('status.all_up_to_date'); return; }

    btn.disabled = true;
    progressWrap.style.display = 'block';
    progressFill.style.width = '0%';

    for (let i = 0; i < gamesToFetch.length; i++) {
        const game = gamesToFetch[i];
        statusText.innerText = t('status.fetching_progress', {i: i + 1, total: gamesToFetch.length, name: game.Game});
        progressFill.style.width = `${Math.round(((i + 1) / gamesToFetch.length) * 100)}%`;
        await window.api.autoFetch(game.id, game.Game, game.SteamAppID);
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    progressFill.style.width = '100%';
    statusText.innerText = t('status.batch_done', {n: gamesToFetch.length});
    setTimeout(() => { progressWrap.style.display = 'none'; progressFill.style.width = '0%'; }, 2000);
    btn.disabled = false;
    loadGames();
});

document.getElementById('btn-check-install').addEventListener('click', async () => {
    const btn = document.getElementById('btn-check-install');
    const statusEl = document.getElementById('check-install-status');
    btn.disabled = true;
    btn.innerText = t('status.checking');
    statusEl.innerText = '';
    const result = await window.api.checkAllInstallStatus();
    btn.disabled = false;
    btn.innerText = t('html.btn_check_install');
    statusEl.style.color = '#66bb6a';
    statusEl.innerText = `✅ ${t('status.install_check_done', { n: result.updated })}`;
    setTimeout(() => { statusEl.innerText = ''; }, 5000);
    loadGames();
});

document.getElementById('btn-add-game').addEventListener('click', () => {
    const modal = document.getElementById('modal-add-game');
    const input = document.getElementById('add-game-name-input');
    input.value = '';
    modal.classList.add('active');
    setTimeout(() => input.focus(), 50);

    const doCreate = async () => {
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        modal.classList.remove('active');
        const result = await window.api.addGame(name);
        if (result.success) {
            await loadGames();
            const newGame = allGames.find(g => g.id === result.id);
            if (newGame) { openDetails(newGame); document.getElementById('edit-name').focus(); }
        } else { await showAlert(t('alert.add_failed')); }
    };

    document.getElementById('add-game-create').onclick = doCreate;
    document.getElementById('add-game-cancel').onclick = () => modal.classList.remove('active');
    input.onkeydown = (e) => { if (e.key === 'Enter') doCreate(); else if (e.key === 'Escape') modal.classList.remove('active'); };
});

document.getElementById('btn-template-csv').addEventListener('click', async () => { const result = await window.api.downloadCsvTemplate(); if (result?.message) await showAlert(result.message); });
document.getElementById('btn-export-csv').addEventListener('click', async () => { const result = await window.api.exportCsv(); if (result?.message) await showAlert(result.message); });
document.getElementById('btn-import-csv').addEventListener('click', async () => {
    const btn = document.getElementById('btn-import-csv');
    btn.innerText = t('status.importing'); btn.disabled = true;
    const result = await window.api.importCsv();
    if (result?.message) { await showAlert(result.message); if (result.success) loadGames(); }
    btn.innerText = t('status.import_csv'); btn.disabled = false;
});

// --- THEME ENGINE ---

let _lastMosaicKey = '';
function updateHeroMosaic(filtered, filterName) {
    // Always update count label (cheap)
    const countEl = document.getElementById('gallery-category-count');
    if (countEl) countEl.innerText = `${filtered.length} ${filtered.length === 1 ? t('game.singular') : t('game.plural')}`;

    // Skip full mosaic rebuild if filter + game set is identical to last render
    const mosaicKey = `${filterName}:${filtered.length}:${filtered[0]?.id ?? ''}:${filtered[filtered.length - 1]?.id ?? ''}`;
    if (mosaicKey === _lastMosaicKey) return;
    _lastMosaicKey = mosaicKey;

    clearInterval(heroKbInterval);
    const iconContainer = document.getElementById('hero-icon');
    const kbImg = document.getElementById('hero-kb-img');
    const nameEl = document.getElementById('hero-game-name');

    const filterMap = {
        'all': { text: t('filter.all'), icon: 'all_games' }, 'playable': { text: t('filter.playable'), icon: 'playable' },
        'favs': { text: t('filter.favorites'), icon: 'favs' }, 'want': { text: t('filter.want'), icon: 'want_to_play' },
        'steam': { text: 'STEAM', icon: 'steam' }, 'epic': { text: 'EPIC', icon: 'epic' },
        'gog': { text: 'GOG', icon: 'gog' }, 'flatpak': { text: 'FLATPAK', icon: 'flatpak' },
        'physical': { text: t('filter.physical'), icon: 'physical' },
        'others': { text: t('filter.others'), icon: 'others' }, 'emulation': { text: t('filter.emulation'), icon: 'emulation' },
        'apps': { text: t('filter.apps'), icon: 'apps' }
    };
    const currentCat = filterMap[filterName] || { text: filterName.toUpperCase(), icon: filterName };
    document.getElementById('gallery-category-text').innerText = currentCat.text;
    const iconPath = getSafePath(`assets/logos/${currentCat.icon}.png`);
    document.getElementById('gallery-category-icon').style.webkitMaskImage = `url('${iconPath}')`;

    let mediaPool = [];
    filtered.forEach(g => {
        if (g.HeroArt && String(g.HeroArt).trim() !== "") mediaPool.push({ path: g.HeroArt, name: g.Game });
        else if (g.Screenshot && String(g.Screenshot).trim() !== "") {
            String(g.Screenshot).split('|').filter(s => s.trim() !== "").forEach(s => mediaPool.push({ path: s, name: g.Game }));
        } else if (g.CoverArt && String(g.CoverArt).trim() !== "") {
            mediaPool.push({ path: g.CoverArt, name: g.Game });
        }
    });

    if (mediaPool.length > 0) {
        iconContainer.style.display = 'none'; kbImg.style.display = 'block';
        mediaPool.sort(() => Math.random() - 0.5);
        let idx = 0;
        function showNextImage() {
            kbImg.style.opacity = '0';
            setTimeout(() => {
                let item = mediaPool[idx]; kbImg.src = getSafePath(item.path); nameEl.innerText = item.name;
                kbImg.style.opacity = '0.5'; idx = (idx + 1) % mediaPool.length;
            }, 500);
        }
        showNextImage(); heroKbInterval = setInterval(showNextImage, 5000);
    } else {
        kbImg.style.display = 'none'; nameEl.innerText = ''; iconContainer.style.display = 'block';
    }
}

const THEMES = {
    "DARK GRAY": {bg: "#141414", bg_panel: "rgba(0,0,0,0.5)", bg_menu: "#222222", accent: "#ffffff", accent_menu: "#00e5ff", text_main: "#ffffff", text_sec: "#bbbbbb", text_dim: "#777777", border: "rgba(255,255,255,0.1)", border_solid: "#555555"},
    "CREMA": {bg: "#2C1E16", bg_panel: "rgba(67, 40, 24, 0.6)", bg_menu: "#432818", accent: "#D4A373", accent_menu: "#D4A373", text_main: "#FFE6A7", text_sec: "#E6CC98", text_dim: "#A47148", border: "rgba(212, 163, 115, 0.2)", border_solid: "#8B5A2B"},
    "CYBERPUNK": {bg: "#09090b", bg_panel: "rgba(26, 26, 46, 0.7)", bg_menu: "#1a1a2e", accent: "#f3e600", accent_menu: "#00ffcc", text_main: "#00ffcc", text_sec: "#e0e0e0", text_dim: "#ff003c", border: "rgba(243, 230, 0, 0.2)", border_solid: "#ff003c"},
    "VAPOUR OS": {bg: "#171a21", bg_panel: "rgba(27, 40, 56, 0.7)", bg_menu: "#1b2838", accent: "#66c0f4", accent_menu: "#66c0f4", text_main: "#c7d5e0", text_sec: "#8f98a0", text_dim: "#556b82", border: "rgba(102, 192, 244, 0.2)", border_solid: "#2a475e"},
    "PSIV BLUE": {bg: "#000022", bg_panel: "rgba(0, 67, 156, 0.4)", bg_menu: "#001144", accent: "#ffffff", accent_menu: "#0070cc", text_main: "#ffffff", text_sec: "#aaaaaa", text_dim: "#666666", border: "rgba(0, 112, 204, 0.3)", border_solid: "#00439c"},

    "GREEN BOX": {bg: "#0e0e0e", bg_panel: "rgba(82, 176, 67, 0.10)", bg_menu: "#111111", accent: "#52b043", accent_menu: "#107C10", text_main: "#ffffff", text_sec: "#a8d8a4", text_dim: "#3d8030", border: "rgba(82, 176, 67, 0.22)", border_solid: "#1a3d1a"},
    "MOVIESFLIX": {bg: "#141414", bg_panel: "rgba(255, 255, 255, 0.07)", bg_menu: "#000000", accent: "#e50914", accent_menu: "#e50914", text_main: "#ffffff", text_sec: "#b3b3b3", text_dim: "#6d6d6d", border: "rgba(229, 9, 20, 0.30)", border_solid: "#404040"},
    "SNOW": {bg: "#0a1628", bg_panel: "rgba(32, 68, 110, 0.65)", bg_menu: "#0f2040", accent: "#93d0f0", accent_menu: "#b8e4f8", text_main: "#e8f4ff", text_sec: "#8bbbd8", text_dim: "#4a7898", border: "rgba(147, 208, 240, 0.18)", border_solid: "#1c4060"},

    "WIN XP": {bg: "#003399", bg_panel: "rgba(236, 233, 216, 0.2)", bg_menu: "#0054E3", accent: "#ffd700", accent_menu: "#ffd700", text_main: "#FFFFFF", text_sec: "#ECE9D8", text_dim: "#99B4D1", border: "rgba(236, 233, 216, 0.4)", border_solid: "#4fcc3a"},

    "PSIII CLASSIC": {bg: "#000000", bg_panel: "rgba(25, 25, 25, 0.7)", bg_menu: "#111111", accent: "#dcdcdc", accent_menu: "#ffffff", text_main: "#ffffff", text_sec: "#aaaaaa", text_dim: "#666666", border: "rgba(255, 255, 255, 0.2)", border_solid: "#444444"},
    "PSIII RED": {bg: "#2b0000", bg_panel: "rgba(40, 0, 0, 0.7)", bg_menu: "#1a0000", accent: "#ff4d4d", accent_menu: "#ff4d4d", text_main: "#ffffff", text_sec: "#ffcccc", text_dim: "#cc6666", border: "rgba(255, 77, 77, 0.2)", border_solid: "#800000"},
    "PSIII GREEN": {bg: "#001a00", bg_panel: "rgba(0, 30, 0, 0.7)", bg_menu: "#000d00", accent: "#4dff4d", accent_menu: "#4dff4d", text_main: "#ffffff", text_sec: "#ccffcc", text_dim: "#66cc66", border: "rgba(77, 255, 77, 0.2)", border_solid: "#004d00"},
    "PSIII BLUE": {bg: "#000a1a", bg_panel: "rgba(0, 15, 30, 0.7)", bg_menu: "#00050d", accent: "#4d94ff", accent_menu: "#4d94ff", text_main: "#ffffff", text_sec: "#cce0ff", text_dim: "#66a3ff", border: "rgba(77, 148, 255, 0.2)", border_solid: "#003380"},
    "PSIII PURPLE": {bg: "#1a001a", bg_panel: "rgba(30, 0, 30, 0.7)", bg_menu: "#0d000d", accent: "#d24dff", accent_menu: "#d24dff", text_main: "#ffffff", text_sec: "#f0ccff", text_dim: "#c266cc", border: "rgba(210, 77, 255, 0.2)", border_solid: "#800080"},
    "PSIII GOLD": {bg: "#261a00", bg_panel: "rgba(40, 25, 0, 0.7)", bg_menu: "#130d00", accent: "#ffcc00", accent_menu: "#ffcc00", text_main: "#ffffff", text_sec: "#ffeecc", text_dim: "#cca300", border: "rgba(255, 204, 0, 0.2)", border_solid: "#997300"},
    "PSIII SILVER": {bg: "#1a1a1a", bg_panel: "rgba(35, 35, 35, 0.7)", bg_menu: "#0d0d0d", accent: "#cccccc", accent_menu: "#cccccc", text_main: "#ffffff", text_sec: "#e6e6e6", text_dim: "#999999", border: "rgba(204, 204, 204, 0.2)", border_solid: "#666666"},

    "DRACULA": {bg: "#282a36", bg_panel: "rgba(68, 71, 90, 0.7)", bg_menu: "#44475a", accent: "#bd93f9", accent_menu: "#ff79c6", text_main: "#f8f8f2", text_sec: "#8be9fd", text_dim: "#8290bc", border: "rgba(189, 147, 249, 0.2)", border_solid: "#8290bc"},
    "GRUVBOX": {bg: "#282828", bg_panel: "rgba(60, 56, 54, 0.8)", bg_menu: "#3c3836", accent: "#fabd2f", accent_menu: "#fe8019", text_main: "#ebdbb2", text_sec: "#b8bb26", text_dim: "#a89984", border: "rgba(250, 189, 47, 0.2)", border_solid: "#504945"},
    "NORD": {bg: "#2e3440", bg_panel: "rgba(59, 66, 82, 0.8)", bg_menu: "#3b4252", accent: "#88c0d0", accent_menu: "#81a1c1", text_main: "#eceff4", text_sec: "#e5e9f0", text_dim: "#7a8ba0", border: "rgba(136, 192, 208, 0.2)", border_solid: "#5e6f84"},
    "SOLARIZED DARK": {bg: "#002b36", bg_panel: "rgba(7, 54, 66, 0.8)", bg_menu: "#073642", accent: "#2aa198", accent_menu: "#268bd2", text_main: "#839496", text_sec: "#93a1a1", text_dim: "#7a9196", border: "rgba(42, 161, 152, 0.2)", border_solid: "#1a5060"},
    "CATPPUCCIN MOCHA": {bg: "#1e1e2e", bg_panel: "rgba(30, 30, 46, 0.8)", bg_menu: "#181825", accent: "#cba6f7", accent_menu: "#f5c2e7", text_main: "#cdd6f4", text_sec: "#bac2de", text_dim: "#6c7086", border: "rgba(203, 166, 247, 0.2)", border_solid: "#313244"},
    "CATPPUCCIN MACCHIATO": {bg: "#24273a", bg_panel: "rgba(36, 39, 58, 0.8)", bg_menu: "#1e2030", accent: "#c6a0f6", accent_menu: "#f4b8e4", text_main: "#cad3f5", text_sec: "#b8c0e0", text_dim: "#6e738d", border: "rgba(198, 160, 246, 0.2)", border_solid: "#363a4f"},
    "CATPPUCCIN FRAPPÉ": {bg: "#303446", bg_panel: "rgba(48, 52, 70, 0.8)", bg_menu: "#292c3c", accent: "#ca9ee6", accent_menu: "#f2d5cf", text_main: "#c6d0f5", text_sec: "#b5bfe2", text_dim: "#737994", border: "rgba(202, 158, 230, 0.2)", border_solid: "#414559"},
    "TOKYO NIGHT": {bg: "#1a1b26", bg_panel: "rgba(36, 40, 59, 0.8)", bg_menu: "#16161e", accent: "#7aa2f7", accent_menu: "#bb9af7", text_main: "#c0caf5", text_sec: "#a9b1d6", text_dim: "#7885ac", border: "rgba(122, 162, 247, 0.2)", border_solid: "#3d4468"},
    "EVERFOREST": {bg: "#2b3339", bg_panel: "rgba(50, 56, 62, 0.8)", bg_menu: "#2f383e", accent: "#a7c080", accent_menu: "#e67e80", text_main: "#d3c6aa", text_sec: "#a7c080", text_dim: "#859289", border: "rgba(167, 192, 128, 0.2)", border_solid: "#4b565c"},
    "ROSÉ PINE": {bg: "#191724", bg_panel: "rgba(31, 29, 46, 0.8)", bg_menu: "#1f1d2e", accent: "#c4a7e7", accent_menu: "#ebbcba", text_main: "#e0def4", text_sec: "#9ccfd8", text_dim: "#6e6a86", border: "rgba(196, 167, 231, 0.2)", border_solid: "#26233a"},

    "GAME BOY DMG": {bg: "#0f380f", bg_panel: "rgba(48, 98, 48, 0.70)", bg_menu: "#1a4a1a", accent: "#9bbc0f", accent_menu: "#8bac0f", text_main: "#9bbc0f", text_sec: "#8bac0f", text_dim: "#306230", border: "rgba(155, 188, 15, 0.25)", border_solid: "#306230"},
    "PIP BOY": {bg: "#000000", bg_panel: "rgba(0, 20, 0, 0.7)", bg_menu: "#001100", accent: "#14ff00", accent_menu: "#14ff00", text_main: "#14ff00", text_sec: "#0ea000", text_dim: "#0a6000", border: "rgba(20, 255, 0, 0.2)", border_solid: "#0ea000"},
    "SEVASTOPOL": {bg: "#050d05", bg_panel: "rgba(10, 25, 10, 0.7)", bg_menu: "#081808", accent: "#f5e6b3", accent_menu: "#ff0000", text_main: "#f5e6b3", text_sec: "#a39977", text_dim: "#4d594d", border: "rgba(245, 230, 179, 0.1)", border_solid: "#1a331a"},
    "RIP AND TEAR CLASSIC": {bg: "#110000", bg_panel: "rgba(80, 5, 5, 0.78)", bg_menu: "#1a0000", accent: "#ff0000", accent_menu: "#cc0000", text_main: "#f5d020", text_sec: "#d0a000", text_dim: "#7a4400", border: "rgba(255, 0, 0, 0.22)", border_solid: "#5a0000"},
    "SUPER BROTHERS": {bg: "#5C94FC", bg_panel: "rgba(0, 0, 0, 0.75)", bg_menu: "#000070", accent: "#F8D820", accent_menu: "#F87020", text_main: "#ffffff", text_sec: "#F8D820", text_dim: "#6898F8", border: "rgba(248, 216, 32, 0.30)", border_solid: "#000000"},
    "GREEN HILL": {bg: "#0044AA", bg_panel: "rgba(0, 60, 0, 0.82)", bg_menu: "#003300", accent: "#F8D020", accent_menu: "#F8D020", text_main: "#ffffff", text_sec: "#A8E888", text_dim: "#50A050", border: "rgba(248, 208, 32, 0.30)", border_solid: "#006600"},
    "NES": {bg: "#18181A", bg_panel: "rgba(40, 38, 42, 0.85)", bg_menu: "#222024", accent: "#C42020", accent_menu: "#CC3030", text_main: "#F0F0F0", text_sec: "#C0B8C0", text_dim: "#706870", border: "rgba(196, 32, 32, 0.22)", border_solid: "#3C3A3E"},
    "SNES": {bg: "#1E1828", bg_panel: "rgba(50, 42, 80, 0.72)", bg_menu: "#160E20", accent: "#8060C8", accent_menu: "#A888E8", text_main: "#E8E0F0", text_sec: "#A890C8", text_dim: "#605090", border: "rgba(128, 96, 200, 0.22)", border_solid: "#302050"},
    "BLOODBORNE": {bg: "#0a0606", bg_panel: "rgba(60, 20, 10, 0.78)", bg_menu: "#150808", accent: "#c0952a", accent_menu: "#d4a838", text_main: "#e8d8b0", text_sec: "#b09070", text_dim: "#604830", border: "rgba(192, 149, 42, 0.22)", border_solid: "#4a1818"},
    "METROID PRIME": {bg: "#050a12", bg_panel: "rgba(255, 120, 20, 0.12)", bg_menu: "#080f1a", accent: "#ff6a00", accent_menu: "#ff8a30", text_main: "#e0f0ff", text_sec: "#60c8e0", text_dim: "#304858", border: "rgba(255, 106, 0, 0.22)", border_solid: "#1a2a3a"},
    "SILENT HILL": {bg: "#141210", bg_panel: "rgba(80, 50, 35, 0.72)", bg_menu: "#1a1510", accent: "#c85020", accent_menu: "#e06030", text_main: "#e0d0c0", text_sec: "#a09080", text_dim: "#605040", border: "rgba(200, 80, 32, 0.22)", border_solid: "#4a3020"},
    "DIABLO": {bg: "#0c0808", bg_panel: "rgba(80, 20, 0, 0.75)", bg_menu: "#140808", accent: "#e84000", accent_menu: "#c03000", text_main: "#f0d898", text_sec: "#c0a060", text_dim: "#705028", border: "rgba(232, 64, 0, 0.22)", border_solid: "#4a1a00"},
    "HALF-LIFE": {bg: "#141618", bg_panel: "rgba(245, 130, 32, 0.12)", bg_menu: "#1c1e20", accent: "#f58320", accent_menu: "#ff9a40", text_main: "#f0f0f0", text_sec: "#b0b8c0", text_dim: "#606870", border: "rgba(245, 131, 32, 0.22)", border_solid: "#2a3038"},
    "SHOVEL KNIGHT": {bg: "#1a1a2e", bg_panel: "rgba(30, 40, 80, 0.75)", bg_menu: "#100c20", accent: "#f8d840", accent_menu: "#f0c020", text_main: "#e8f0ff", text_sec: "#88b8f8", text_dim: "#4060a0", border: "rgba(248, 216, 64, 0.28)", border_solid: "#202858"},

    "EARTHY & ORGANIC": {bg: "#3E4E3A", bg_panel: "rgba(91, 107, 85, 0.7)", bg_menu: "#4F5D48", accent: "#D4B28C", accent_menu: "#A9C298", text_main: "#F3EDE4", text_sec: "#D8D3C8", text_dim: "#8E9E88", border: "rgba(212, 178, 140, 0.2)", border_solid: "#6b7d63"},

    "DOPAMINE BRIGHTS": {bg: "#080810", bg_panel: "rgba(255, 50, 120, 0.12)", bg_menu: "#100820", accent: "#FF2D78", accent_menu: "#00F5D4", text_main: "#ffffff", text_sec: "#FF80C0", text_dim: "#6030A0", border: "rgba(255, 45, 120, 0.28)", border_solid: "#2A0850"},
    "RETRO REVIVAL": {bg: "#2A1A10", bg_panel: "rgba(80, 50, 30, 0.70)", bg_menu: "#1E1008", accent: "#E8883A", accent_menu: "#4AAA98", text_main: "#F8E8C8", text_sec: "#C8A878", text_dim: "#7A5838", border: "rgba(232, 136, 58, 0.22)", border_solid: "#5A3820"},
    "VAPORWAVE": {bg: "#0d0221", bg_panel: "rgba(80, 10, 100, 0.65)", bg_menu: "#150330", accent: "#ff71ce", accent_menu: "#01cdfe", text_main: "#f0e0ff", text_sec: "#c080ff", text_dim: "#6030a0", border: "rgba(255, 113, 206, 0.25)", border_solid: "#35005a"},
    "AURORA": {bg: "#0a1520", bg_panel: "rgba(0, 80, 80, 0.55)", bg_menu: "#081018", accent: "#00e8c8", accent_menu: "#b060ff", text_main: "#d0f8f0", text_sec: "#78d8c8", text_dim: "#306858", border: "rgba(0, 232, 200, 0.20)", border_solid: "#0a4040"},
    "NOIR": {bg: "#0a0a0a", bg_panel: "rgba(45, 45, 45, 0.78)", bg_menu: "#151515", accent: "#d4a030", accent_menu: "#f0b838", text_main: "#e8e0d0", text_sec: "#a09888", text_dim: "#606058", border: "rgba(212, 160, 48, 0.20)", border_solid: "#303028"},
    "BIOLUMINESCENCE": {bg: "#020810", bg_panel: "rgba(0, 120, 120, 0.42)", bg_menu: "#030c18", accent: "#00e8a8", accent_menu: "#00ffc0", text_main: "#c0f8f0", text_sec: "#60d8c8", text_dim: "#206858", border: "rgba(0, 232, 168, 0.22)", border_solid: "#0a3838"},
    "BRUTALIST": {bg: "#1a1a1a", bg_panel: "rgba(80, 80, 80, 0.55)", bg_menu: "#222222", accent: "#e03000", accent_menu: "#ff4010", text_main: "#f0f0f0", text_sec: "#c0c0c0", text_dim: "#808080", border: "rgba(224, 48, 0, 0.25)", border_solid: "#404040"},
    "OXOCARBON": {bg: "#161616", bg_panel: "rgba(38, 38, 38, 0.85)", bg_menu: "#262626", accent: "#0f62fe", accent_menu: "#4589ff", text_main: "#f4f4f4", text_sec: "#c6c6c6", text_dim: "#8d8d8d", border: "rgba(15, 98, 254, 0.25)", border_solid: "#393939"},
    "MATERIAL DARK": {bg: "#1a1c1e", bg_panel: "rgba(40, 48, 56, 0.80)", bg_menu: "#212325", accent: "#4fc3f7", accent_menu: "#0288d1", text_main: "#e1e2e8", text_sec: "#c1c2cb", text_dim: "#8589a0", border: "rgba(79, 195, 247, 0.18)", border_solid: "#3a3f4a"},
    "N7": {bg: "#080c14", bg_panel: "rgba(20, 30, 60, 0.78)", bg_menu: "#0c1428", accent: "#cc0000", accent_menu: "#4488cc", text_main: "#e8eeff", text_sec: "#7aa0cc", text_dim: "#3d5880", border: "rgba(204, 0, 0, 0.25)", border_solid: "#1a2848"},
    "TRON LEGACY": {bg: "#000000", bg_panel: "rgba(0, 200, 255, 0.08)", bg_menu: "#000508", accent: "#00c8ff", accent_menu: "#ff8c00", text_main: "#ffffff", text_sec: "#80d8ff", text_dim: "#204858", border: "rgba(0, 200, 255, 0.28)", border_solid: "#0a1a20"},
    "DEAD SPACE": {bg: "#020202", bg_panel: "rgba(255, 100, 20, 0.10)", bg_menu: "#050505", accent: "#ff6400", accent_menu: "#ff8030", text_main: "#f0f0f0", text_sec: "#ff9060", text_dim: "#602010", border: "rgba(255, 100, 32, 0.25)", border_solid: "#200800"},
    "COLONY SHIP": {bg: "#10120e", bg_panel: "rgba(50, 60, 40, 0.72)", bg_menu: "#141810", accent: "#c8b040", accent_menu: "#e0c850", text_main: "#d8e0c0", text_sec: "#909a70", text_dim: "#485840", border: "rgba(200, 176, 64, 0.22)", border_solid: "#303820"},
    "NECROMORPH": {bg: "#030808", bg_panel: "rgba(0, 80, 20, 0.60)", bg_menu: "#040a04", accent: "#80ff20", accent_menu: "#60c010", text_main: "#c8ffc0", text_sec: "#70c060", text_dim: "#306020", border: "rgba(128, 255, 32, 0.22)", border_solid: "#0a2808"},
    "CRIMSON PEAK": {bg: "#120508", bg_panel: "rgba(80, 15, 30, 0.75)", bg_menu: "#1a080c", accent: "#d4904a", accent_menu: "#e0b060", text_main: "#f0e0d8", text_sec: "#c0909a", text_dim: "#7a3848", border: "rgba(212, 144, 74, 0.22)", border_solid: "#5a1520"},
    "LAKESIDE CURSE": {bg: "#0c0a08", bg_panel: "rgba(60, 40, 20, 0.72)", bg_menu: "#141008", accent: "#e09030", accent_menu: "#f0b040", text_main: "#f0e8d0", text_sec: "#b09070", text_dim: "#706050", border: "rgba(224, 144, 48, 0.22)", border_solid: "#402808"},
    "THE BACKROOMS": {bg: "#1a1810", bg_panel: "rgba(220, 200, 100, 0.10)", bg_menu: "#201e14", accent: "#d4c840", accent_menu: "#f0e050", text_main: "#f0e8c8", text_sec: "#b0a870", text_dim: "#706840", border: "rgba(212, 200, 64, 0.22)", border_solid: "#3a3820"}
};

const THEME_CATEGORIES = {
    "Originals & System": ["DARK GRAY", "CREMA", "CYBERPUNK", "SNOW", "MOVIESFLIX", "VAPOUR OS", "PSIV BLUE", "GREEN BOX", "WIN XP"],
    "Gaming Legends": ["GAME BOY DMG", "PIP BOY", "SEVASTOPOL", "RIP AND TEAR CLASSIC", "SUPER BROTHERS", "GREEN HILL", "NES", "SNES", "BLOODBORNE", "METROID PRIME", "SILENT HILL", "DIABLO", "HALF-LIFE", "SHOVEL KNIGHT"],
    "Aesthetics": ["EARTHY & ORGANIC", "DOPAMINE BRIGHTS", "RETRO REVIVAL", "VAPORWAVE", "AURORA", "NOIR", "BIOLUMINESCENCE", "BRUTALIST"],
    "Linux Ricing": ["DRACULA", "GRUVBOX", "NORD", "SOLARIZED DARK", "CATPPUCCIN FRAPPÉ", "CATPPUCCIN MACCHIATO", "CATPPUCCIN MOCHA", "TOKYO NIGHT", "EVERFOREST", "ROSÉ PINE", "OXOCARBON", "MATERIAL DARK"],
    "Sci-Fi Universes": ["N7", "TRON LEGACY", "DEAD SPACE", "COLONY SHIP", "NECROMORPH"],
    "Horror Realm": ["CRIMSON PEAK", "LAKESIDE CURSE", "THE BACKROOMS"],
    "PSIII Colors": ["PSIII CLASSIC", "PSIII RED", "PSIII GREEN", "PSIII BLUE", "PSIII PURPLE", "PSIII GOLD", "PSIII SILVER"]
};

let activeTheme = "DARK GRAY";

function applyTheme(themeName) {
    const tConfig = THEMES[themeName];
    if (!tConfig) return;
    const root = document.documentElement;
    Object.keys(tConfig).forEach(key => root.style.setProperty(`--${key}`, tConfig[key]));
    activeTheme = themeName;
    window.api.setSetting('cngm_theme', themeName);
    try { localStorage.setItem('cngm_theme_cache', JSON.stringify(tConfig)); } catch(e) {}
}

const modalThemes = document.getElementById('modal-themes');
const themeList = document.getElementById('theme-list');
const themeTitle = document.getElementById('theme-modal-title');
const btnThemeBack = document.getElementById('btn-theme-back');

document.getElementById('btn-theme-switch').addEventListener('click', () => {
    document.getElementById('modal-tools').classList.remove('active');
    modalThemes.classList.add('active');
    renderThemeCategories();
});
document.getElementById('btn-close-themes').addEventListener('click', () => { modalThemes.classList.remove('active'); });
btnThemeBack.addEventListener('click', renderThemeCategories);

function renderThemeCategories() {
    themeTitle.innerText = t('theme.modal_title');
    btnThemeBack.style.display = 'none';
    themeList.innerHTML = '';
    Object.keys(THEME_CATEGORIES).forEach(category => {
        const btn = document.createElement('button');
        btn.innerText = category; btn.style.width = '100%';
        btn.addEventListener('click', () => renderThemesInCategory(category));
        themeList.appendChild(btn);
    });
}

function renderThemesInCategory(category) {
    themeTitle.innerText = category.toUpperCase();
    btnThemeBack.style.display = 'block';
    themeList.innerHTML = '';
    const themes = THEME_CATEGORIES[category] || [];
    themes.forEach(themeName => {
        if (!THEMES[themeName]) return;
        const btn = document.createElement('button');
        btn.innerText = themeName === activeTheme ? `★ ${themeName}` : themeName;
        btn.style.width = '100%';
        if (themeName === activeTheme) { btn.style.backgroundColor = "var(--border_solid)"; btn.style.color = "var(--text_main)"; }
        btn.addEventListener('click', () => { applyTheme(themeName); renderThemesInCategory(category); });
        themeList.appendChild(btn);
    });
}

window.api.getSetting('cngm_theme').then(saved => {
    applyTheme(saved && THEMES[saved] ? saved : activeTheme);
    window.api.signalReady();
    return window.api.getSetting('welcome_shown');
}).then(shown => {
    if (!shown) _welcomeModal.classList.add('active');
    // Auto-sync GRINDER installed status on every startup
    syncGrinderInstalled();
});

