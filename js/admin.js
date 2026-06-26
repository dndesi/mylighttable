// admin.js – Dashboard Logik
// v2.4 – setHero schreibt nicht mehr direkt zu GitHub (Race-Fix)

// ─── State ───────────────────────────────────────────────────────────────────

let state = {
  galleries: [],          // alle Galerien aus galleries_index.json
  current: null,          // aktuell bearbeitete Galerie (null = neue)
  files: [],              // Dateien in der aktuellen Galerie
  uploadQueue: [],
  isUploading: false
};

// ─── Init ────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  Auth.init(onLogin, onLogout);
  document.getElementById('btn-login').addEventListener('click', () => Auth.login());
  document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());
  document.getElementById('btn-new-gallery').addEventListener('click', openNewGallery);
  document.getElementById('btn-back').addEventListener('click', backToList);
  document.getElementById('btn-save-gallery').addEventListener('click', saveGallery);
  document.getElementById('btn-delete-gallery').addEventListener('click', deleteCurrentGallery);
  document.getElementById('upload-input').addEventListener('change', handleFileSelect);
  document.getElementById('btn-upload').addEventListener('click', startUpload);
});

// ─── Auth ────────────────────────────────────────────────────────────────────

async function onLogin() {
  showView('list');
  checkGithubToken();
  await loadGalleryList();
}

function onLogout() {
  state = { galleries: [], current: null, files: [], uploadQueue: [], isUploading: false };
  showView('login');
}

// ─── Galerie-Liste laden ──────────────────────────────────────────────────────

async function loadGalleryList() {
  showListStatus('Lade Galerien…', 'info');
  try {
    const data = await Drive.loadGalleriesIndex();
    state.galleries = data.galleries || [];
    renderGalleryList();
    showListStatus('', '');
  } catch (e) {
    showListStatus('Fehler beim Laden: ' + e.message, 'error');
  }
}

function renderGalleryList() {
  const list = document.getElementById('gallery-list');
  const empty = document.getElementById('list-empty');

  if (state.galleries.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = state.galleries.map(g => {
    const expired = g.expiry && new Date(g.expiry) < new Date();
    const days = g.expiry ? Math.ceil((new Date(g.expiry) - new Date()) / 86400000) : null;
    const expiryText = days === null ? 'Kein Ablaufdatum'
      : days > 0 ? `Läuft ab in ${days} Tag(en)`
      : '⚠️ Abgelaufen';
    const statusClass = expired ? 'expired' : 'active';
    const statusLabel = expired ? 'Abgelaufen' : 'Aktiv';

    return `
      <div class="gallery-list-card">
        <div class="glc-header">
          <div>
            <span class="glc-name">${g.name}</span>
            <span class="status-badge ${statusClass}">${statusLabel}</span>
          </div>
          <div class="glc-meta">
            PIN: <strong>${g.pin}</strong> · ${g.fileCount || 0} Medien · ${expiryText}
          </div>
        </div>
        <div class="glc-actions">
          <button class="btn btn-secondary btn-sm" onclick="openGallery('${g.id}')">Bearbeiten</button>
          <button class="btn btn-secondary btn-sm" onclick="copyShareMessage('${g.id}')">🔗 Link & PIN</button>
          <button class="btn btn-danger btn-sm" onclick="deleteGallery('${g.id}')">Löschen</button>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Galerie öffnen (Detail-View) ─────────────────────────────────────────────

async function openGallery(id) {
  const gallery = state.galleries.find(g => g.id === id);
  if (!gallery) return;
  state.current = { ...gallery };
  state.files = [];

  showDetailStatus('Lade Medien…', 'info');
  showView('detail');
  renderDetailForm(state.current);

  try {
    if (state.current.folderId) {
      state.files = await Drive.listFiles(state.current.folderId);
    }
    renderMediaGrid();
    showDetailStatus('', '');
    document.getElementById('detail-upload-section').style.display = 'block';
  } catch (e) {
    showDetailStatus('Fehler beim Laden: ' + e.message, 'error');
  }
}

function openNewGallery() {
  state.current = null;
  state.files = [];
  renderDetailForm(null);
  renderMediaGrid();
  document.getElementById('detail-upload-section').style.display = 'none';
  showDetailStatus('', '');
  showView('detail');
}

function backToList() {
  showView('list');
  renderGalleryList();
}

// ─── Galerie speichern ────────────────────────────────────────────────────────

async function saveGallery() {
  const name = document.getElementById('input-name').value.trim();
  const pin  = document.getElementById('input-pin').value.trim();
  const desc = document.getElementById('input-description').value.trim();
  const exp  = document.getElementById('input-expiry').value;

  if (!name) return showDetailStatus('Bitte einen Namen eingeben.', 'error');
  if (!pin || !/^\d{4}$/.test(pin)) return showDetailStatus('PIN muss genau 4 Ziffern sein.', 'error');

  // PIN-Konflikt prüfen (anderes Galerie mit gleichem PIN)
  const conflict = state.galleries.find(g => g.pin === pin && g.id !== state.current?.id);
  if (conflict) return showDetailStatus(`PIN ${pin} wird bereits von „${conflict.name}" verwendet.`, 'error');

  const btn = document.getElementById('btn-save-gallery');
  btn.disabled = true;
  btn.textContent = 'Speichert…';

  try {
    const isNew = !state.current?.id;
    const id = state.current?.id || generateId();
    const now = new Date().toISOString();

    // Drive-Ordner anlegen (neu)
    let folderId = state.current?.folderId || null;
    if (!folderId) {
      folderId = await Drive.ensureGalleryFolder(`${id}_${name}`);
    }

    // Public JSON für diese Galerie aktualisieren
    const pinHash = await hashPin(pin);
    const publicData = {
      galleryName: name,
      description: desc,
      expiry: exp || null,
      heroFileId: state.current?.heroFileId || null,
      files: state.files.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType || '' })),
      updatedAt: now
    };
    const publicFileId = await Drive.saveGalleryPublicFile(
      id, publicData, state.current?.publicFileId || null
    );

    // GitHub-Sync (Frontend liest von hier)
    try {
      await GitHub.saveFile(`data/gallery_public_${id}.json`, publicData);
    } catch (e) {
      showDetailStatus('⚠ GitHub-Sync: ' + e.message, 'error');
    }

    // Galerie-Objekt zusammenbauen
    const updated = {
      id, name, pin, description: desc,
      expiry: exp || null,
      heroFileId: state.current?.heroFileId || null,
      folderId, publicFileId,
      fileCount: state.files.length,
      createdAt: state.current?.createdAt || now,
      updatedAt: now
    };

    // Index aktualisieren
    if (isNew) {
      state.galleries.push(updated);
    } else {
      state.galleries = state.galleries.map(g => g.id === id ? updated : g);
    }
    await Drive.saveGalleriesIndex({ galleries: state.galleries });

    // Pin-Index neu schreiben
    await refreshPinIndex();

    state.current = updated;
    renderDetailForm(state.current);
    document.getElementById('detail-upload-section').style.display = 'block';
    showDetailStatus('Gespeichert ✓', 'success');
  } catch (e) {
    showDetailStatus('Fehler: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Speichern';
  }
}

// ─── Pin-Index neu schreiben ──────────────────────────────────────────────────

async function refreshPinIndex() {
  const pinObj = {};
  for (const g of state.galleries) {
    const hash = await hashPin(g.pin);
    pinObj[hash] = g.id;  // Gallery-ID → GitHub-Pfad data/gallery_public_{id}.json
  }

  // Drive-Backup
  const fileId = await Drive.savePinIndex(pinObj);
  showPinIndexHint(fileId);

  // GitHub (Frontend liest von hier)
  try {
    await GitHub.saveFile('data/pin_index.json', pinObj);
  } catch (e) {
    showDetailStatus('⚠ GitHub-Sync: ' + e.message, 'error');
  }

  return fileId;
}

function showPinIndexHint(fileId) {
  if (CONFIG.PUBLIC_INDEX_FILE_ID && CONFIG.PUBLIC_INDEX_FILE_ID === fileId) return;

  const html = `📋 <strong>Einmalig nötig:</strong> Trage diese ID in <code>js/config.js</code> als <code>PUBLIC_INDEX_FILE_ID</code> ein:<br>
    <code style="user-select:all;font-size:11px">${fileId}</code>`;

  // Im Detail-View anzeigen (sichtbar beim Speichern)
  const detailEl = document.getElementById('detail-status');
  detailEl.innerHTML = html;
  detailEl.className = 'status-bar info';
  detailEl.style.display = 'block';

  // Auch in der Listenansicht merken (sichtbar beim Zurücknavigieren)
  let listEl = document.getElementById('pin-index-hint');
  if (!listEl) {
    listEl = document.createElement('div');
    listEl.id = 'pin-index-hint';
    listEl.className = 'status-bar info';
    listEl.style.cssText = 'display:block;margin-bottom:16px;font-size:12px;word-break:break-all';
    document.getElementById('list-section').prepend(listEl);
  }
  listEl.innerHTML = html;
}

// ─── Galerie löschen (aus Liste) ──────────────────────────────────────────────

async function deleteGallery(id) {
  const g = state.galleries.find(x => x.id === id);
  if (!g) return;
  if (!confirm(`Galerie „${g.name}" und alle Medien wirklich löschen?\nDies kann nicht rückgängig gemacht werden.`)) return;

  showListStatus('Lösche Galerie…', 'info');
  try {
    if (g.folderId) await Drive.deleteFolder(g.folderId).catch(() => {});
    if (g.publicFileId) await Drive.deleteFile(g.publicFileId).catch(() => {});
    await GitHub.deleteFile(`data/gallery_public_${id}.json`).catch(() => {});
    state.galleries = state.galleries.filter(x => x.id !== id);
    await Drive.saveGalleriesIndex({ galleries: state.galleries });
    await refreshPinIndex();
    renderGalleryList();
    showListStatus('Galerie gelöscht.', 'info');
  } catch (e) {
    showListStatus('Fehler beim Löschen: ' + e.message, 'error');
  }
}

// ─── Galerie löschen (aus Detail-View) ───────────────────────────────────────

async function deleteCurrentGallery() {
  if (!state.current?.id) return;
  await deleteGallery(state.current.id);
  showView('list');
}

// ─── Link & PIN kopieren ──────────────────────────────────────────────────────

function copyShareMessage(id) {
  const g = state.galleries.find(x => x.id === id);
  if (!g) return;
  const base = window.location.href.replace('admin.html', 'index.html');
  const expiryLine = g.expiry
    ? `\nZugang verfügbar bis: ${new Date(g.expiry).toLocaleDateString('de-DE')}`
    : '';
  const msg = `Deine Galerie ist bereit 🔦\n\nLink: ${base}\nPIN: ${g.pin}${expiryLine}`;
  navigator.clipboard.writeText(msg).then(() => {
    showListStatus('Link & PIN kopiert ✓', 'success');
  }).catch(() => {
    prompt('Link & PIN (manuell kopieren):', msg);
  });
}

// ─── Upload ───────────────────────────────────────────────────────────────────

function handleFileSelect(e) {
  state.uploadQueue = Array.from(e.target.files);
  document.getElementById('upload-count').textContent =
    state.uploadQueue.length ? `${state.uploadQueue.length} Datei(en) ausgewählt` : '';
  document.getElementById('btn-upload').disabled = !state.uploadQueue.length;
}

async function startUpload() {
  if (!state.current?.folderId) return showDetailStatus('Bitte zuerst Galerie speichern.', 'error');
  if (!state.uploadQueue.length || state.isUploading) return;

  state.isUploading = true;
  document.getElementById('btn-upload').disabled = true;
  const bar = document.getElementById('upload-progress');
  const txt = document.getElementById('upload-progress-text');
  bar.style.display = 'block';

  const total = state.uploadQueue.length;
  let done = 0;

  for (const file of state.uploadQueue) {
    txt.textContent = `${file.name} (${done + 1}/${total})`;
    try {
      const uploaded = await Drive.uploadFile(file, state.current.folderId, pct => {
        bar.querySelector('.bar-fill').style.width = pct + '%';
      });
      await Drive.makeFilePublic(uploaded.id);
    } catch (e) {
      showDetailStatus(`Fehler bei ${file.name}: ${e.message}`, 'error');
    }
    done++;
  }

  // Remote ist autoritativ
  state.files = await Drive.listFiles(state.current.folderId);
  await syncCurrentGalleryPublic();
  renderMediaGrid();

  bar.style.display = 'none';
  txt.textContent = '';
  state.uploadQueue = [];
  state.isUploading = false;
  document.getElementById('upload-input').value = '';
  document.getElementById('upload-count').textContent = '';
  document.getElementById('btn-upload').disabled = false;
  showDetailStatus(`${total} Datei(en) hochgeladen ✓`, 'success');
}

// ─── Datei löschen ────────────────────────────────────────────────────────────

async function deleteFile(fileId, fileName) {
  if (!confirm(`„${fileName}" wirklich löschen?`)) return;
  try {
    await Drive.deleteFile(fileId);
    if (state.current?.heroFileId === fileId) {
      state.current.heroFileId = null;
    }
    state.files = state.files.filter(f => f.id !== fileId);
    await syncCurrentGalleryPublic();
    renderMediaGrid();
    showDetailStatus('Datei gelöscht ✓', 'success');
  } catch (e) {
    showDetailStatus('Fehler: ' + e.message, 'error');
  }
}

// ─── Hero setzen ──────────────────────────────────────────────────────────────

async function setHero(fileId) {
  if (!state.current) return;
  state.current.heroFileId = fileId;
  renderMediaGrid();
  showDetailStatus('Hero-Bild ausgewählt — bitte auf Speichern klicken.', 'info');
}

// ─── Public JSON der aktuellen Galerie synchronisieren ───────────────────────

async function syncCurrentGalleryPublic() {
  if (!state.current) return;
  const publicData = {
    galleryName: state.current.name,
    description: state.current.description || '',
    expiry: state.current.expiry || null,
    heroFileId: state.current.heroFileId || null,
    files: state.files.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType || '' })),
    updatedAt: new Date().toISOString()
  };

  // Alle Dateien öffentlich setzen (auch bereits vorhandene)
  await Promise.allSettled(state.files.map(f => Drive.makeFilePublic(f.id)));

  // Drive-Backup
  await Drive.saveGalleryPublicFile(state.current.id, publicData, state.current.publicFileId);

  // GitHub (Frontend liest von hier)
  try {
    await GitHub.saveFile(`data/gallery_public_${state.current.id}.json`, publicData);
  } catch (e) {
    console.warn('GitHub sync:', e.message);
  }

  // fileCount in Index aktualisieren
  state.current.fileCount = state.files.length;
  state.galleries = state.galleries.map(g => g.id === state.current.id ? { ...g, ...state.current } : g);
  await Drive.saveGalleriesIndex({ galleries: state.galleries });
}

// ─── Render: Detail-Formular ──────────────────────────────────────────────────

function renderDetailForm(g) {
  document.getElementById('detail-title').textContent = g ? g.name : 'Neue Galerie';
  document.getElementById('input-name').value = g?.name || '';
  document.getElementById('input-pin').value = g?.pin || '';
  document.getElementById('input-description').value = g?.description || '';
  document.getElementById('input-expiry').value = g?.expiry ? g.expiry.split('T')[0] : '';
  document.getElementById('btn-delete-gallery').style.display = g ? 'inline-flex' : 'none';
}

// ─── Render: Media Grid ───────────────────────────────────────────────────────

function renderMediaGrid() {
  const grid = document.getElementById('media-grid');
  const empty = document.getElementById('media-empty');
  if (!state.files.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  const heroId = state.current?.heroFileId;

  grid.innerHTML = state.files.map(file => {
    const isImage = file.mimeType?.startsWith('image/');
    const isVideo = file.mimeType?.startsWith('video/');
    const isHero  = file.id === heroId;
    const thumb   = isImage ? Drive.getThumbnailUrl(file.id) : null;

    return `
      <div class="media-card ${isHero ? 'is-hero' : ''}">
        <div class="media-thumb">
          ${thumb
            ? `<img src="${thumb}" alt="${file.name}" loading="lazy">`
            : `<div class="media-icon">${isVideo ? '▶' : '📄'}</div>`}
          ${isHero ? '<span class="hero-badge">Hero</span>' : ''}
        </div>
        <div class="media-info">
          <span class="media-name" title="${file.name}">${file.name}</span>
        </div>
        <div class="media-actions">
          ${isImage && !isHero
            ? `<button class="btn-icon" onclick="setHero('${file.id}')" title="Als Hero-Bild setzen">⭐</button>`
            : ''}
          <button class="btn-icon btn-delete" onclick="deleteFile('${file.id}','${file.name.replace(/'/g,"\\'")}')" title="Löschen">✕</button>
        </div>
      </div>`;
  }).join('');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── GitHub Token Setup ───────────────────────────────────────────────────────

function checkGithubToken() {
  const bar = document.getElementById('github-token-bar');
  if (bar) bar.style.display = GitHub.getToken() ? 'none' : 'block';
}

function saveGithubToken() {
  const val = document.getElementById('input-github-token').value.trim();
  if (!val) return;
  GitHub.setToken(val);
  document.getElementById('input-github-token').value = '';
  checkGithubToken();
  showListStatus('GitHub Token gespeichert ✓', 'success');
}

function resetGithubToken() {
  GitHub.setToken(null);
  checkGithubToken();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

async function hashPin(pin) {
  const data = new TextEncoder().encode(pin);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function showView(view) {
  document.getElementById('view-login').style.display  = view === 'login'  ? 'flex'  : 'none';
  document.getElementById('view-list').style.display   = view === 'list'   ? 'block' : 'none';
  document.getElementById('view-detail').style.display = view === 'detail' ? 'block' : 'none';
}

function showListStatus(msg, type) {
  _setStatus('list-status', msg, type);
}

function showDetailStatus(msg, type) {
  _setStatus('detail-status', msg, type);
}

function _setStatus(id, msg, type) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = 'status-bar ' + (type || '');
  el.style.display = msg ? 'block' : 'none';
}
