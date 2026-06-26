// app.js – Frontend Galerie-Logik
// v2.7 – Download-Tracking via CountAPI

const API      = 'https://www.googleapis.com/drive/v3';
const RAW_BASE = 'https://raw.githubusercontent.com/dndesi/mylighttable/master/data';
let pinIndex          = null;   // { hash: publicFileId }
let galleryMeta       = null;   // aktuelle Galerie-Daten
let currentLightboxIndex = -1;  // aktiver Index in der Lightbox

// ─── Init ────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('pin-form').addEventListener('submit', handlePinSubmit);
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLightbox();
  });
  document.getElementById('lightbox-prev').addEventListener('click', () => moveLightbox(-1));
  document.getElementById('lightbox-next').addEventListener('click', () => moveLightbox(1));
  document.getElementById('btn-download-all').addEventListener('click', downloadAll);
  document.getElementById('btn-download-selected').addEventListener('click', downloadSelected);
  document.getElementById('lightbox-download').addEventListener('click', () => {
    const file = galleryMeta?.files?.[currentLightboxIndex];
    if (file) trackDownloadHit(file.id);
  });

  // Tastatur-Navigation für Lightbox
  document.addEventListener('keydown', e => {
    const lb = document.getElementById('lightbox-overlay');
    if (lb.style.display === 'none' || !lb.style.display) return;
    if (e.key === 'ArrowLeft')  moveLightbox(-1);
    if (e.key === 'ArrowRight') moveLightbox(1);
    if (e.key === 'Escape')     closeLightbox();
  });

  await loadPinIndex();
});

// ─── PIN-Index laden ──────────────────────────────────────────────────────────

async function loadPinIndex() {
  try {
    const res = await fetch(`${RAW_BASE}/pin_index.json?t=${Date.now()}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    pinIndex = await res.json();
    showView('pin');
  } catch (e) {
    showError('Index konnte nicht geladen werden: ' + e.message);
  }
}

// ─── PIN prüfen ───────────────────────────────────────────────────────────────

async function handlePinSubmit(e) {
  e.preventDefault();
  const pin     = document.getElementById('pin-input').value.trim();
  const errorEl = document.getElementById('pin-error');
  errorEl.textContent = '';

  if (!/^\d{4}$/.test(pin)) {
    errorEl.textContent = 'Bitte genau 4 Ziffern eingeben.';
    return;
  }

  const hash = await hashPin(pin);
  const galleryFileId = pinIndex[hash];

  if (!galleryFileId) {
    errorEl.textContent = 'Falscher PIN — bitte nochmal versuchen.';
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-input').focus();
    return;
  }

  // Galerie laden (galleryFileId = galleryId aus pin_index)
  try {
    const res = await fetch(`${RAW_BASE}/gallery_public_${galleryFileId}.json?t=${Date.now()}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    galleryMeta = await res.json();
    renderGallery();
    showView('gallery');
  } catch (e) {
    errorEl.textContent = 'Galerie konnte nicht geladen werden: ' + e.message;
  }
}

async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ─── Galerie rendern ──────────────────────────────────────────────────────────

function renderGallery() {
  // Seiten-Titel
  document.title = galleryMeta.galleryName || 'Galerie';

  // Hero-Bild + Titel-Overlay
  const heroSection = document.getElementById('hero-section');
  if (galleryMeta.heroFileId) {
    document.getElementById('hero-image').src =
      `https://drive.google.com/thumbnail?id=${galleryMeta.heroFileId}&sz=w1600`;
    document.getElementById('hero-title').textContent = galleryMeta.galleryName || '';
    heroSection.style.display = 'block';
  } else {
    heroSection.style.display = 'none';
  }

  const descEl = document.getElementById('gallery-description');
  descEl.textContent = galleryMeta.description || '';
  descEl.style.display = galleryMeta.description ? 'block' : 'none';

  // Ablaufdatum
  const expiryEl = document.getElementById('gallery-expiry');
  if (galleryMeta.expiry) {
    const d = new Date(galleryMeta.expiry);
    expiryEl.textContent = `Bilder verfügbar bis: ${d.toLocaleDateString('de-DE', { day:'2-digit', month:'long', year:'numeric' })}`;
    expiryEl.style.display = 'block';
  } else {
    expiryEl.style.display = 'none';
  }

  // Grid
  renderGrid();
}

function renderGrid() {
  const grid  = document.getElementById('gallery-grid');
  const files = galleryMeta.files || [];

  if (!files.length) {
    grid.innerHTML = '<p class="gallery-empty">Noch keine Medien in dieser Galerie.</p>';
    document.getElementById('btn-download-all').style.display = 'none';
    return;
  }

  document.getElementById('btn-download-all').style.display = 'inline-flex';
  document.getElementById('btn-download-selected').style.display = 'inline-flex';
  updateSelectedCount();

  grid.innerHTML = files.map((file, index) => {
    const isImage   = file.mimeType?.startsWith('image/');
    const isVideo   = file.mimeType?.startsWith('video/');
    const thumbUrl  = isImage ? `https://drive.google.com/thumbnail?id=${file.id}&sz=w400` : null;
    const dlUrl     = `https://drive.google.com/uc?export=download&id=${file.id}`;

    return `
      <div class="gallery-card">
        <label class="gallery-select-label">
          <input type="checkbox" class="gallery-checkbox" data-index="${index}" onchange="updateSelectedCount()">
          <span class="gallery-select-box"></span>
        </label>
        <div class="gallery-thumb" onclick="openLightbox(${index})">
          ${isImage
            ? `<img src="${thumbUrl}" alt="${file.name}" loading="lazy">`
            : isVideo
              ? `<div class="video-thumb"><span class="play-icon">▶</span><span class="video-label">${file.name}</span></div>`
              : `<div class="file-thumb">📄 ${file.name}</div>`
          }
        </div>
        <div class="gallery-card-footer">
          <button class="btn-download" onclick="trackDownload('${file.id}','${file.name}','${dlUrl}')">↓ Download</button>
        </div>
      </div>`;
  }).join('');
}

// ─── Alle herunterladen (ZIP) ─────────────────────────────────────────────────

async function downloadAll() {
  const files = galleryMeta.files || [];
  if (!files.length) return;

  const btn = document.getElementById('btn-download-all');
  const bar = document.getElementById('download-progress');
  const txt = document.getElementById('download-progress-text');

  btn.disabled = true;
  btn.textContent = 'Wird vorbereitet…';
  bar.style.display = 'block';

  const zip   = new JSZip();
  const total = files.length;
  let done    = 0;

  for (const file of files) {
    try {
      txt.textContent = `${file.name} (${done + 1}/${total})`;
      bar.querySelector('.bar-fill').style.width = Math.round(done / total * 100) + '%';
      const res  = await fetch(`${API}/files/${file.id}?alt=media&key=${CONFIG.GOOGLE_API_KEY}`);
      const blob = await res.blob();
      zip.file(file.name, blob);
      trackDownloadHit(file.id);
    } catch {
      // einzelne fehlerhafte Datei überspringen
    }
    done++;
  }

  bar.querySelector('.bar-fill').style.width = '100%';
  txt.textContent = 'ZIP wird erstellt…';

  const zipBlob = await zip.generateAsync({ type: 'blob' }, meta => {
    bar.querySelector('.bar-fill').style.width = meta.percent.toFixed(0) + '%';
  });

  // Download auslösen
  const url = URL.createObjectURL(zipBlob);
  const a   = document.createElement('a');
  a.href = url;
  a.download = `${galleryMeta.galleryName || 'Galerie'}.zip`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);

  bar.style.display = 'none';
  txt.textContent = '';
  btn.disabled = false;
  btn.textContent = '↓ Alle herunterladen';
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function openLightbox(index) {
  const files = galleryMeta.files || [];
  const file  = files[index];
  if (!file) return;
  currentLightboxIndex = index;

  const isImage  = file.mimeType?.startsWith('image/');
  const isVideo  = file.mimeType?.startsWith('video/');
  const dlUrl    = `https://drive.google.com/uc?export=download&id=${file.id}`;

  const content = document.getElementById('lightbox-content');
  content.innerHTML = isImage
    ? `<img src="https://drive.google.com/thumbnail?id=${file.id}&sz=w1600" alt="${file.name}">`
    : isVideo
      ? `<iframe src="https://drive.google.com/file/d/${file.id}/preview" allowfullscreen style="width:100%;height:100%;min-height:360px;border:none;background:#000"></iframe>`
      : `<p style="color:#fff;padding:24px">${file.name}</p>`;

  document.getElementById('lightbox-download').href = dlUrl;
  document.getElementById('lightbox-download').download = file.name;

  // Pfeile ein-/ausblenden
  document.getElementById('lightbox-prev').style.display = index > 0 ? 'flex' : 'none';
  document.getElementById('lightbox-next').style.display = index < files.length - 1 ? 'flex' : 'none';

  document.getElementById('lightbox-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function moveLightbox(dir) {
  const files = galleryMeta?.files || [];
  const next  = currentLightboxIndex + dir;
  if (next >= 0 && next < files.length) openLightbox(next);
}

function closeLightbox() {
  document.getElementById('lightbox-overlay').style.display = 'none';
  document.getElementById('lightbox-content').innerHTML = '';
  document.body.style.overflow = '';
  currentLightboxIndex = -1;
}

// ─── Ausgewählte herunterladen ─────────────────────────────────────────────────

function updateSelectedCount() {
  const checked = document.querySelectorAll('.gallery-checkbox:checked').length;
  const btn = document.getElementById('btn-download-selected');
  btn.textContent = checked > 0 ? `↓ Ausgewählte (${checked})` : '↓ Ausgewählte';
  btn.disabled = checked === 0;
}

async function downloadSelected() {
  const checked = [...document.querySelectorAll('.gallery-checkbox:checked')];
  if (!checked.length) return;

  const files    = galleryMeta.files || [];
  const selected = checked.map(cb => files[parseInt(cb.dataset.index)]).filter(Boolean);

  const btn = document.getElementById('btn-download-selected');
  const bar = document.getElementById('download-progress');
  const txt = document.getElementById('download-progress-text');

  btn.disabled = true;
  bar.style.display = 'block';

  const zip   = new JSZip();
  const total = selected.length;
  let done    = 0;

  for (const file of selected) {
    try {
      txt.textContent = `${file.name} (${done + 1}/${total})`;
      bar.querySelector('.bar-fill').style.width = Math.round(done / total * 100) + '%';
      const res  = await fetch(`${API}/files/${file.id}?alt=media&key=${CONFIG.GOOGLE_API_KEY}`);
      const blob = await res.blob();
      zip.file(file.name, blob);
      trackDownloadHit(file.id);
    } catch { /* überspringen */ }
    done++;
  }

  bar.querySelector('.bar-fill').style.width = '100%';
  txt.textContent = 'ZIP wird erstellt…';

  const zipBlob = await zip.generateAsync({ type: 'blob' }, meta => {
    bar.querySelector('.bar-fill').style.width = meta.percent.toFixed(0) + '%';
  });

  const url = URL.createObjectURL(zipBlob);
  const a   = document.createElement('a');
  a.href = url;
  a.download = `${galleryMeta.galleryName || 'Auswahl'}_Auswahl.zip`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);

  bar.style.display = 'none';
  btn.disabled = false;
  updateSelectedCount();
}

// ─── Download-Tracking ───────────────────────────────────────────────────────

const COUNT_NS = 'dndesi-mylighttable';

function trackDownloadHit(fileId) {
  fetch(`https://api.counterapi.dev/v1/${COUNT_NS}/${fileId}/up`).catch(() => {});
}

function trackDownload(fileId, fileName, dlUrl) {
  trackDownloadHit(fileId);
  const a = document.createElement('a');
  a.href = dlUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 100);
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function showView(view) {
  document.getElementById('view-pin').style.display     = view === 'pin'     ? 'flex' : 'none';
  document.getElementById('view-gallery').style.display = view === 'gallery' ? 'block': 'none';
  document.getElementById('view-error').style.display   = view === 'error'   ? 'flex' : 'none';
}

function showError(msg) {
  document.getElementById('error-message').textContent = msg;
  showView('error');
}
