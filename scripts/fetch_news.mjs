/* स्याङ्जा समाज जापान — नेपाल समाचार तान्ने script
   GitHub Actions ले हरेक ६ घण्टामा चलाउँछ र news.json बनाउँछ।
   नयाँ स्रोत थप्न तलको SOURCES मा {name, url} थप्नुहोस्। */

const SOURCES = [
  { name: 'अनलाइनखबर', url: 'https://www.onlinekhabar.com/feed' },
  { name: 'सेतोपाटी',   url: 'https://www.setopati.com/feed' },
  { name: 'रातोपाटी',   url: 'https://www.ratopati.com/feed' },
];

const PER_SOURCE = 5;   // हरेक स्रोतबाट कति वटा
const TOTAL      = 15;  // जम्मा कति वटा राख्ने

function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/<[^>]+>/g, '')
    .trim();
}

function pick(xml, tag) {
  const m = xml.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i'));
  return m ? decode(m[1]) : '';
}

async function fetchFeed(src) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    const res = await fetch(src.url, {
      signal: ctl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SyangjaSamajBot/1.0; +https://syangjasamaj.github.io/)' },
    });
    clearTimeout(t);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const xml = await res.text();
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
    console.log(src.name + ': ' + items.length + ' वटा');
    return items;
  } catch (e) {
    console.error(src.name + ' असफल: ' + e.message);
    return [];
  }
}

const all = (await Promise.all(SOURCES.map(fetchFeed))).flat();
all.sort((a, b) => new Date(b.d) - new Date(a.d));
const out = { updated: new Date().toISOString(), items: all.slice(0, TOTAL) };

if (out.items.length === 0) {
  console.error('कुनै समाचार आएन — पुरानो news.json जस्ताको तस्तै राखियो');
  process.exit(0); // पुरानो फाइल नबिगार्ने
}

const fs = await import('node:fs');
fs.writeFileSync('news.json', JSON.stringify(out, null, 1), 'utf8');
console.log('news.json लेखियो — ' + out.items.length + ' वटा समाचार');
