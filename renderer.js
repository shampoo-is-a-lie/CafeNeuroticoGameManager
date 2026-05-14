let allGames = [];
let currentGameId = null;
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
            window.location.reload();
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
    const confirmClear = confirm(t('confirm.clear_history'));
    if (confirmClear) {
        const success = await window.api.clearHistory();
        if (success) {
            await loadGames();
            alert(t('alert.history_cleared'));
        }
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

// --- FLOATING MANUAL LOGIC ---
const floatingManual = document.getElementById('floating-manual');
const manualHeader = document.getElementById('manual-header');

document.addEventListener('click', (e) => { if (e.target.id === 'btn-open-manual') { document.getElementById('modal-about').classList.remove('active'); floatingManual.style.display = 'flex'; } });
document.getElementById('btn-tools-manual').addEventListener('click', () => { document.getElementById('modal-tools').classList.remove('active'); floatingManual.style.display = 'flex'; });
document.getElementById('btn-close-floating-manual').addEventListener('click', () => { floatingManual.style.display = 'none'; });

let isDraggingManual = false; let manualOffsetX = 0; let manualOffsetY = 0;
manualHeader.addEventListener('mousedown', (e) => {
    isDraggingManual = true;
    manualOffsetX = e.clientX - floatingManual.getBoundingClientRect().left;
    manualOffsetY = e.clientY - floatingManual.getBoundingClientRect().top;
    document.addEventListener('mousemove', manualDrag);
    document.addEventListener('mouseup', manualStopDrag);
});
function manualDrag(e) {
    if (!isDraggingManual) return;
    floatingManual.style.left = (e.clientX - manualOffsetX) + 'px';
    floatingManual.style.top = (e.clientY - manualOffsetY) + 'px';
}
function manualStopDrag() {
    isDraggingManual = false;
    document.removeEventListener('mousemove', manualDrag);
    document.removeEventListener('mouseup', manualStopDrag);
}

const manualNavBtns = document.querySelectorAll('.manual-nav-btn');
const manualContent = document.getElementById('manual-content');
manualNavBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        manualNavBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        const targetEl = document.getElementById(targetId);
        if (targetEl) { manualContent.scrollTo({ top: targetEl.offsetTop - manualContent.offsetTop, behavior: 'smooth' }); }
    });
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

async function loadGames() {
    const res = await window.api.getGames();
    let games = res.games || [];
    allGames = games.filter(g => g.Game && g.Game !== 'null');
    applyFilters();
}

document.getElementById('search-bar').addEventListener('input', applyFilters);

const filterButtons = document.querySelectorAll('#sidebar-filters button');
filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        filterButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.getAttribute('data-filter');
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
        else if (currentFilter === 'amazon') matchesCategory = storeLower.includes('amazon');
        else if (currentFilter === 'apps') matchesCategory = storeLower.includes('apps');
        else if (currentFilter === 'others') matchesCategory = storeLower.includes('others');
        else if (currentFilter === 'emulation') matchesCategory = storeLower.includes('emulation');

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
        tr.innerHTML = `
        <td>${game.LaunchCommand ? `<button class="primary btn-play" data-cmd="${game.LaunchCommand.replace(/"/g, '&quot;')}" data-id="${game.id}" style="padding: 4px 8px;">${t('status.play')}</button>` : `<span style="color:#555; font-size:12px;">${t('game.no_cmd')}</span>`}</td>
        <td style="color: #ffeb3b;">${game.FAV === 'YES' ? '★' : ''}</td>
        <td style="color: #ff9800;">${game.WANT_TO_PLAY === 'YES' ? '⚑' : ''}</td>
        <td style="font-weight: bold;">${game.Game}</td>
        <td>${displayStore}</td>
        <td>${game.GENRE || ''}</td>
        <td>${game.RELEASED || ''}</td>
        `;
        tr.addEventListener('dblclick', () => openGamepage(game));
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

    document.querySelectorAll('.btn-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.api.launchGame(btn.getAttribute('data-cmd'));
            window.api.updateLastPlayed(btn.getAttribute('data-id')).then(() => loadGames());
        });
    });
}

function getStoreLogo(store) {
    if (!store) return null;
    const s = store.toLowerCase();
    if (s.includes('steam'))    return 'assets/logos/steam.png';
    if (s.includes('gog'))      return 'assets/logos/gog.png';
    if (s.includes('epic'))     return 'assets/logos/epic.png';
    if (s.includes('amazon'))   return 'assets/logos/amazon.png';
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
        const imgHtml = imgSrc ? `<img src="${imgSrc}" class="gallery-cover">` : `<div class="gallery-cover" style="display:flex; align-items:center; justify-content:center; color:#555; font-size:12px;">${t('game.no_cover')}</div>`;
        const logo = getStoreLogo(game.Store);
        const badgeHtml = logo ? `<div class="gallery-store-badge" style="-webkit-mask-image: url('${logo}');"></div>` : '';
        div.innerHTML = `
        <div class="gallery-cover-wrap">${imgHtml}${badgeHtml}</div>
        <div class="gallery-title">${game.Game}</div>
        ${game.LaunchCommand ? `<button class="btn-play-gallery primary" data-cmd="${game.LaunchCommand.replace(/"/g, '&quot;')}" data-id="${game.id}" style="margin: 5px; font-size: 12px; padding: 4px;">${t('status.play')}</button>` : ''}
        `;
        div.addEventListener('dblclick', () => openGamepage(game));
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

    document.querySelectorAll('.btn-play-gallery').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.api.launchGame(btn.getAttribute('data-cmd'));
            window.api.updateLastPlayed(btn.getAttribute('data-id')).then(() => loadGames());
        });
    });
}

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

    const favBtn = document.getElementById('btn-gamepage-fav');
    const wantBtn = document.getElementById('btn-gamepage-want');

    // Hero Art
    if (game.HeroArt && game.HeroArt.trim() !== "") {
        heroEl.style.backgroundImage = `url('${getSafePath(game.HeroArt)}')`;
    } else if (game.Screenshot && game.Screenshot.trim() !== "") {
        const screens = String(game.Screenshot).split('|').filter(s => s.trim() !== "");
        heroEl.style.backgroundImage = `url('${getSafePath(screens[0])}')`;
    } else {
        heroEl.style.backgroundImage = "none";
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

    // Play Button
    if (currentLaunchCmd) {
        playBtn.style.display = 'block';
        playBtn.onclick = () => {
            window.api.launchGame(currentLaunchCmd);
            window.api.updateLastPlayed(currentGameId).then(() => loadGames());
        };
    } else {
        playBtn.style.display = 'none';
        playBtn.onclick = null;
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
    if (success) alert(t('alert.trailer_deleted')); else alert(t('alert.no_trailer'));
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
        alert(t('alert.save_failed'));
    }
});

document.getElementById('btn-delete-game').addEventListener('click', async () => {
    if (!currentGameId) return;
    const confirmDelete = confirm(t('confirm.delete_game'));
    if (confirmDelete) {
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
    alert(result.message);
    if (result.success) {
        await loadGames();
        const updatedGame = allGames.find(g => g.id === gameId);
        if (updatedGame) openDetails(updatedGame); // Refresh edit UI with new fields
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
    if (!appId) { alert(t('alert.proton_id_required')); return; }
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
        lst.innerHTML = ''; stat.innerText = t('status.searching_yt', {name: gameName});
        const results = await window.api.searchYoutube(gameName);
        if (results.length === 0) { stat.innerText = t('status.no_yt'); return; }
        stat.innerText = t('status.select_video');
        results.forEach((res, i) => {
            const div = document.createElement('div');
            div.className = 'yt-search-item';
            div.innerHTML = `<img src="${res.thumbnail}" style="width: 120px; border-radius: 4px;"><div style="color: var(--text_main); font-weight: bold;">${res.title}</div>`;
            div.addEventListener('click', () => { document.getElementById('modal-trailer-search').classList.remove('active'); openTrailerProgress(gameName, res.id); });
            lst.appendChild(div);
        });
    }
});

function openTrailerProgress(gameName, videoId) {
    document.getElementById('modal-trailer-progress').classList.add('active');
    document.getElementById('dl-progress-game').innerText = gameName;
    document.getElementById('dl-progress-fill').style.width = "0%"; document.getElementById('dl-progress-text').innerText = "0%";
    window.api.downloadTrailer(gameName, videoId).then(success => {
        document.getElementById('modal-trailer-progress').classList.remove('active');
        if (success) {
            alert(t('status.download_complete'));
            // Refresh logic to pick up the new video file could go here
        } else {
            alert(t('status.download_failed'));
        }
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
    modalConnect.classList.add('active');
    document.getElementById('igdb-status').innerText = '';
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
document.getElementById('btn-close-modal').addEventListener('click', () => modalConnect.classList.remove('active'));

document.getElementById('btn-sync-heroic').addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-heroic');
    btn.innerText = t('status.syncing');
    const result = await window.api.syncHeroic();
    alert(result.message);
    if (result.success) loadGames();
    btn.innerText = t('status.sync_heroic');
});

document.getElementById('btn-sync-steam').addEventListener('click', async () => {
    const steamId = document.getElementById('steam-id').value.trim();
    const apiKey = document.getElementById('steam-api-key').value.trim();
    if (!steamId || !apiKey) { alert(t('alert.steam_id_required')); return; }
    await window.api.setSetting('steam_id', steamId); await window.api.setSetting('steam_api_key', apiKey);
    const btn = document.getElementById('btn-sync-steam');
    btn.innerText = t('status.fetching'); btn.disabled = true;
    const result = await window.api.syncSteam(steamId, apiKey);
    alert(result.message);
    if (result.success) loadGames();
    btn.innerText = t('status.fetch_steam'); btn.disabled = false;
});

document.getElementById('btn-sync-gog').addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-gog');
    btn.innerText = t('status.wait_login'); btn.disabled = true;
    const result = await window.api.syncGog();
    alert(result.message);
    if (result.success) loadGames();
    btn.innerText = t('status.fetch_gog'); btn.disabled = false;
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
        if (confirm(t('status.sync_batch_prompt'))) {
            document.getElementById('btn-batch-fetch').click();
        }
    }
});

document.getElementById('btn-close-update-info').addEventListener('click', () => {
    document.getElementById('modal-update-info').classList.remove('active');
});

document.getElementById('btn-clear-data').addEventListener('click', async () => {
    const confirmed = confirm(t('confirm.clear_browser'));
    if (confirmed) { const result = await window.api.clearBrowserData(); alert(result.message); }
});

// Image Cleanup Handlers
document.getElementById('btn-clean-images').addEventListener('click', async () => {
    const confirmed = confirm(t('confirm.clean_images'));
    if (confirmed) {
        const result = await window.api.cleanUnusedImages();
        alert(result.message);
    }
});

document.getElementById('btn-clear-all-images').addEventListener('click', async () => {
    const confirmed = confirm(t('confirm.clear_all_images'));
    if (confirmed) {
        const result = await window.api.clearAllImages();
        alert(result.message);
        loadGames();
    }
});


window.api.onZipStarted(() => { document.getElementById('modal-tools').classList.remove('active'); document.getElementById('modal-zip-progress').classList.add('active'); });

document.getElementById('btn-backup-zip').addEventListener('click', async () => {
    const result = await window.api.backupZip();
    document.getElementById('modal-zip-progress').classList.remove('active');
    if (result.message) alert(result.message);
});

document.getElementById('btn-restore-zip').addEventListener('click', async () => {
    const confirmed = confirm(t('confirm.restore_backup'));
    if (confirmed) {
        const result = await window.api.restoreZip();
        document.getElementById('modal-zip-progress').classList.remove('active');
        if (result.message) alert(result.message);
    }
});

const modalTools = document.getElementById('modal-tools');
document.getElementById('btn-open-tools').addEventListener('click', () => { modalTools.classList.add('active'); document.getElementById('batch-status').innerText = ""; document.getElementById('install-menu-status').innerText = ""; });

document.getElementById('btn-install-menu').addEventListener('click', async () => {
    const btn = document.getElementById('btn-install-menu');
    const status = document.getElementById('install-menu-status');
    btn.disabled = true; btn.innerText = t('status.installing'); status.style.color = 'var(--text_dim)'; status.innerText = '';
    const result = await window.api.installToMenu();
    btn.disabled = false; btn.innerText = t('status.add_to_menu');
    status.style.color = result.success ? '#66bb6a' : '#ef5350';
    status.innerText = result.message;
});
document.getElementById('btn-close-tools').addEventListener('click', () => modalTools.classList.remove('active'));

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

document.getElementById('btn-add-game').addEventListener('click', async () => {
    const result = await window.api.addGame();
    if (result.success) {
        await loadGames();
        const newGame = allGames.find(g => g.id === result.id);
        if (newGame) { openDetails(newGame); document.getElementById('edit-name').focus(); }
    } else { alert(t('alert.add_failed')); }
});

document.getElementById('btn-template-csv').addEventListener('click', async () => { const result = await window.api.downloadCsvTemplate(); if (result && result.message) alert(result.message); });
document.getElementById('btn-export-csv').addEventListener('click', async () => { const result = await window.api.exportCsv(); if (result && result.message) alert(result.message); });
document.getElementById('btn-import-csv').addEventListener('click', async () => {
    const btn = document.getElementById('btn-import-csv');
    btn.innerText = t('status.importing'); btn.disabled = true;
    const result = await window.api.importCsv();
    if (result && result.message) { alert(result.message); if (result.success) loadGames(); }
    btn.innerText = t('status.import_csv'); btn.disabled = false;
});

// --- THEME ENGINE ---

function updateHeroMosaic(filtered, filterName) {
    clearInterval(heroKbInterval);
    const iconContainer = document.getElementById('hero-icon');
    const kbImg = document.getElementById('hero-kb-img');
    const nameEl = document.getElementById('hero-game-name');

    const filterMap = {
        'all': { text: t('filter.all'), icon: 'all_games' }, 'playable': { text: t('filter.playable'), icon: 'playable' },
        'favs': { text: t('filter.favorites'), icon: 'favs' }, 'want': { text: t('filter.want'), icon: 'want_to_play' },
        'steam': { text: 'STEAM', icon: 'steam' }, 'epic': { text: 'EPIC', icon: 'epic' },
        'gog': { text: 'GOG', icon: 'gog' }, 'physical': { text: t('filter.physical'), icon: 'physical' },
        'others': { text: t('filter.others'), icon: 'others' }, 'emulation': { text: t('filter.emulation'), icon: 'emulation' },
        'amazon': { text: 'AMAZON GAMES', icon: 'amazon' }, 'apps': { text: t('filter.apps'), icon: 'apps' }
    };
    const currentCat = filterMap[filterName] || { text: filterName.toUpperCase(), icon: filterName };
    document.getElementById('gallery-category-text').innerText = currentCat.text;
    const countEl = document.getElementById('gallery-category-count');
    if (countEl) countEl.innerText = `${filtered.length} ${filtered.length === 1 ? t('game.singular') : t('game.plural')}`;
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

    "GREEN BOX": {bg: "#101010", bg_panel: "rgba(26,26,26,0.8)", bg_menu: "#1a1a1a", accent: "#107C10", accent_menu: "#107C10", text_main: "#ffffff", text_sec: "#D2D2D2", text_dim: "#777777", border: "rgba(16,124,16,0.4)", border_solid: "#333333"},
    "MOVIESFLIX": {bg: "#141414", bg_panel: "rgba(0,0,0,0.75)", bg_menu: "#000000", accent: "#E50914", accent_menu: "#E50914", text_main: "#ffffff", text_sec: "#B3B3B3", text_dim: "#808080", border: "rgba(229,9,20,0.3)", border_solid: "#333333"},

    "SNOW": {bg: "#E0E0E0", bg_panel: "rgba(255, 255, 255, 0.7)", bg_menu: "#FFFFFF", accent: "#000000", accent_menu: "#000000", text_main: "#111111", text_sec: "#444444", text_dim: "#777777", border: "rgba(0, 0, 0, 0.1)", border_solid: "#CCCCCC"},

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
    "SOLARIZED LIGHT": {bg: "#fdf6e3", bg_panel: "rgba(238, 232, 213, 0.8)", bg_menu: "#eee8d5", accent: "#2aa198", accent_menu: "#d33682", text_main: "#657b83", text_sec: "#586e75", text_dim: "#93a1a1", border: "rgba(42, 161, 152, 0.2)", border_solid: "#ccc2a8"},
    "CATPPUCCIN MOCHA": {bg: "#1e1e2e", bg_panel: "rgba(30, 30, 46, 0.8)", bg_menu: "#181825", accent: "#cba6f7", accent_menu: "#f5c2e7", text_main: "#cdd6f4", text_sec: "#bac2de", text_dim: "#6c7086", border: "rgba(203, 166, 247, 0.2)", border_solid: "#313244"},
    "CATPPUCCIN MACCHIATO": {bg: "#24273a", bg_panel: "rgba(36, 39, 58, 0.8)", bg_menu: "#1e2030", accent: "#c6a0f6", accent_menu: "#f4b8e4", text_main: "#cad3f5", text_sec: "#b8c0e0", text_dim: "#6e738d", border: "rgba(198, 160, 246, 0.2)", border_solid: "#363a4f"},
    "CATPPUCCIN FRAPPÉ": {bg: "#303446", bg_panel: "rgba(48, 52, 70, 0.8)", bg_menu: "#292c3c", accent: "#ca9ee6", accent_menu: "#f2d5cf", text_main: "#c6d0f5", text_sec: "#b5bfe2", text_dim: "#737994", border: "rgba(202, 158, 230, 0.2)", border_solid: "#414559"},
    "CATPPUCCIN LATTE": {bg: "#eff1f5", bg_panel: "rgba(239, 241, 245, 0.8)", bg_menu: "#e6e9ef", accent: "#8839ef", accent_menu: "#1e66f5", text_main: "#4c4f69", text_sec: "#5c5f77", text_dim: "#9ca0b0", border: "rgba(136, 57, 239, 0.2)", border_solid: "#ccd0da"},
    "TOKYO NIGHT": {bg: "#1a1b26", bg_panel: "rgba(36, 40, 59, 0.8)", bg_menu: "#16161e", accent: "#7aa2f7", accent_menu: "#bb9af7", text_main: "#c0caf5", text_sec: "#a9b1d6", text_dim: "#7885ac", border: "rgba(122, 162, 247, 0.2)", border_solid: "#3d4468"},
    "EVERFOREST": {bg: "#2b3339", bg_panel: "rgba(50, 56, 62, 0.8)", bg_menu: "#2f383e", accent: "#a7c080", accent_menu: "#e67e80", text_main: "#d3c6aa", text_sec: "#a7c080", text_dim: "#859289", border: "rgba(167, 192, 128, 0.2)", border_solid: "#4b565c"},
    "ROSÉ PINE": {bg: "#191724", bg_panel: "rgba(31, 29, 46, 0.8)", bg_menu: "#1f1d2e", accent: "#c4a7e7", accent_menu: "#ebbcba", text_main: "#e0def4", text_sec: "#9ccfd8", text_dim: "#6e6a86", border: "rgba(196, 167, 231, 0.2)", border_solid: "#26233a"},

    "GAME BOY DMG": {bg: "#8bac0f", bg_panel: "rgba(155, 188, 15, 0.5)", bg_menu: "#8bac0f", accent: "#0f380f", accent_menu: "#0f380f", text_main: "#0f380f", text_sec: "#306230", text_dim: "#4a7010", border: "rgba(15, 56, 15, 0.2)", border_solid: "#5a8818"},
    "PIP BOY": {bg: "#000000", bg_panel: "rgba(0, 20, 0, 0.7)", bg_menu: "#001100", accent: "#14ff00", accent_menu: "#14ff00", text_main: "#14ff00", text_sec: "#0ea000", text_dim: "#0a6000", border: "rgba(20, 255, 0, 0.2)", border_solid: "#0ea000"},
    "SEVASTOPOL": {bg: "#050d05", bg_panel: "rgba(10, 25, 10, 0.7)", bg_menu: "#081808", accent: "#f5e6b3", accent_menu: "#ff0000", text_main: "#f5e6b3", text_sec: "#a39977", text_dim: "#4d594d", border: "rgba(245, 230, 179, 0.1)", border_solid: "#1a331a"},
    "RIP AND TEAR CLASSIC": {bg: "#1a0000", bg_panel: "rgba(40, 0, 0, 0.8)", bg_menu: "#2b0000", accent: "#ff0000", accent_menu: "#ff3333", text_main: "#ffcc00", text_sec: "#ff6600", text_dim: "#990000", border: "rgba(255, 0, 0, 0.3)", border_solid: "#800000"},

    "SUPER BROTHERS": {bg: "#5C94FC", bg_panel: "rgba(200,76,12,0.8)", bg_menu: "#C84C0C", accent: "#F8D820", accent_menu: "#F8D820", text_main: "#ffffff", text_sec: "#FFCE9E", text_dim: "#E8A274", border: "rgba(248,216,32,0.4)", border_solid: "#000000"},
    "GREEN HILL": {bg: "#2492FF", bg_panel: "rgba(136,68,0,0.8)", bg_menu: "#00A800", accent: "#F8B800", accent_menu: "#F8B800", text_main: "#ffffff", text_sec: "#E0E0E0", text_dim: "#A0A0A0", border: "rgba(248,184,0,0.5)", border_solid: "#000000"},
    "NES": {bg: "#808080", bg_panel: "rgba(0,0,0,0.85)", bg_menu: "#333333", accent: "#E00000", accent_menu: "#E00000", text_main: "#ffffff", text_sec: "#CCCCCC", text_dim: "#888888", border: "rgba(224,0,0,0.4)", border_solid: "#000000"},
    "SNES": {bg: "#b5b6b5", bg_panel: "rgba(200, 200, 200, 0.8)", bg_menu: "#e2e2e2", accent: "#524b82", accent_menu: "#827aa5", text_main: "#333333", text_sec: "#555555", text_dim: "#777777", border: "rgba(82, 75, 130, 0.2)", border_solid: "#a098cc"},

    "EARTHY & ORGANIC": {bg: "#3E4E3A", bg_panel: "rgba(91, 107, 85, 0.7)", bg_menu: "#4F5D48", accent: "#D4B28C", accent_menu: "#A9C298", text_main: "#F3EDE4", text_sec: "#D8D3C8", text_dim: "#8E9E88", border: "rgba(212, 178, 140, 0.2)", border_solid: "#6b7d63"},

    "DOPAMINE BRIGHTS": {bg: "#FF3366", bg_panel: "rgba(20,20,20,0.8)", bg_menu: "#1a1a1a", accent: "#00E5FF", accent_menu: "#FFEB3B", text_main: "#ffffff", text_sec: "#CCCCCC", text_dim: "#888888", border: "rgba(0,229,255,0.4)", border_solid: "#333333"},

    "RETRO REVIVAL": {bg: "#F2D1C9", bg_panel: "rgba(240, 200, 190, 0.8)", bg_menu: "#E8C0B5", accent: "#E05A47", accent_menu: "#6C8A9B", text_main: "#4A403A", text_sec: "#72655A", text_dim: "#A28E84", border: "rgba(224, 90, 71, 0.2)", border_solid: "#E05A47"}
};

const THEME_CATEGORIES = {
    "Originals & System": ["DARK GRAY", "CREMA", "CYBERPUNK", "SNOW", "MOVIESFLIX", "VAPOUR OS", "PSIV BLUE", "GREEN BOX", "WIN XP"],
    "Gaming Legends": ["GAME BOY DMG", "PIP BOY", "SEVASTOPOL", "RIP AND TEAR CLASSIC", "SUPER BROTHERS", "GREEN HILL", "NES", "SNES"],
    "Aesthetics": ["EARTHY & ORGANIC", "DOPAMINE BRIGHTS", "RETRO REVIVAL"],
    "Linux Ricing": ["DRACULA", "GRUVBOX", "NORD", "SOLARIZED DARK", "SOLARIZED LIGHT", "CATPPUCCIN LATTE", "CATPPUCCIN FRAPPÉ", "CATPPUCCIN MACCHIATO", "CATPPUCCIN MOCHA", "TOKYO NIGHT", "EVERFOREST", "ROSÉ PINE"],
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

window.api.getSetting('cngm_theme').then(saved => { applyTheme(saved && THEMES[saved] ? saved : activeTheme); });
