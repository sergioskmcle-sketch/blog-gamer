#!/usr/bin/env python3
import os
import re
import json
import time
import random
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from urllib.parse import quote
import requests
import yaml

from ml_affiliate import generate_affiliate_link, load_cookies

load_dotenv()

GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
TAVILY_API_KEY = os.environ.get('TAVILY_API_KEY', '')
ML_AFFILIATE_TAG = os.environ.get('ML_AFFILIATE_TAG', 'sergioskm')
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
ML_COOKIES_PATH = os.environ.get('ML_COOKIES_PATH', 'ml_cookies.json')
RAWG_API_KEY = os.environ.get('RAWG_API_KEY', '')
BLOG_REPO_PATH = os.environ.get('BLOG_REPO_PATH', '')

GROQ_MODEL = 'llama-3.3-70b-versatile'
GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
]

FRESH_HEADERS = {
    'User-Agent': USER_AGENTS[0],
    'Accept-Language': 'pt-BR,pt;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
}

CATEGORIES = [
    {'slug': 'noticia',   'name': 'Noticia'},
    {'slug': 'review',    'name': 'Review'},
    {'slug': 'guia',      'name': 'Guia de Compra'},
    {'slug': 'lista',     'name': 'Lista'},
    {'slug': 'promocao',  'name': 'Promocao'},
    {'slug': 'curiosidade', 'name': 'Curiosidade'},
    {'slug': 'tutorial',  'name': 'Tutorial'},
    {'slug': 'comparativo', 'name': 'Comparativo'},
    {'slug': 'lancamento', 'name': 'Lancamento'},
]

GAMING_BRANDS = [
    'logitech', 'razer', 'hyperx', 'corsair', 'steelseries',
    'asus rog', 'msi', 'samsung', 'lg ultragear', 'aoc',
    'benq', 'alienware', 'elgato', 'thrustmaster', 'fanatec',
    'redragon', 'husky gaming', 'pichau', 'fortrek', 'superframe',
    'havit', '2mouse', 'multilaser', 'keychron', 'gamemax',
    'dell', 'gigabyte', 'cougar', 't-dagger', 'trust gxt',
    'sony', 'nintendo', 'microsoft', 'xbox', 'playstation',
    'kingston', 'adata', 'western digital', 'seagate', 'samsung evo',
    'intel', 'amd', 'nvidia', 'galax', 'zotac', 'evga',
    'cooler master', 'deepcool', 'noctua', 'thermaltake',
    'fractal design', 'nzxt', 'lian li', 'corsair vengeance',
]

GAME_CATEGORIES = {'noticia', 'lista', 'curiosidade', 'tutorial', 'lancamento', 'promocao'}

NON_GAME_PATTERNS = [
    r'jogo\s+de\s+(lençol|lencol|cama|mesa|banho|jantar|panelas?|sofá|sofa|tapete|cortina|toalha|ferramenta|chave|cozinha|quarto|sala|escritório|escritorio|ferramentas?|jardim|pratos?|copos?|taças?|travesseir|edredom|colcha|almofada)',
    r'jogo\s+(tabuleiro|de\s+tabuleiro|velho|xadrez|dama|damas|cartas?|baralho|monopoly|dominó|domino)',
    r'aparelho\s+de\s+jantar',
    r'de\s+lençol',
]

def filter_non_game_products(products):
    filtered = []
    for p in products:
        title = p.get('title', '').lower()
        if any(re.search(pat, title, re.I) for pat in NON_GAME_PATTERNS):
            log(f'  Filtrando nao-jogo: {title[:60]}')
            continue
        filtered.append(p)
    return filtered

def filter_by_brand_gaming(products, topic=None):
    if topic and topic.get('category') in GAME_CATEGORIES:
        log(f'  Whitelist: pulando filtro para categoria "{topic["category"]}"')
        return products
    mlq = (topic or {}).get('ml_query', '')
    if 'jogo' in mlq.lower().split():
        log(f'  Whitelist: pulando filtro para query de jogos')
        return products
    filtered = [p for p in products if any(b in p['title'].lower() for b in GAMING_BRANDS)]
    if not filtered:
        log('⚠️ WHITELIST: todos os produtos foram filtrados! Mantendo lista original.')
        return products
    log(f'  Whitelist: {len(products)} -> {len(filtered)} produtos')
    return filtered

TOPIC_SEEDS = [
    {'category': 'noticia',  'mode': 'informativo',  'hint': 'lancamento de game, evento de games, anuncio de console, placa de video',                       'ml_query': 'lancamento jogo ps5 xbox midia fisica original'},
    {'category': 'review',   'mode': 'melhores',     'hint': 'review de jogo popular, analise de gameplay, dicas de jogo',                                      'ml_query': 'jogo original ps5 xbox midia fisica lancamento'},
    {'category': 'guia',     'mode': 'custo-beneficio', 'hint': 'melhores headsets gamers, teclado mecanico, mouse gamer, monitor, cadeira',                    'ml_query': 'headset gamer teclado mecanico mouse gamer monitor'},
    {'category': 'lista',    'mode': 'custo-beneficio', 'hint': 'melhores jogos para console, jogos populares, lancamentos, jogos estilo',                        'ml_query': 'jogo original ps4 ps5 xbox midia fisica list'},
    {'category': 'lista',    'mode': 'informativo',    'hint': 'jogos mais populares, rankings, jogos mais jogados 2026, lista de melhores jogos, ranking games', 'ml_query': ''},
    {'category': 'promocao', 'mode': 'custo-beneficio', 'hint': 'promocoes Steam, ofertas de games, descontos em perifericos gamers',                           'ml_query': 'jogo promocao ps5 xbox pc midia fisica original'},
    {'category': 'curiosidade', 'mode': 'informativo', 'hint': 'curiosidades sobre consoles clasicos, história dos games, erros de jogos famosos, easter eggs',  'ml_query': 'console retro game boy playstation nintendo clasico'},
    {'category': 'tutorial',    'mode': 'informativo', 'hint': 'como montar setup gamer, dicas de configuracao, melhores ajustes para jogos',                   'ml_query': 'setup gamer periferico rgb teclado mouse headset monitor'},
    {'category': 'comparativo', 'mode': 'melhores',    'hint': 'comparativo entre consoles, placas de video x vs y, melhor processador para jogos',             'ml_query': 'console playstation xbox nintendo placa video rtx'},
    {'category': 'lancamento',  'mode': 'melhores',    'hint': 'lancamento de console, novo jogo aguardado, placa de video nova geracao, perifericos',           'ml_query': 'lancamento jogo ps5 xbox pc midia fisica 2026'},
]

STATE_FILE = Path('state.json')
HISTORY_FILE = Path('article_history.json')
SCRIPT_DIR = Path(__file__).parent.resolve()
LOGS_DIR = SCRIPT_DIR / 'logs'
LOGS_DIR.mkdir(exist_ok=True)


def log(msg):
    ts = datetime.now(timezone.utc).isoformat() + 'Z'
    line = f'[{ts}] {msg}'
    print(line)
    with open(LOGS_DIR / 'geracao.log', 'a') as f:
        f.write(line + '\n')


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {'last_category_index': -1, 'last_article_date': None, 'last_slug': None}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False))


def load_history():
    if not HISTORY_FILE.exists():
        return []
    try:
        data = json.loads(HISTORY_FILE.read_text())
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, ValueError):
        log('⚠️ article_history.json corrompido, resetando')
        return []


def save_history(history):
    HISTORY_FILE.write_text(json.dumps(history, indent=2, ensure_ascii=False))


def is_topic_recent(history, topic, max_last=3):
    if not history:
        return False
    recent = history[-max_last:]
    for entry in recent:
        if entry.get('category') == topic['category']:
            return True
        if entry.get('mode') == topic.get('mode'):
            return True
    return False


def pick_topic():
    state = load_state()
    history = load_history()
    for _ in range(5):
        idx = (state.get('last_category_index', -1) + 1) % len(TOPIC_SEEDS)
        topic = TOPIC_SEEDS[idx]
        if not is_topic_recent(history, topic):
            break
        log(f'  Pulando categoria repetida: {topic["category"]}')
        state['last_category_index'] = idx
    state['last_category_index'] = idx
    save_state(state)
    return topic


def fetch_page(url, retries=3, use_cookies=False):
    for attempt in range(retries):
        try:
            s = requests.Session()
            s.headers.update(FRESH_HEADERS)
            s.headers.update({'User-Agent': random.choice(USER_AGENTS)})
            if use_cookies:
                try:
                    cookies = load_cookies(ML_COOKIES_PATH)
                    if cookies:
                        s.cookies.update(cookies)
                except Exception:
                    pass
            r = s.get(url, timeout=15)
            if r.status_code == 200:
                if '/gz/account-verification' in r.url:
                    log(f'Pagina bloqueada (account-verification): {url}')
                    if not use_cookies:
                        log(f'  Tentando fallback com cookies...')
                        return fetch_page(url, retries=2, use_cookies=True)
                    return None
                return r.text
            log(f'HTTP {r.status_code} {url} (tentativa {attempt+1})')
            if r.status_code == 403:
                wait = 5 * (attempt + 1)
                log(f'     403 detectado, aguardando {wait}s...')
                time.sleep(wait)
                continue
        except requests.exceptions.Timeout:
            log(f'Timeout {url} (tentativa {attempt+1})')
        except Exception as e:
            log(f'Erro fetch {url}: {e} (tentativa {attempt+1})')
        if attempt < retries - 1:
            time.sleep(random.uniform(3, 6))
    return None


def parse_product_html(html, url, item_id=''):
    jsonld = re.findall(r'<script\s+type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
    for block in jsonld:
        try:
            data = json.loads(block)
            if not isinstance(data, dict) or data.get('@type') != 'Product':
                continue
            name = data.get('name', '')
            if not name:
                continue
            offers = data.get('offers', {})
            price = float(offers.get('price', 0)) if isinstance(offers, dict) else 0
            original_price = 0
            if isinstance(offers, dict):
                spec = offers.get('priceSpecification', {})
                if isinstance(spec, dict):
                    try: original_price = float(spec.get('price', 0))
                    except: pass
                if not original_price and offers.get('highPrice'):
                    try: original_price = float(offers['highPrice'])
                    except: pass
            images_raw = data.get('image', '')
            images = [images_raw] if isinstance(images_raw, str) else (images_raw[:5] if isinstance(images_raw, list) else [])
            agg = data.get('aggregateRating', {}) or {}
            rating = float(agg.get('ratingValue', 0)) if agg else 0
            reviews = int(agg.get('reviewCount', 0)) if agg else 0
            return {
                'id': item_id,
                'title': name,
                'price': price,
                'original_price': original_price if original_price > price else 0,
                'thumbnail': images[0] if images else '',
                'permalink': url,
                'images': images,
                'rating': rating,
                'reviews': reviews,
                'free_shipping': False,
                'installments': None,
                'attributes': [],
            }
        except (json.JSONDecodeError, ValueError, TypeError):
            continue

    m_win = re.search(r'window\.__INITIAL_STATE__\s*=\s*({.*?});', html, re.DOTALL)
    if m_win:
        try:
            win = json.loads(m_win.group(1))
        except json.JSONDecodeError:
            win = None
        if win:
            item_data = (win.get('initialState', {}).get('item', {}) or win.get('item', {}))
            if item_data:
                title = item_data.get('title', '')
                price = float(item_data.get('price', 0) or item_data.get('base_price', 0))
                original_price = float(item_data.get('original_price', 0) or item_data.get('list_price', 0))
                images = []
                for pic in (item_data.get('pictures', []) or [])[:5]:
                    u = pic.get('url', '') or pic.get('secure_url', '')
                    if u:
                        images.append(u)
                fs = False
                shipping = item_data.get('shipping', {}) or {}
                if isinstance(shipping, dict):
                    fs = shipping.get('free_shipping', False)
                else:
                    fs = item_data.get('free_shipping', False)
                installments = None
                inst_data = item_data.get('installments', {}) or {}
                if isinstance(inst_data, dict) and inst_data.get('quantity'):
                    installments = {
                        'quantity': int(inst_data['quantity']),
                        'amount': float(inst_data.get('amount', 0)),
                    }
                rating = float(item_data.get('rating', {}).get('average', 0))
                reviews = int(item_data.get('rating', {}).get('total', 0))
                attrs = []
                for attr in (item_data.get('attributes', []) or [])[:8]:
                    vid = attr.get('value_name', '') or attr.get('value', '')
                    if attr.get('name') and vid:
                        attrs.append({'name': attr['name'], 'value': vid})
                return {
                    'id': item_id,
                    'title': title,
                    'price': price,
                    'original_price': original_price if original_price > price else 0,
                    'thumbnail': images[0] if images else '',
                    'permalink': url,
                    'images': images,
                    'rating': rating,
                    'reviews': reviews,
                    'free_shipping': fs,
                    'installments': installments,
                    'attributes': attrs,
                }

    return None


def scrape_ml_products(query, limit=8):
    """Busca produtos ML via listing page + cookies. Query suporta sub-queries separadas por virgula."""
    log(f'Scraping ML: {query}')

    # Carregar cookies
    try:
        cookie_raw = json.loads(open(ML_COOKIES_PATH, 'r', encoding='utf-8').read())
        cc = {}
        if isinstance(cookie_raw, dict):
            cc = cookie_raw
        elif isinstance(cookie_raw, list):
            for c in cookie_raw:
                if 'mercadolivre.com.br' in c.get('domain', ''):
                    cc[c['name']] = c['value']
    except Exception as e:
        log(f'Cookie erro: {e}')
        return []

    s = requests.Session()
    s.cookies.update(cc)
    s.headers.update({'User-Agent': random.choice(USER_AGENTS)})
    s.headers.update({
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    })

    sub_queries = [q.strip() for q in query.split(',') if q.strip()]
    if not sub_queries:
        sub_queries = [query]

    all_pids = set()
    for subq in sub_queries:
        terms = [w.strip().lower() for w in subq.split() if len(w.strip()) > 2]
        if not terms:
            continue

        variations = [
            '-'.join(terms[:6]),
            '-'.join(terms[:3]),
        ]

        for sq in variations:
            url = f'https://lista.mercadolivre.com.br/{sq}'
            try:
                resp = s.get(url, timeout=20, allow_redirects=True)
                if resp.status_code != 200 or '/gz/account-verification' in resp.url:
                    continue
                ids = re.findall(r'MLB\d{8}\b', resp.text)
                all_pids.update(ids)
                log(f'  Listing "{sq}": {len(ids)} IDs')
            except Exception as e:
                log(f'  Listing erro: {e}')

    log(f'  IDs unicos: {len(all_pids)}')

    if not all_pids:
        log('  Tavily fallback...')
        try:
            r = requests.post('https://api.tavily.com/search', json={
                'api_key': TAVILY_API_KEY,
                'query': f'{query.replace(","," ")} site:mercadolivre.com.br',
                'search_depth': 'basic',
                'max_results': 20,
            }, timeout=20)
            if r.ok:
                for result in r.json().get('results') or []:
                    m = re.search(r'/p/(MLB\d{8})\b', result.get('url', ''))
                    if m:
                        all_pids.add(m.group(1))
        except Exception as e:
            log(f'Tavily erro: {e}')

    if not all_pids:
        log('  Nenhum produto encontrado')
        return []

    pids = list(all_pids)[:limit * 2]
    log(f'  Visitando {len(pids)} produtos...')

    products = []
    for pid in pids:
        if len(products) >= limit:
            break

        product_url = f'https://www.mercadolivre.com.br/p/{pid}'
        time.sleep(random.uniform(2, 4))

        try:
            ps = requests.Session()
            ps.cookies.update(cc)
            ps.headers.update({'User-Agent': random.choice(USER_AGENTS)})
            ps.headers.update({
                'Accept-Language': 'pt-BR,pt;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            })
            r = ps.get(product_url, timeout=20)
            if r.status_code != 200 or '/gz/account-verification' in r.url:
                log(f'  {pid}: bloqueado')
                continue
        except Exception as e:
            log(f'  {pid}: erro {e}')
            continue

        product = parse_product_html(r.text, product_url, pid)
        if product and product.get('title') and product.get('price', 0) > 0:
            log(f'  OK: {product["title"][:50]} - R$ {product["price"]:.2f}')
            products.append(product)
        else:
            log(f'  Dados incompletos: {pid}')

    products.sort(key=lambda p: p['price'])
    log(f'  Produtos finais: {len(products)} (ordenados por preco)')
    return products[:limit]


def call_groq(system_prompt, user_prompt, retries=5):
    body = {
        'model': GROQ_MODEL,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt},
        ],
        'temperature': 0.7,
        'max_tokens': 8192,
    }

    for attempt in range(1, retries + 1):
        try:
            r = requests.post(GROQ_URL, headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {GROQ_API_KEY}',
            }, json=body, timeout=120)
            if r.status_code == 429:
                wait = 30 * (2 ** (attempt - 1))
                log(f'Groq quota excedida, aguardando {wait}s...')
                time.sleep(wait)
                continue
            r.raise_for_status()
            content = r.json()['choices'][0]['message']['content']
            if not content:
                raise ValueError('Resposta vazia do Groq')
            return content
        except Exception as e:
            if attempt == retries:
                raise
            log(f'Groq erro tentativa {attempt}: {e}, retentando...')
            time.sleep(5)

    raise RuntimeError('Falha ao chamar Groq apos todas as tentativas')


def parse_frontmatter(text):
    m = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)', text, re.DOTALL)
    if not m:
        m = re.match(r'^---\s*\n(.*?)\n+(?=## |### |# |\Z)', text, re.DOTALL)
        if m:
            raw = m.group(1)
            body_start = m.end()
            body = text[body_start:].strip() if body_start < len(text) else ''
            try:
                fm = yaml.safe_load(raw)
                return fm if isinstance(fm, dict) else {}, body
            except Exception:
                pass
        return None, text
    try:
        fm = yaml.safe_load(m.group(1))
    except Exception:
        return None, text
    body = m.group(2).strip()
    return fm if isinstance(fm, dict) else {}, body


def validate_article(frontmatter, body, products=None):
    errors = []
    warnings = []

    title = frontmatter.get('title', '')
    if len(str(title)) < 10:
        errors.append('title: muito curto (min 10 caracteres)')

    desc = frontmatter.get('description', '')
    if len(str(desc)) < 50:
        errors.append('description: muito curto (min 50 caracteres)')
    if len(str(desc)) > 160:
        errors.append('description: muito longo (max 160 caracteres)')

    if not frontmatter.get('pubDate'):
        errors.append('pubDate: ausente')

    category = frontmatter.get('category', '')
    valid = {c['slug'] for c in CATEGORIES}
    if category not in valid:
        errors.append(f'category: invalida ({category})')

    tags = frontmatter.get('tags', [])
    if not isinstance(tags, list) or len(tags) < 3:
        errors.append('tags: minimo 3 tags')

    if frontmatter.get('affiliate') is None:
        errors.append('affiliate: ausente')

    word_count = len(body.split())
    if word_count < 800:
        errors.append(f'conteudo muito curto: {word_count} palavras (min 800)')
    elif word_count < 1500:
        warnings.append(f'apenas {word_count} palavras (ideal: 1500+)')

    prohibited_terms = ['whey', 'protein', 'parafusadeira', 'furadeira',
                        'liquidificador', 'aspirador', 'geladeira', 'cafeteira']
    if products:
        for p in products:
            title_lower = p.get('title', '').lower()
            for term in prohibited_terms:
                if term in title_lower:
                    errors.append(f'Produto proibido detectado: {p["title"][:50]}')

        seen = set()
        for p in products:
            pid = p.get('id', '')
            if pid in seen:
                errors.append(f'Produto duplicado: {pid}')
            seen.add(pid)

    has_faq = re.search(r'faq|perguntas frequentes', body, re.IGNORECASE)
    if not has_faq:
        warnings.append('artigo sem secao FAQ')

    has_table = re.search(r'tabela|comparativo|comparacao', body, re.IGNORECASE)
    if not has_table:
        warnings.append('artigo sem tabela comparativa')

    if warnings:
        log(f'⚠️ Auditoria (warnings): {warnings}')

    return errors


def slugify(title):
    s = title.lower().strip()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'-+', '-', s)
    return s[:80].rstrip('-')


def try_fetch_game_wallpaper(title):
    if not RAWG_API_KEY:
        return ''
    clean = re.sub(r'^(jogo\s+|console\s+|cartas?\s+)', '', title, flags=re.I)
    clean = re.sub(r'\b(ps4|ps5|xbox|nintendo|switch|pc|m.dia.f.sica|midia.fisica|edi..o|edition|standard|ss|cor\s+\w+|box)\b', '', clean, flags=re.I)
    clean = re.sub(r'\s+', ' ', clean).strip()
    if not clean or len(clean) < 3:
        return ''
    try:
        r = requests.get(
            f'https://api.rawg.io/api/games?key={RAWG_API_KEY}&search={quote(clean)}&page_size=1&search_precise=true',
            timeout=10
        )
        if r.ok:
            data = r.json()
            results = data.get('results', [])
            if results:
                bg = results[0].get('background_image')
                if bg:
                    log(f'  RAWG wallpaper encontrado: {bg}')
                    try:
                        v = requests.head(bg, timeout=5)
                        if v.ok:
                            log(f'  RAWG wallpaper validado (HTTP {v.status_code})')
                            return bg
                        log(f'  RAWG wallpaper retornou HTTP {v.status_code}, ignorando')
                    except Exception as e:
                        log(f'  RAWG wallpaper inacessivel ({e}), ignorando')
        log(f'  RAWG sem resultados para: {clean}')
    except Exception as e:
        log(f'  RAWG erro: {e}')
    return ''


def get_best_cover_image(products, topic=None):
    if not products:
        return ''

    if topic and topic.get('category') in GAME_CATEGORIES:
        wallpaper = try_fetch_game_wallpaper(products[0].get('title', ''))
        if wallpaper:
            return wallpaper

    for product in reversed(products):
        title_lower = product.get('title', '').lower()
        if not any(w in title_lower for w in ['jogo', 'cartas ', 'carta ', 'card', 'pokémon', 'pokemon']):
            break
    else:
        product = products[0]

    img_url = product.get('thumbnail', '') or (product.get('images') or [''])[0]
    if not img_url:
        return ''
    if 'http2.mlstatic.com' in img_url:
        img_url = re.sub(r'-[FLOV](\.webp|\.jpg)', r'-O\1', img_url)
    return img_url


def build_groq_prompt(topic, products, sources_text, today, cover_image=''):
    mode = topic.get('mode', 'custo-beneficio')

    if not cover_image:
        cover_image = get_best_cover_image(products, topic)

    if mode == 'informativo':
        system_prompt = f'''Editor-Chefe de portal gamer. Escreva em portugues brasileiro, tom natural de gamer experiente, conversacional, sem parecer robo.

Modo: informativo (conteudo puro, sem produtos nem links de compra).

Estrutura obrigatoria:
1. INTRODUCAO: desperte curiosidade, mostre a relevancia do tema. NUNCA comee com "Neste artigo...", "Hoje vamos falar..."
2. CORPO DO CONTEUDO: divida em 5-7 secoes com subtitulos (##). Cada secao deve ter dados, curiosidades e informacoes relevantes extraidas das Fontes abaixo.
3. LISTA ou TABELA comparativa com dados (se aplicavel ao tema)
4. FAQ (3-5 perguntas)
5. CONCLUSAO
6. ## Fontes

Regras: MINIMO 1200 palavras. NUNCA mencione IA. Nao invente dados - use APENAS informacoes das Fontes fornecidas. Nao inclua produtos, precos, nem links de compra/afiliado.

Frontmatter YAML entre "---" (ABRIR e FECHAR com "---" em linha propria, SEMPRE):
title: "Titulo SEO"
description: "Descricao (100-160 caracteres)"
pubDate: {today}
tags: [tag1, tag2, tag3, tag4, tag5]
category: "{topic['category']}"
affiliate: false
image: "{cover_image}"
mode: "{mode}"'''

        user_prompt = f'''Categoria: {topic['category']} | Modo: {mode} | Tema principal: {topic['hint']}

Fontes para pesquisa:
{sources_text}'''

        return system_prompt, user_prompt

    mode_pt = {'melhores': 'melhores produtos (qualidade acima de preco)', 'custo-beneficio': 'custo-beneficio'}.get(mode, 'custo-beneficio')

    products_section = '\n'.join([
        _format_product_for_prompt(p) for p in products
    ])

    system_prompt = f'''Editor-Chefe de portal gamer. Escreva em portugues brasileiro, tom natural de gamer experiente, conversacional, sem parecer robo.

Modo: {mode_pt}.

Estrutura obrigatoria:
1. INTRODUCAO: desperte curiosidade, mostre o problema. NUNCA comee com "Neste artigo...", "Hoje vamos falar..."
2. Cada produto (do MAIS BARATO ao MAIS CARO): use EXATAMENTE este template HTML com CLASSES para cada card de produto:

<div class="product-card">
<img src="URL_IMAGEM" alt="NOME_PRODUTO" class="product-card-img">
<div class="product-card-body">
<h3>NOME DO PRODUTO</h3>
<p class="product-price"><strong>Preço:</strong> R$XX,XX</p>
<p class="product-desc">Descricao exclusiva do produto, destacando PUBLICO IDEAL e CARACTERISTICAS principais.</p>
<div class="product-pros"><strong>✅ Prós:</strong><br>• Benefício 1<br>• Benefício 2<br>• Benefício 3</div>
<div class="product-cons"><strong>❌ Contras:</strong><br>• Ponto negativo 1<br>• Ponto negativo 2</div>
<a href="LINK_AFILIADO" class="product-btn">VER NO MERCADO LIVRE</a>
</div>
</div>

IMPORTANTE: Nao omita nenhum campo do template. Nao use formatacao Markdown dentro do card. Cada card e HTML puro.

3. TABELA COMPARATIVA com todos os produtos e precos
4. FAQ (3-5 perguntas)
5. CONCLUSO
6. ## Fontes

Regras: MINIMO 1500 palavras. LINK_AFILIADO exato (nao modificar, nao adicionar parametros). NUNCA mencione IA. Nao repita frases/ideias entre produtos. Nao faca keyword stuffing.

Frontmatter YAML entre "---" (ABRIR e FECHAR com "---" em linha propria, SEMPRE):
title: "Titulo SEO"
description: "Descricao (100-160 caracteres)"
pubDate: {today}
tags: [tag1, tag2, tag3, tag4, tag5]
category: "{topic['category']}"
affiliate: true
image: "{cover_image}"
mode: "{mode}"'''

    user_prompt = f'''Categoria: {topic['category']} | Modo: {mode} | Tema: {topic['hint']}

Produtos (use TODOS, ordem do mais barato ao mais caro):
{products_section}

Fontes:
{sources_text}'''

    return system_prompt, user_prompt


def _format_product_for_prompt(p):
    parts = [f'{p["title"]} | R${p["price"]:.2f}']
    if p.get('original_price', 0) > 0:
        parts.append(f'original R${p["original_price"]:.2f}')
    if p.get('rating', 0) > 0:
        parts.append(f'rating {p["rating"]}/5 ({p["reviews"]} reviews)')
    if p.get('free_shipping'):
        parts.append('frete gratis')
    if p.get('installments'):
        i = p['installments']
        parts.append(f'{i["quantity"]}x R${i["amount"]:.2f}')
    extra = ' | '.join(parts[1:])
    return f'- "{parts[0]}" | {extra} | Imagem: {p["thumbnail"]} | Link: {p["affiliate_url"]}'


def git_push(slug, repo_path):
    if not repo_path:
        log('BLOG_REPO_PATH nao configurado, pulando git push')
        return False

    if not GITHUB_TOKEN:
        log('GITHUB_TOKEN nao configurado, pulando git push')
        return False

    original_cwd = os.getcwd()
    os.chdir(repo_path)

    try:
        result = subprocess.run(['git', 'status', '--porcelain'],
                                capture_output=True, text=True)
        if not result.stdout.strip():
            log('Nenhuma alteracao para commitar')
            return False

        remote = f'https://x-access-token:{GITHUB_TOKEN}@github.com/sergioskmcle-sketch/blog-gamer.git'
        subprocess.run(['git', 'remote', 'set-url', 'origin', remote],
                       capture_output=True)
        subprocess.run(['git', 'add', '-A'], check=True)
        subprocess.run(['git', 'commit', '-m', f'feat: artigo gerado automaticamente - {slug}'],
                       check=True)
        subprocess.run(['git', 'push', 'origin', 'main'], check=True)
        log(f'Artigo {slug} commitado e enviado com sucesso!')
        return True
    except subprocess.CalledProcessError as e:
        log(f'Erro no git push: {e}')
        return False
    finally:
        os.chdir(original_cwd)


def fix_affiliate_urls_in_body(body, products):
    for p in products:
        pid = p.get('id', '')
        affiliate_url = p.get('affiliate_url', '')
        if not pid or not affiliate_url:
            continue
        body = re.sub(
            rf'https?://[^\s"\'<>]*{re.escape(pid)}[^\s"\'<>]*',
            affiliate_url,
            body
        )
    return body


def main():
    if not GROQ_API_KEY:
        log('GROQ_API_KEY nao configurada')
        sys.exit(1)

    today = datetime.now(timezone.utc).date().isoformat()

    state = load_state()
    if state.get('last_article_date') == today:
        log('Artigo ja gerado hoje, pulando')
        return

    topic = pick_topic()
    log(f'Tema escolhido: {topic["category"]} - {topic["hint"]}')

    tavily_results = []
    try:
        r = requests.post('https://api.tavily.com/search', json={
            'api_key': TAVILY_API_KEY,
            'query': topic['hint'],
            'search_depth': 'basic',
            'max_results': 5,
        }, timeout=15)
        if r.ok:
            tavily_results = r.json().get('results') or []
            log(f'Tavily: {len(tavily_results)} resultados')
    except Exception as e:
        log(f'Tavily erro: {e}')

    sources_text = '\n'.join([
        f'- {res.get("title", "")}: {res.get("url", "")}'
        for res in tavily_results
    ])

    mode = topic.get('mode', 'custo-beneficio')

    if mode == 'informativo':
        products = []
        log('Modo informativo: sem produtos, apenas conteudo')
        cover_image = try_fetch_game_wallpaper(topic.get('hint', ''))
        if not cover_image:
            cover_image = ''
        log(f'Imagem de capa: {cover_image[:80] if cover_image else "(default)"}')
        system_prompt, user_prompt = build_groq_prompt(topic, products, sources_text, today, cover_image)
    else:
        limit = 8
        products = scrape_ml_products(topic['ml_query'], limit=limit)
        log(f'ML products encontrados: {len(products)}')

        if not products:
            log('Nenhum produto encontrado, abortando')
            sys.exit(1)

        products = filter_by_brand_gaming(products, topic)
        if not products:
            log('Nenhum produto apos filtro de marca, abortando')
            sys.exit(1)

        if topic.get('category') in GAME_CATEGORIES:
            products = filter_non_game_products(products)
            if not products:
                log('Nenhum produto apos filtro de nao-jogos, abortando')
                sys.exit(1)

        if mode == 'melhores':
            products.sort(key=lambda p: p['price'], reverse=True)
            log(f'  Ordenados por preco (decrescente): melhores primeiro')
        else:
            products.sort(key=lambda p: p['price'])
            log(f'  Ordenados por preco (crescente): mais baratos primeiro')

        log('Gerando links de afiliado...')
        for p in products:
            affiliate_url = generate_affiliate_link(
                p['permalink'], ML_COOKIES_PATH, ML_AFFILIATE_TAG
            )
            p['affiliate_url'] = affiliate_url
            log(f'  {p["title"][:50]}... -> {affiliate_url[:60]}')

        cover_image = get_best_cover_image(products, topic)
        log(f'Imagem de capa: {cover_image[:80]}')
        system_prompt, user_prompt = build_groq_prompt(topic, products, sources_text, today, cover_image)

    log('Chamando Groq...')
    try:
        raw = call_groq(system_prompt, user_prompt)
    except Exception as e:
        log(f'Groq falhou: {e}')
        sys.exit(1)

    log('Parseando frontmatter...')
    fm, body = parse_frontmatter(raw)
    if not fm:
        log('Falha ao extrair frontmatter YAML do Groq')
        log(f'Resposta bruta (primeiros 500): {raw[:500]}')
        sys.exit(1)

    errors = validate_article(fm, body, products)
    if errors:
        log(f'Validacao falhou: {errors}')
        sys.exit(1)

    body = fix_affiliate_urls_in_body(body, products)
    raw = f'---\n{yaml.dump(fm, allow_unicode=True, sort_keys=False).strip()}\n---\n{body}\n'

    title = fm.get('title', 'Artigo sem titulo')
    slug = slugify(title)

    state = load_state()
    if state.get('last_slug') == slug:
        slug = f'{slug}-{int(time.time())}'
        log(f'Slug duplicado, alterado para: {slug}')

    article_path = None
    if BLOG_REPO_PATH:
        articles_dir = Path(BLOG_REPO_PATH) / 'src' / 'content' / 'artigos'
        articles_dir.mkdir(parents=True, exist_ok=True)
        article_path = articles_dir / f'{slug}.md'
    else:
        article_path = Path(f'{slug}.md')

    article_path.write_text(raw, encoding='utf-8')
    log(f'Artigo salvo em: {article_path}')

    history = load_history()
    history.append({
        'title': title,
        'slug': slug,
        'category': topic['category'],
        'mode': mode,
        'date': today,
        'ml_query': topic['ml_query'],
        'products': len(products),
    })
    save_history(history)

    state['last_article_date'] = today
    state['last_slug'] = slug
    save_state(state)

    git_push(slug, BLOG_REPO_PATH)
    log('Concluido!')


if __name__ == '__main__':
    main()
