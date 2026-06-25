// drive.js – Google Drive API Wrapper
// v2.0 – Multi-Galerie Architektur

const Drive = (() => {
  const BASE_URL    = 'https://www.googleapis.com/drive/v3';
  const UPLOAD_URL  = 'https://www.googleapis.com/upload/drive/v3';
  const ROOT_NAME   = 'MyLighttable';
  const INDEX_FILE  = 'galleries_index.json';
  const PIN_FILE    = 'pin_index.json';

  let _rootId = null;

  // ─── Low-level helpers ───────────────────────────────────────────────────────

  async function _fetch(url, options = {}) {
    const token = Auth.getToken();
    if (!token) throw new Error('Nicht eingeloggt');
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Drive API Fehler ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function _findFile(name, parentId) {
    const q = `name='${name}' and '${parentId}' in parents and trashed=false`;
    const res = await _fetch(`${BASE_URL}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`);
    return res.files?.length ? res.files[0] : null;
  }

  async function _findOrCreateFolder(name, parentId) {
    const q = parentId
      ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
      : `name='${name}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`;
    const res = await _fetch(`${BASE_URL}/files?q=${encodeURIComponent(q)}&fields=files(id)`);
    if (res.files?.length) return res.files[0].id;
    const created = await _fetch(`${BASE_URL}/files`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {})
      })
    });
    return created.id;
  }

  async function _writeJson(name, parentId, data, existingId = null) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    if (existingId) {
      await fetch(`${UPLOAD_URL}/files/${existingId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${Auth.getToken()}`,
          'Content-Type': 'application/json'
        },
        body: blob
      });
      return existingId;
    }
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name, parents: [parentId] })], { type: 'application/json' }));
    form.append('file', blob);
    const res = await fetch(`${UPLOAD_URL}/files?uploadType=multipart`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` },
      body: form
    });
    const json = await res.json();
    return json.id;
  }

  // ─── Root folder ─────────────────────────────────────────────────────────────

  async function ensureRootFolder() {
    if (_rootId) return _rootId;
    _rootId = await _findOrCreateFolder(ROOT_NAME, null);
    return _rootId;
  }

  async function ensureGalleryFolder(name) {
    const rootId = await ensureRootFolder();
    return _findOrCreateFolder(name, rootId);
  }

  // ─── Private: galleries_index.json ───────────────────────────────────────────

  let _galIndexId = null;

  async function loadGalleriesIndex() {
    const rootId = await ensureRootFolder();
    const file = await _findFile(INDEX_FILE, rootId);
    if (!file) return { galleries: [] };
    _galIndexId = file.id;
    const res = await fetch(`${BASE_URL}/files/${file.id}?alt=media`, {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    return res.json();
  }

  async function saveGalleriesIndex(data) {
    const rootId = await ensureRootFolder();
    if (!_galIndexId) {
      const file = await _findFile(INDEX_FILE, rootId);
      _galIndexId = file?.id || null;
    }
    _galIndexId = await _writeJson(INDEX_FILE, rootId, data, _galIndexId);
  }

  // ─── Public: pin_index.json ───────────────────────────────────────────────────
  // Format: { "SHA256_HASH": "GALLERY_PUBLIC_FILE_ID", ... }

  let _pinIndexId = null;

  async function savePinIndex(pinObj) {
    const rootId = await ensureRootFolder();
    // Finde existierende pin_index.json
    if (!_pinIndexId) {
      const stored = localStorage.getItem('pin_index_file_id');
      if (stored) {
        _pinIndexId = stored;
      } else {
        const file = await _findFile(PIN_FILE, rootId);
        _pinIndexId = file?.id || null;
      }
    }
    const isNew = !_pinIndexId;
    _pinIndexId = await _writeJson(PIN_FILE, rootId, pinObj, _pinIndexId);
    if (isNew) await makeFilePublic(_pinIndexId);
    localStorage.setItem('pin_index_file_id', _pinIndexId);
    return _pinIndexId;
  }

  // ─── Public: gallery_public_ID.json (pro Galerie) ────────────────────────────

  async function saveGalleryPublicFile(galleryId, data, existingFileId) {
    const rootId = await ensureRootFolder();
    const name = `gallery_public_${galleryId}.json`;
    const isNew = !existingFileId;
    const fileId = await _writeJson(name, rootId, data, existingFileId || null);
    if (isNew) await makeFilePublic(fileId);
    return fileId;
  }

  // ─── Public: Datei öffentlich setzen ─────────────────────────────────────────

  async function makeFilePublic(fileId) {
    await _fetch(`${BASE_URL}/files/${fileId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
  }

  // ─── Public fetch (kein OAuth, nur API Key) ───────────────────────────────────

  async function loadPublicJson(fileId) {
    const res = await fetch(`${BASE_URL}/files/${fileId}?alt=media&key=${CONFIG.GOOGLE_API_KEY}`);
    if (!res.ok) throw new Error('Nicht gefunden (HTTP ' + res.status + ')');
    return res.json();
  }

  // ─── File Upload ─────────────────────────────────────────────────────────────

  async function uploadFile(file, folderId, onProgress) {
    const token = Auth.getToken();
    const initRes = await fetch(`${UPLOAD_URL}/files?uploadType=resumable`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': file.type,
        'X-Upload-Content-Length': file.size
      },
      body: JSON.stringify({ name: file.name, parents: [folderId] })
    });
    if (!initRes.ok) throw new Error('Upload-Init fehlgeschlagen');
    const uploadUrl = initRes.headers.get('Location');

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
      };
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) resolve(JSON.parse(xhr.responseText));
        else reject(new Error(`Upload fehlgeschlagen: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Netzwerkfehler beim Upload'));
      xhr.send(file);
    });
  }

  // ─── File operations ─────────────────────────────────────────────────────────

  async function listFiles(folderId) {
    const q = `'${folderId}' in parents and trashed=false`;
    const res = await _fetch(`${BASE_URL}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,createdTime)&pageSize=1000`);
    return res.files || [];
  }

  async function deleteFile(fileId) {
    await _fetch(`${BASE_URL}/files/${fileId}`, { method: 'DELETE' });
  }

  async function deleteFolder(folderId) {
    await _fetch(`${BASE_URL}/files/${folderId}`, { method: 'DELETE' });
  }

  // ─── URL helpers ─────────────────────────────────────────────────────────────

  function getThumbnailUrl(fileId) {
    // API-URL mit Key — funktioniert zuverlässig für öffentliche Dateien ohne Auth-Cookies
    return `${BASE_URL}/files/${fileId}?alt=media&key=${CONFIG.GOOGLE_API_KEY}`;
  }

  function getDownloadUrl(fileId) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  function getPublicImageUrl(fileId) {
    return `${BASE_URL}/files/${fileId}?alt=media&key=${CONFIG.GOOGLE_API_KEY}`;
  }

  return {
    ensureRootFolder, ensureGalleryFolder,
    loadGalleriesIndex, saveGalleriesIndex,
    savePinIndex, saveGalleryPublicFile,
    makeFilePublic, loadPublicJson,
    uploadFile, listFiles, deleteFile, deleteFolder,
    getThumbnailUrl, getDownloadUrl, getPublicImageUrl
  };
})();
