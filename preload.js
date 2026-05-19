const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getBaseDir: () => ipcRenderer.invoke('get-basedir'),
                                getGames: () => ipcRenderer.invoke('get-games'),
                                addGame: (name) => ipcRenderer.invoke('add-game', name),
                                updateGame: (id, data) => ipcRenderer.invoke('update-game', id, data),
                                deleteGame: (id) => ipcRenderer.invoke('delete-game', id),
                                signalReady: () => ipcRenderer.send('renderer-ready'),
                                verifyInstallStatus: (id) => ipcRenderer.invoke('verify-install-status', id),
                                openInstallUrl: (url) => ipcRenderer.invoke('open-install-url', url),
                                checkAllInstallStatus: () => ipcRenderer.invoke('check-all-install-status'),
                                setLaunchCommand: (id, cmd) => ipcRenderer.invoke('set-launch-command', id, cmd),
                                onInstallStatusUpdated: (cb) => ipcRenderer.on('install-status-updated', () => cb()),
                                syncHeroic: () => ipcRenderer.invoke('sync-heroic'),
                                launchAndWatchHeroic: () => ipcRenderer.invoke('launch-and-watch-heroic'),
                                cancelHeroicWatch: () => ipcRenderer.invoke('cancel-heroic-watch'),
                                onHeroicWatchStatus: (cb) => ipcRenderer.on('heroic-watch-status', (e, d) => cb(d)),
                                syncSteam: (steamId, apiKey) => ipcRenderer.invoke('sync-steam', steamId, apiKey),
                                autoFetch: (id, name, appId) => ipcRenderer.invoke('auto-fetch', id, name, appId),
                                searchSteam: (name) => ipcRenderer.invoke('search-steam', name),
                                launchGame: (cmd) => ipcRenderer.send('launch-game', cmd),
                                syncGog: () => ipcRenderer.invoke('sync-gog'),

                                // --- GAMING HISTORY ---
                                updateLastPlayed: (id) => ipcRenderer.invoke('update-last-played', id),
                                clearHistory: () => ipcRenderer.invoke('clear-history'),

                                // --- UI SCALING ---
                                setZoomLevel: (level) => webFrame.setZoomFactor(level),

                                // --- HLTB, PROTON, SGDB & LOCAL MEDIA ---
                                fetchHltb: (g) => ipcRenderer.invoke('fetch-hltb', g),
                                fetchProton: (id) => ipcRenderer.invoke('fetch-proton', id),

                                sgdbSearch: (g, k, id, assetType) => ipcRenderer.invoke('sgdb-search', g, k, id, assetType),
                                sgdbApply: (id, url, assetType) => ipcRenderer.invoke('sgdb-apply', id, url, assetType),

                                selectLocalImage: (id, type) => ipcRenderer.invoke('select-local-image', id, type),
                                getSetting: (k) => ipcRenderer.invoke('get-setting', k),
                                setSetting: (k, v) => ipcRenderer.invoke('set-setting', k, v),
                                openWebPopup: (url) => ipcRenderer.invoke('open-web-popup', url),

                                // --- TRAILERS ---
                                checkLocalTrailer: (g) => ipcRenderer.invoke('check-local-trailer', g),
                                fetchSteamTrailer: (appId) => ipcRenderer.invoke('fetch-steam-trailer', appId),
                                searchYoutube: (g) => ipcRenderer.invoke('search-youtube', g),
                                downloadTrailer: (g, id) => ipcRenderer.invoke('download-trailer', g, id),
                                deleteTrailer: (g) => ipcRenderer.invoke('delete-trailer', g),
                                onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (e, d) => cb(d)),

                                // --- DATA TOOLS & CSV ---
                                downloadCsvTemplate: () => ipcRenderer.invoke('download-csv-template'),
                                exportCsv: () => ipcRenderer.invoke('export-csv'),
                                importCsv: () => ipcRenderer.invoke('import-csv'),
                                clearBrowserData: () => ipcRenderer.invoke('clear-browser-data'),
                                backupZip: () => ipcRenderer.invoke('backup-zip'),
                                restoreZip: () => ipcRenderer.invoke('restore-zip'),
                                onZipStarted: (cb) => ipcRenderer.on('zip-started', () => cb()),

                                // FIX: New Image Cleanup Tools
                                cleanUnusedImages: () => ipcRenderer.invoke('clean-unused-images'),
                                clearAllImages: () => ipcRenderer.invoke('clear-all-images'),

                                // --- SYSTEM ---
                                installToMenu: () => ipcRenderer.invoke('install-to-menu'),

                                // --- CREMA COMPANION ---
                                checkCrema: () => ipcRenderer.invoke('check-crema'),
                                launchCrema: () => ipcRenderer.send('launch-crema'),

                                // --- IGDB ---
                                igdbTest: () => ipcRenderer.invoke('igdb-test'),

                                // --- I18N ---
                                getStrings: (lang) => ipcRenderer.invoke('get-strings', lang),

                                // --- GRINDER ---
                                openGrinder: (name) => ipcRenderer.invoke('open-grinder', name),
                                setGrinderGame: (id, gid) => ipcRenderer.invoke('set-grinder-game', id, gid),
                                grinderStatus: () => ipcRenderer.invoke('grinder-status'),
                                syncGrinderInstalled: (ids) => ipcRenderer.invoke('sync-grinder-installed', ids),

                                // --- MANUAL ---
                                openManual: () => ipcRenderer.send('open-manual'),

                                // --- WINDOW CONTROLS ---
                                minimizeApp: () => ipcRenderer.send('window-minimize'),
                                maximizeApp: () => ipcRenderer.send('window-maximize'),
                                closeApp: () => ipcRenderer.send('window-close')
});
