#!/usr/bin/env python3
"""Admin API - Blog Gamer Control Panel (FastAPI)"""
import os, json, sqlite3, uuid, time, re, base64
from datetime import datetime, timezone
from pathlib import Path
from contextlib import asynccontextmanager

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
import yaml
from pydantic import BaseModel

load_dotenv()

GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
GITHUB_REPO = 'sergioskmcle-sketch/blog-gamer'
GITHUB_BRANCH = 'main'
API_KEY = os.environ.get('ADMIN_API_KEY', 'blog-gamer-admin-2026')
DB_PATH = Path(__file__).parent / 'admin_data.sqlite'
STATIC_DIR = Path(__file__).parent / 'admin_static'

GH_HEADERS = {
    'Authorization': f'Bearer {GITHUB_TOKEN}',
    'Accept': 'application/vnd.github.v3+json',
}
GH_API = 'https://api.github.com'
GH_REPO_URL = f'{GH_API}/repos/{GITHUB_REPO}'
BLOG_REPO_PATH = os.environ.get('BLOG_REPO_PATH', '')
LOCAL_ARTICLES = Path(BLOG_REPO_PATH) / 'src' / 'content' / 'artigos' if BLOG_REPO_PATH else None

sessions = {}

def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    c.executescript('''
        CREATE TABLE IF NOT EXISTS pageviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            page TEXT NOT NULL,
            slug TEXT,
            title TEXT,
            referrer TEXT DEFAULT '',
            user_agent TEXT DEFAULT '',
            ip TEXT DEFAULT '',
            timestamp TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS articles_cache (
            slug TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_pageviews_page ON pageviews(page);
        CREATE INDEX IF NOT EXISTS idx_pageviews_ts ON pageviews(timestamp);
    ''')
    conn.commit()
    conn.close()

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

@asynccontextmanager
async def lifespan(app):
    init_db()
    yield

app = FastAPI(title='Blog Gamer Admin', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# --- Auth ---
def require_auth(request: Request):
    key = request.headers.get('X-API-Key', '')
    if key == API_KEY:
        return
    if key and sessions.get(key, {}).get('expires', 0) > time.time():
        return
    raise HTTPException(401, 'Unauthorized')

@app.post('/api/auth/login')
def login(data: dict):
    if data.get('password') == API_KEY:
        token = uuid.uuid4().hex
        sessions[token] = {'expires': time.time() + 86400}
        return {'token': token, 'api_key': API_KEY}
    raise HTTPException(401, 'Senha inválida')

def gh_get(path):
    r = requests.get(f'{GH_REPO_URL}/{path}', headers=GH_HEADERS, timeout=15)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()

def gh_put(path, data, message='admin update'):
    r = requests.put(f'{GH_REPO_URL}/contents/{path}', headers=GH_HEADERS, json={
        'message': message,
        'content': data,
        'branch': GITHUB_BRANCH,
    }, timeout=15)
    if r.status_code == 409:
        sha = gh_get(path).get('sha', '')
        r = requests.put(f'{GH_REPO_URL}/contents/{path}', headers=GH_HEADERS, json={
            'message': message,
            'content': data,
            'sha': sha,
            'branch': GITHUB_BRANCH,
        }, timeout=15)
    return r.json()

def gh_delete(path, message='admin delete'):
    info = gh_get(path)
    if not info:
        return None
    r = requests.delete(f'{GH_REPO_URL}/contents/{path}', headers=GH_HEADERS, json={
        'message': message,
        'sha': info['sha'],
        'branch': GITHUB_BRANCH,
    }, timeout=15)
    return r.json()

def b64(s):
    return base64.b64encode(s.encode()).decode()

def unb64(s):
    return base64.b64decode(s).decode()

def get_articles_github():
    try:
        data = gh_get('contents/src/content/artigos')
        if not data or not isinstance(data, list):
            return []
        articles = []
        for item in data:
            if item['name'].endswith('.md'):
                content = gh_get(f'contents/src/content/artigos/{item["name"]}')
                if content:
                    raw = base64.b64decode(content['content']).decode()
                    fm, body = parse_frontmatter(raw)
                    articles.append({
                        'slug': item['name'].replace('.md', ''),
                        'filename': item['name'],
                        'frontmatter': fm,
                        'body': body,
                        'sha': content['sha'],
                    })
        articles.sort(key=lambda a: a['frontmatter'].get('pubDate', ''), reverse=True)
        return articles
    except Exception as e:
        raise HTTPException(500, str(e))

def get_articles_local():
    if not LOCAL_ARTICLES or not LOCAL_ARTICLES.exists():
        return []
    articles = []
    for f in sorted(LOCAL_ARTICLES.glob('*.md'), key=lambda p: p.stat().st_mtime, reverse=True):
        raw = f.read_text(encoding='utf-8')
        fm, body = parse_frontmatter(raw)
        if fm:
            articles.append({
                'slug': f.stem,
                'filename': f.name,
                'frontmatter': fm,
                'body': body,
                'sha': '',
            })
    articles.sort(key=lambda a: a['frontmatter'].get('pubDate', ''), reverse=True)
    return articles

def parse_frontmatter(text):
    m = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)', text, re.DOTALL)
    if m:
        try:
            fm = yaml.safe_load(m.group(1))
            return (fm, m.group(2).strip()) if isinstance(fm, dict) else ({}, text)
        except:
            pass
    return {}, text

def build_md(fm, body):
    return f'---\n{yaml.dump(fm, allow_unicode=True, sort_keys=False).strip()}\n---\n{body}\n'

# --- API Routes ---

@app.get('/api/health')
def health():
    return {'status': 'ok', 'time': datetime.now(timezone.utc).isoformat()}

# --- Articles ---

@app.get('/api/articles')
def list_articles(request: Request):
    require_auth(request)
    articles = get_articles_local() or get_articles_github()
    return [{
        'slug': a['slug'],
        'title': a['frontmatter'].get('title', ''),
        'description': a['frontmatter'].get('description', ''),
        'pubDate': a['frontmatter'].get('pubDate', ''),
        'category': a['frontmatter'].get('category', ''),
        'tags': a['frontmatter'].get('tags', []),
        'affiliate': a['frontmatter'].get('affiliate', False),
        'mode': a['frontmatter'].get('mode', ''),
        'image': a['frontmatter'].get('image', ''),
    } for a in articles]

@app.get('/api/articles/{slug}')
def get_article(slug: str, request: Request):
    require_auth(request)

    if LOCAL_ARTICLES:
        path = LOCAL_ARTICLES / f'{slug}.md'
        if path.exists():
            raw = path.read_text(encoding='utf-8')
            fm, body = parse_frontmatter(raw)
            return {'slug': slug, 'frontmatter': fm, 'body': body}

    content = gh_get(f'contents/src/content/artigos/{slug}.md')
    if not content:
        raise HTTPException(404, 'Artigo não encontrado')
    raw = base64.b64decode(content['content']).decode()
    fm, body = parse_frontmatter(raw)
    return {'slug': slug, 'frontmatter': fm, 'body': body, 'sha': content['sha']}

@app.put('/api/articles/{slug}')
def update_article(slug: str, data: dict, request: Request):
    require_auth(request)
    fm = data.get('frontmatter', {})
    body = data.get('body', '')
    md = build_md(fm, body)

    if LOCAL_ARTICLES:
        path = LOCAL_ARTICLES / f'{slug}.md'
        path.write_text(md, encoding='utf-8')
        return {'status': 'ok', 'slug': slug}

    content = gh_get(f'contents/src/content/artigos/{slug}.md')
    sha = content.get('sha', '') if content else ''
    encoded = base64.b64encode(md.encode()).decode()
    result = requests.put(
        f'{GH_REPO_URL}/contents/src/content/artigos/{slug}.md',
        headers=GH_HEADERS,
        json={
            'message': f'admin: atualizado {slug}',
            'content': encoded,
            'sha': sha,
            'branch': GITHUB_BRANCH,
        },
        timeout=15,
    ).json()
    return {'status': 'ok', 'slug': slug, 'commit': result.get('commit', {}).get('sha', '')}

@app.delete('/api/articles/{slug}')
def delete_article(slug: str, request: Request):
    require_auth(request)

    if LOCAL_ARTICLES:
        path = LOCAL_ARTICLES / f'{slug}.md'
        if path.exists():
            path.unlink()
            return {'status': 'deleted', 'slug': slug}
        raise HTTPException(404, 'Artigo não encontrado')

    gh_delete(f'src/content/artigos/{slug}.md', f'admin: deletado {slug}')
    return {'status': 'deleted', 'slug': slug}

@app.post('/api/articles')
def create_article(data: dict, request: Request):
    require_auth(request)
    fm = data.get('frontmatter', {})
    body = data.get('body', '')
    slug = data.get('slug', '')

    if not slug:
        title = fm.get('title', 'Artigo')
        slug = re.sub(r'[^a-z0-9-]', '', title.lower().replace(' ', '-'))

    md = build_md(fm, body)

    if LOCAL_ARTICLES:
        path = LOCAL_ARTICLES / f'{slug}.md'
        if path.exists():
            raise HTTPException(409, 'Slug já existe')
        path.write_text(md, encoding='utf-8')
        return {'status': 'created', 'slug': slug}

    encoded = base64.b64encode(md.encode()).decode()
    result = requests.put(
        f'{GH_REPO_URL}/contents/src/content/artigos/{slug}.md',
        headers=GH_HEADERS,
        json={
            'message': f'admin: criado {slug}',
            'content': encoded,
            'branch': GITHUB_BRANCH,
        },
        timeout=15,
    ).json()
    return {'status': 'created', 'slug': slug, 'commit': result.get('commit', {}).get('sha', '')}

# --- Featured Article ---

@app.get('/api/featured')
def get_featured(request: Request):
    require_auth(request)
    articles = get_articles_local() or get_articles_github()
    if articles:
        return {'slug': articles[0]['slug'], 'title': articles[0]['frontmatter'].get('title', '')}
    return {'slug': '', 'title': ''}

@app.put('/api/featured/{slug}')
def set_featured(slug: str, request: Request):
    require_auth(request)
    articles = get_articles_local() or get_articles_github()
    slugs = [a['slug'] for a in articles]
    if slug not in slugs:
        raise HTTPException(404, 'Artigo não encontrado')
    slugs.remove(slug)
    slugs.insert(0, slug)

    config = {'featured': slug, 'order': slugs}
    path = 'src/content/featured.json' if not LOCAL_ARTICLES else str(LOCAL_ARTICLES.parent / 'featured.json')

    if LOCAL_ARTICLES:
        Path(path).write_text(json.dumps(config, ensure_ascii=False), encoding='utf-8')
    else:
        encoded = base64.b64encode(json.dumps(config, ensure_ascii=False).encode()).decode()
        gh_put(path, encoded, 'admin: alterado destaque')

    return {'status': 'ok', 'featured': slug}

# --- Palette ---

@app.get('/api/palette')
def get_palette(request: Request):
    require_auth(request)

    if LOCAL_ARTICLES:
        tw = Path(BLOG_REPO_PATH) / 'tailwind.config.mjs'
        css = Path(BLOG_REPO_PATH) / 'src' / 'styles' / 'global.css'
        return {
            'tailwind': tw.read_text(encoding='utf-8') if tw.exists() else '',
            'css': css.read_text(encoding='utf-8') if css.exists() else '',
        }

    tw = gh_get('contents/tailwind.config.mjs')
    css = gh_get('contents/src/styles/global.css')
    return {
        'tailwind': base64.b64decode(tw['content']).decode() if tw else '',
        'css': base64.b64decode(css['content']).decode() if css else '',
    }

@app.put('/api/palette')
def update_palette(data: dict, request: Request):
    require_auth(request)

    tailwind = data.get('tailwind', '')
    css = data.get('css', '')

    if LOCAL_ARTICLES:
        tw_path = Path(BLOG_REPO_PATH) / 'tailwind.config.mjs'
        css_path = Path(BLOG_REPO_PATH) / 'src' / 'styles' / 'global.css'
        if tailwind:
            tw_path.write_text(tailwind, encoding='utf-8')
        if css:
            css_path.write_text(css, encoding='utf-8')
        return {'status': 'ok'}

    if tailwind:
        gh_put('tailwind.config.mjs', base64.b64encode(tailwind.encode()).decode(), 'admin: atualizada paleta')
    if css:
        gh_put('src/styles/global.css', base64.b64encode(css.encode()).decode(), 'admin: atualizado CSS')

    return {'status': 'ok'}

# --- Tracking / Analytics ---

@app.post('/api/track')
def track_pageview(data: dict):
    page = data.get('page', '')
    referrer = data.get('referrer', '')[:500]
    ua = data.get('userAgent', '')[:300]
    ip = data.get('ip', '')

    slug = ''
    title = ''
    m = re.search(r'/blog/([^/?]+)', page)
    if m:
        slug = m.group(1)

    if LOCAL_ARTICLES and slug:
        p = LOCAL_ARTICLES / f'{slug}.md'
        if p.exists():
            fm, _ = parse_frontmatter(p.read_text(encoding='utf-8'))
            title = fm.get('title', '')

    conn = get_db()
    conn.execute(
        'INSERT INTO pageviews (page, slug, title, referrer, user_agent, ip, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (page[:500], slug, title, referrer, ua, ip, datetime.now(timezone.utc).isoformat())
    )
    conn.commit()
    conn.close()
    return {'status': 'ok'}

@app.get('/api/track.gif')
def track_pixel(
    page: str = Query(''),
    ref: str = Query(''),
    ua: str = Query(''),
):
    slug = ''
    title = ''
    m = re.search(r'/blog/([^/?]+)', page)
    if m:
        slug = m.group(1)

    if LOCAL_ARTICLES and slug:
        p = LOCAL_ARTICLES / f'{slug}.md'
        if p.exists():
            fm, _ = parse_frontmatter(p.read_text(encoding='utf-8'))
            title = fm.get('title', '')

    conn = get_db()
    conn.execute(
        'INSERT INTO pageviews (page, slug, title, referrer, user_agent, ip, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (page[:500], slug, title, ref[:500], ua[:300], '', datetime.now(timezone.utc).isoformat())
    )
    conn.commit()
    conn.close()

    return Response(content=base64.b64decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), media_type='image/gif')

@app.get('/api/analytics/summary')
def analytics_summary(request: Request):
    require_auth(request)
    conn = get_db()

    total = conn.execute('SELECT COUNT(*) as c FROM pageviews').fetchone()['c']
    today = datetime.now(timezone.utc).date().isoformat()
    today_views = conn.execute(
        "SELECT COUNT(*) as c FROM pageviews WHERE timestamp >= ?",
        (today,)
    ).fetchone()['c']

    top_pages = conn.execute('''
        SELECT page, slug, title, COUNT(*) as views
        FROM pageviews
        WHERE page != ''
        GROUP BY page
        ORDER BY views DESC
        LIMIT 10
    ''').fetchall()

    top_refs = conn.execute('''
        SELECT referrer, COUNT(*) as views
        FROM pageviews
        WHERE referrer != ''
        GROUP BY referrer
        ORDER BY views DESC
        LIMIT 10
    ''').fetchall()

    last_7 = conn.execute('''
        SELECT DATE(timestamp) as day, COUNT(*) as views
        FROM pageviews
        WHERE timestamp >= DATE('now', '-7 days')
        GROUP BY day
        ORDER BY day
    ''').fetchall()

    conn.close()

    return {
        'total': total,
        'today': today_views,
        'topPages': [dict(r) for r in top_pages],
        'topReferrers': [dict(r) for r in top_refs],
        'last7Days': [dict(r) for r in last_7],
    }

# --- Serve Admin Frontend ---

ADMIN_HTML = ''
ADMIN_HTML_PATH = STATIC_DIR / 'index.html'

if ADMIN_HTML_PATH.exists():
    ADMIN_HTML = ADMIN_HTML_PATH.read_text(encoding='utf-8')

@app.get('/admin', response_class=HTMLResponse)
@app.get('/admin/', response_class=HTMLResponse)
@app.get('/admin/{path:path}', response_class=HTMLResponse)
def admin_spa(path: str = ''):
    if ADMIN_HTML:
        return ADMIN_HTML
    return '''<!doctype html><html><head><meta charset="utf-8"/><title>Blog Gamer — Admin</title></head><body><p>Admin frontend not found. Run <code>python setup_admin.py</code> to generate.</p></body></html>'''

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('ADMIN_PORT', '5432'))
    uvicorn.run('admin_api:app', host='0.0.0.0', port=port, reload=False)
