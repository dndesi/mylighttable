// github.js – GitHub API Wrapper
// v1.3 – Retry bei 409 + 422, mit kurzem Delay

const GitHub = (() => {
  const REPO   = 'dndesi/mylighttable';
  const BRANCH = 'master';
  const BASE   = `https://api.github.com/repos/${REPO}/contents`;

  function getToken() { return localStorage.getItem('github_pat') || null; }
  function setToken(t) { t ? localStorage.setItem('github_pat', t.trim()) : localStorage.removeItem('github_pat'); }

  async function fetchSha(url, token) {
    try {
      const r = await fetch(`${url}?ref=${BRANCH}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
      });
      if (r.ok) return (await r.json()).sha;
    } catch (_) {}
    return null;
  }

  const delay = ms => new Promise(r => setTimeout(r, ms));

  async function saveFile(path, contentObj) {
    const token = getToken();
    if (!token) throw new Error('Kein GitHub Token konfiguriert.');

    const url = `${BASE}/${path}`;
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj, null, 2))));

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await delay(800 * attempt);

      const sha = await fetchSha(url, token);
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

      if (res.ok) return res.json();

      const err = await res.json().catch(() => ({}));
      if (res.status === 409 || res.status === 422) continue; // SHA-Konflikt → retry
      throw new Error(err.message || `GitHub Fehler ${res.status}`);
    }
    throw new Error('GitHub: Datei konnte nach 3 Versuchen nicht gespeichert werden.');
  }

  async function deleteFile(path) {
    const token = getToken();
    if (!token) return;
    const url = `${BASE}/${path}`;
    const sha = await fetchSha(url, token);
    if (!sha) return;
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
