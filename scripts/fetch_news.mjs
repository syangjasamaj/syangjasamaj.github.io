/* स्याङ्जा समाज जापान — नेपाल समाचार तान्ने script
   GitHub Actions ले हरेक ६ घण्टामा चलाउँछ र news.json बनाउँछ।
   नयाँ RSS स्रोत थप्न तलको SOURCES मा {name, type:'rss', url} थप्नुहोस्। */

const SOURCES = [
  // ── नेपालका राष्ट्रिय मिडिया ──
  { name: 'अनलाइनखबर',      type: 'rss',       url: 'https://www.onlinekhabar.com/feed' },
  { name: 'सेतोपाटी',        type: 'rss',       url: 'https://www.setopati.com/feed' },
  { name: 'रातोपाटी',        type: 'rss',       url: 'https://www.ratopati.com/feed' },
  { name: 'अन्नपूर्ण पोस्ट',  type: 'rss',       url: 'https://annapurnapost.com/rss/' },
  { name: 'कान्तिपुर',       type: 'ekantipur', url: 'https://ekantipur.com/' },
  // ── जापानका नेपाली मिडिया ──
  { name: 'जापान समाचार',   type: 'rss',       url: 'https://japansamachar.com/feed' },
  { name: 'नेपाल जापान',    type: 'rss',       url: 'https://www.nepaljapan.com/feed' },
  { name: 'रमरोपोस्ट',       type: 'ramropost', url: 'https://ramropost.com/' },
];

const PER_SOURCE = 4;   // हरेक स्रोतबाट कति वटा
const TOTAL      = 24;  // जम्मा कति वटा राख्ने

const fs = await import('node:fs');

/* पहिलेको news.json का मिति सम्झने (मिति नहुने स्रोतका लागि) */
let OLD_DATES = {};
try {
  const prev = JSON.parse(fs.readFileSync('news.json', 'utf8'));
  for (const it of prev.items || []) OLD_DATES[it.u] = it.d;
} catch { /* पहिलो पटक — केही छैन */ }

function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pick(xml, tag) {
  const m = xml.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i'));
  return m ? decode(m[1]) : '';
}

async function fetchText(url, browserUA) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  const ua = browserUA
    ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    : 'Mozilla/5.0 (compatible; SyangjaSamajBot/1.0; +https://syangjasamaj.github.io/)';
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { 'user-agent': ua, 'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'accept-language': 'ne,en;q=0.8' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/* RSS feed पढ्ने */
function parseRss(xml, src) {
  const items = [];
  const re = /<item[\s>][\s\S]*?<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < PER_SOURCE) {
    const it = m[0];
    const t2 = pick(it, 'title');
    const u = pick(it, 'link') || (it.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '';
    const d = pick(it, 'pubDate') || pick(it, 'dc:date');
    if (!t2 || !u || !/^https?:\/\//.test(u)) continue;
    const ts = new Date(d);
    items.push({ t: t2, u, s: src.name, d: isNaN(ts) ? new Date().toISOString() : ts.toISOString() });
  }
  return items;
}

/* कान्तिपुर (ekantipur.com) — RSS छैन, homepage बाट लिने। मिति URL भित्रै हुन्छ। */
function parseEkantipur(html, src) {
  const items = [];
  const seen = new Set();
  const re = /<a[^>]+href="(https?:\/\/ekantipur\.com\/[a-zA-Z-]+\/(\d{4})\/(\d{2})\/(\d{2})\/[^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1];
    const t2 = decode(m[5]);
    if (!t2 || t2.length < 12 || seen.has(u)) continue;
    seen.add(u);
    items.push({ t: t2, u, s: src.name, d: m[2] + '-' + m[3] + '-' + m[4] + 'T06:00:00.000Z' });
  }
  items.sort((a, b) => new Date(b.d) - new Date(a.d));
  return items.slice(0, PER_SOURCE);
}

/* रमरोपोस्ट (ramropost.com) — RSS छैन, homepage बाट लिने। नयाँ story को नम्बर ठूलो हुन्छ। */
function parseRamropost(html, src) {
  const items = [];
  const seen = new Set();
  const re = /<a[^>]+href="(https?:\/\/ramropost\.com\/news-story\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1];
    const t2 = decode(m[3]);
    if (!t2 || t2.length < 12 || seen.has(u)) continue;
    seen.add(u);
    items.push({ t: t2, u, s: src.name, d: OLD_DATES[u] || new Date().toISOString(), _id: +m[2] });
  }
  items.sort((a, b) => b._id - a._id);
  return items.slice(0, PER_SOURCE).map(({ _id, ...rest }) => rest);
}

async function fetchSource(src) {
  try {
    const body = await fetchText(src.url, src.type === 'ekantipur');
    let items;
    if (src.type === 'ekantipur') items = parseEkantipur(body, src);
    else if (src.type === 'ramropost') items = parseRamropost(body, src);
    else items = parseRss(body, src);
    console.log(src.name + ': ' + items.length + ' वटा');
    return items;
  } catch (e) {
    console.error(src.name + ' असफल: ' + e.message);
    return [];
  }
}

const perSource = await Promise.all(SOURCES.map(fetchSource));

/* हरेक स्रोत देखियोस् भनेर पालैपालो (round-robin) मिसाउने:
   पहिलो चक्रमा सबै स्रोतको सबैभन्दा नयाँ समाचार, अनि दोस्रो, ... */
const mixed = [];
for (let r = 0; r < PER_SOURCE; r++) {
  const round = [];
  for (const arr of perSource) if (arr[r]) round.push(arr[r]);
  round.sort((a, b) => new Date(b.d) - new Date(a.d));
  mixed.push(...round);
}

const out = { updated: new Date().toISOString(), items: mixed.slice(0, TOTAL) };

if (out.items.length === 0) {
  console.error('कुनै समाचार आएन — पुरानो news.json जस्ताको तस्तै राखियो');
  process.exit(0); // पुरानो फाइल नबिगार्ने
}

fs.writeFileSync('news.json', JSON.stringify(out, null, 1), 'utf8');
console.log('news.json लेखियो — ' + out.items.length + ' वटा समाचार');
