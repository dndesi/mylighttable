// app.js – Frontend Galerie-Logik
// v2.2 – Public JSON von GitHub raw (kein CORS-Problem)

const API      = 'https://www.googleapis.com/drive/v3';
const RAW_BASE = 'https://raw.githubusercontent.com/dndesi/mylighttable/master/data';
let pinIndex    = null;   // { hash: publicFileId }
let galleryMeta = null;   // aktuelle Galerie-Daten

// ─── Init ────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('pin-form').addEventListener('submit', handlePinSubmit);
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLightbox();
  });
  document.getElementById('btn-download-all').addEventListener('click', downloadAll);

  await loadPinIndex();
});

// ─── PIN-Index laden ──────────────────────────────────────────────────────────

async function loadPinIndex() {
  try {
    const res = await fetch(`${RAW_BASE}/pin_index.json`);
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
    const res = await fetch(`${RAW_BASE}/gallery_public_${galleryFileId}.json`);
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

  grid.innerHTML = files.map((file, index) => {
    const isImage   = file.mimeType?.startsWith('image/');
    const isVideo   = file.mimeType?.startsWith('video/');
    const thumbUrl  = isImage ? `https://drive.google.com/thumbnail?id=${file.id}&sz=w400` : null;
    const dlUrl     = `https://drive.google.com/uc?export=download&id=${file.id}`;

    return `
      <div class="gallery-card">
        <div class="gallery-thumb" onclick="openLightbox(${index})">
          ${isImage
            ? `<img src="${thumbUrl}" alt="${file.name}" loading="lazy">`
            : isVideo
              ? `<div class="video-thumb"><span class="play-icon">▶</span><span class="video-label">${file.name}</span></div>`
              : `<div class="file-thumb">📄 ${file.name}</div>`
          }
        </div>
        <div class="gallery-card-footer">
          <a href="${dlUrl}" download="${file.name}" class="btn-download">↓ Download</a>
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
  const file = galleryMeta.files[index];
  if (!file) return;
  const isImage  = file.mimeType?.startsWith('image/');
  const isVideo  = file.mimeType?.startsWith('video/');
  const mediaUrl = isImage
    ? `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`
    : `${API}/files/${file.id}?alt=media&key=${CONFIG.GOOGLE_API_KEY}`;
  const dlUrl    = `https://drive.google.com/uc?export=download&id=${file.id}`;

  const content = document.getElementById('lightbox-content');
  content.innerHTML = isImage
    ? `<img src="${mediaUrl}" alt="${file.name}">`
    : isVideo
      ? `<iframe src="https://drive.google.com/file/d/${file.id}/preview" allowfullscreen style="width:100%;height:100%;min-height:360px;border:none;background:#000"></iframe>`
      : `<p style="color:#fff;padding:24px">${file.name}</p>`;

  document.getElementById('lightbox-download').href = dlUrl;
  document.getElementById('lightbox-download').download = file.name;
  document.getElementById('lightbox-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox-overlay').style.display = 'none';
  document.getElementById('lightbox-content').innerHTML = '';
  document.body.style.overflow = '';
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
