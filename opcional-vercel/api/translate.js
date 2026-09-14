// Proxy de traducción para Vercel (plan gratuito Hobby).
// Reenvía el texto a Google Translate y devuelve JSON { text, detected }.
// No almacena nada. Solo acepta POST con { text, sl, tl }.
// Node 18+ en Vercel incluye fetch global.

module.exports = async (req, res) => {
    // CORS: la app puede estar en cualquier dominio (p. ej. GitHub Pages)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

    const { text, sl = 'auto', tl = 'es' } = req.body || {};
    if (!text || typeof text !== 'string' || text.length > 5000) {
        return res.status(400).json({ error: 'Campo "text" requerido (max 5000 caracteres)' });
    }

    try {
        const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t'
            + '&sl=' + encodeURIComponent(sl)
            + '&tl=' + encodeURIComponent(tl)
            + '&q=' + encodeURIComponent(text);
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) throw new Error('upstream-' + r.status);
        const data = await r.json();
        let out = '';
        (Array.isArray(data) && Array.isArray(data[0]) ? data[0] : []).forEach(s => {
            if (s && typeof s[0] === 'string') out += s[0];
        });
        if (!out.trim()) throw new Error('upstream-vacio');
        res.status(200).json({
            text: out,
            detected: (typeof data[2] === 'string' && data[2]) ? data[2] : null
        });
    } catch (e) {
        res.status(502).json({ error: String((e && e.message) || e) });
    }
};
