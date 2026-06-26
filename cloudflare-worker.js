// MyLighttable – Download Counter Worker
// Speichert Download-Zahlen in Cloudflare KV
// Endpoints:
//   GET /hit/{fileId}    → Zähler +1, gibt { count } zurück
//   GET /get/{fileId}    → Zähler lesen, gibt { count } zurück
//   GET /batch?ids=a,b   → Mehrere Zähler auf einmal lesen

export default {
  async fetch(request, env) {
    const url  = new URL(request.url);
    const path = url.pathname;

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    // GET /hit/{fileId}
    if (path.startsWith('/hit/')) {
      const key     = path.slice(5);
      const current = parseInt(await env.DOWNLOADS.get(key) || '0');
      const next    = current + 1;
      await env.DOWNLOADS.put(key, String(next));
      return new Response(JSON.stringify({ count: next }), { headers });
    }

    // GET /get/{fileId}
    if (path.startsWith('/get/')) {
      const key   = path.slice(5);
      const count = parseInt(await env.DOWNLOADS.get(key) || '0');
      return new Response(JSON.stringify({ count }), { headers });
    }

    // GET /batch?ids=id1,id2,id3
    if (path === '/batch') {
      const ids    = (url.searchParams.get('ids') || '').split(',').filter(Boolean);
      const counts = {};
      await Promise.all(ids.map(async id => {
        counts[id] = parseInt(await env.DOWNLOADS.get(id) || '0');
      }));
      return new Response(JSON.stringify(counts), { headers });
    }

    return new Response('Not found', { status: 404, headers });
  }
};
