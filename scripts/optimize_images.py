"""स्याङ्जा समाज जापान — फोटो optimize गर्ने script
   ठूला JPEG/PNG फोटोलाई बढीमा 1600px चौडा बनाएर, JPEG quality 82 मा save गर्छ।
   logo.png छुँदैन। फोटोको PNG (कार्यसमिति फोटो) लाई .jpg बनाएर data.js / index.html मा नाम मिलाउँछ।"""
import os, re, io
from PIL import Image, ImageOps

MAX_W = 1600
QUALITY = 82
SKIP = {'logo.png'}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
renamed = {}

def files():
    for dp, dn, fn in os.walk(ROOT):
        if '.git' in dp or 'node_modules' in dp: continue
        for f in fn:
            if f.lower().endswith(('.jpg', '.jpeg', '.png')) and f not in SKIP:
                yield os.path.join(dp, f)

for path in list(files()):
    try:
        im = Image.open(path)
    except Exception as e:
        print('skip', path, e); continue
    im = ImageOps.exif_transpose(im)
    orig = os.path.getsize(path)
    w, h = im.size
    if w > MAX_W:
        im = im.resize((MAX_W, round(h * MAX_W / w)), Image.LANCZOS)
    is_png = path.lower().endswith('.png')
    has_alpha = im.mode in ('RGBA', 'LA') and is_png and im.getextrema()[-1][0] < 255
    if has_alpha:
        buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
        if buf.tell() < orig:
            open(path, 'wb').write(buf.getvalue()); print('png', os.path.basename(path), orig, '->', buf.tell())
        continue
    rgb = im.convert('RGB')
    buf = io.BytesIO(); rgb.save(buf, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
    new = buf.tell()
    if is_png:
        newpath = os.path.splitext(path)[0] + '.jpg'
        open(newpath, 'wb').write(buf.getvalue()); os.remove(path)
        renamed[os.path.basename(path)] = os.path.basename(newpath)
        print('png->jpg', os.path.basename(path), orig, '->', new)
    elif new < orig * 0.9:
        open(path, 'wb').write(buf.getvalue()); print('jpg', os.path.basename(path), orig, '->', new)
    else:
        print('keep', os.path.basename(path), orig)

if renamed:
    for f in ('data.js', 'index.html'):
        fp = os.path.join(ROOT, f)
        s = open(fp, encoding='utf8').read(); s0 = s
        for a, b in renamed.items(): s = s.replace(a, b)
        if s != s0:
            open(fp, 'w', encoding='utf8').write(s); print('updated refs in', f)
