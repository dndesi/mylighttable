// github.js – GitHub API Wrapper für öffentliche JSON-Daten
// v1.0 – Speichert pin_index + gallery_public_*.json im Repo (kein CORS-Problem)

const GitHub = (() => {
  const REPO   = 'dndesi/mylighttable';
  const BRANCH = 'master';
  const BASE   = `https://api.github.com/repos/${REPO}/contents`;

  // ─── Token (lokal im Browser, nie im Repo) ──────────────────────────────────

  function getToken() {
    return localStorage.getItem('github_pat') || null;
  }

  function setToken(token) {
    if (token) localStorage.setItem('github_pat', token.trim());
    else localStorage.removeItem('github_pat');
  }

  // ─── Datei anlegen oder aktualisieren ──────────────────────────────────────

  async function saveFile(path, contentObj) {
    const token = getToken();
    if (!token) throw new Error('Kein GitHub Token konfiguriert.');

    const url = `${BASE}/${path}`;
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj, null, 2))));

    // Aktuellen SHA holen (nötig für Updates)
    let sha = null;
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
      });
      if (res.ok) sha = (await res.json()).sha;
    } catch (_) {}

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Update ${path}`,
        content: b64,
        branch: BRANCH,
        ...(sha ? { sha } : {})
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub Fehler ${res.status}`);
    }
    return res.json();
  }

  // ─── Datei löschen ─────────────────────────────────────────────────────────

  async function deleteFile(path) {
    const token = getToken();
    if (!token) return;

    const url = `${BASE}/${path}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
    });
    if (!res.ok) return;

    const { sha } = await res.json();
    await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: `Delete ${path}`, sha, branch: BRANCH })
    });
  }

  return { getToken, setToken, saveFile, deleteFile };
})();
