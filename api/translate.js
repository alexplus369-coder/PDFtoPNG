// Proxy de traducción para Vercel (plan gratuito Hobby).
// Reenvía el texto a una CADENA de servicios gratuitos y devuelve JSON { text, detected }.
// No almacena nada. Solo acepta POST con { text, sl, tl }.
// Cadena interna: Google gtx → Google dict-chrome-ex → MyMemory (API oficial).
// Motivo: Google a veces devuelve 429 a las IPs compartidas de datacenter de Vercel;
// con esta cadena el proxy sigue funcionando aunque un servicio se agote.

const MYMEMORY_EMAIL = ''; // opcional: tu email duplica la cuota diaria gratuita de MyMemory

const TIMEOUT_MS = 6000; // por servicio (3 servicios = 18 s < 20 s del navegador)

function enc(s) { return encodeURIComponent(s); }

async function fetchJson(url, opts) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
        const r = await fetch(url, Object.assign({ signal: ctl.signal }, opts || {}));
        if (!r.ok) throw new Error('upstream-' + r.status);
        return await r.json();
    } finally {
        clearTimeout(t);
    }
}

// Servicio 1: Google gtx (POST para evitar límites de longitud de URL)
async function googleGtx(text, sl, tl) {
    const data = await fetchJson(
        'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t'
        + '&sl=' + enc(sl) + '&tl=' + enc(tl),
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': 'Mozilla/5.0' },
            body: 'q=' + enc(text)
        });
    let out = '';
    (Array.isArray(data) && Array.isArray(data[0]) ? data[0] : []).forEach(s => {
        if (s && typeof s[0] === 'string') out += s[0];
    });
    if (!out.trim()) throw new Error('gtx-vacio');
    return { text: out, detected: (typeof data[2] === 'string' && data[2]) ? data[2] : null };
}

// Servicio 2: Google dict-chrome-ex (endpoint de la extensión de Chrome)
async function googleDict(text, sl, tl) {
    const data = await fetchJson(
        'https://clients5.google.com/translate_a/t?client=dict-chrome-ex'
        + '&sl=' + enc(sl) + '&tl=' + enc(tl) + '&q=' + enc(text),
        { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('dict-formato');
    let out = '';
    data[0].forEach(seg => {
        if (typeof seg === 'string') out += seg;
        else if (Array.isArray(seg) && typeof seg[0] === 'string') out += seg[0];
    });
    if (!out.trim()) throw new Error('dict-vacio');
    return { text: out, detected: (typeof data[2] === 'string' && data[2]) ? data[2] : null };
}

// Servicio 3: MyMemory (API oficial gratuita; requiere idioma origen concreto)
async function myMemory(text, sl, tl) {
    if (sl === 'auto') throw new Error('mm-sin-auto');
    if (enc(text).length > 4500) throw new Error('mm-largo');
    let url = 'https://api.mymemory.translated.net/get?q=' + enc(text)
        + '&langpair=' + enc(sl + '|' + tl);
    if (MYMEMORY_EMAIL) url += '&de=' + enc(MYMEMORY_EMAIL);
    const data = await fetchJson(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const t = data && data.responseData && data.responseData.translatedText;
    if (!t || /QUERY LENGTH LIMIT|INVALID|QUOTA|PLEASE SELECT/i.test(t)) throw new Error('mm-rechazo');
    return { text: t, detected: null };
}

const CADENA = [googleGtx, googleDict, myMemory];

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

    let ultimoError = 'sin-servicios';
    for (const fn of CADENA) {
        try {
            const r = await fn(text, sl, tl);
            return res.status(200).json(r);
        } catch (e) {
            ultimoError = String((e && e.message) || e);
        }
    }
    res.status(502).json({ error: ultimoError });
};

// Tiempo máximo de la función en Vercel (Hobby permite hasta 60 s; 3 servicios × 6 s = 18 s)
module.exports.maxDuration = 20;

// Autotest local:  node api/translate.js "Texto a traducir" en es
if (require.main === module) {
    const texto = process.argv[2] || 'Hello world, this is a test.';
    const sl = process.argv[3] || 'en';
    const tl = process.argv[4] || 'es';
    (async () => {
        for (const fn of CADENA) {
            try {
                const r = await fn(texto, sl, tl);
                console.log('OK via ' + fn.name + ' -> ' + JSON.stringify(r));
                process.exit(0);
            } catch (e) {
                console.log('fallo ' + fn.name + ' -> ' + String((e && e.message) || e));
            }
        }
        console.log('TODOS los servicios fallaron desde esta IP');
        process.exit(1);
    })();
}
