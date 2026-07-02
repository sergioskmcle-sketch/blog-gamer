import requests
import json
import re
import time
import random
from urllib.parse import urljoin

API_BASE = "https://www.mercadolivre.com.br"
CREATE_LINK = "/affiliate-program/api/v2/affiliates/createLink"
STRIPE_LINK = "/affiliate-program/api/v2/stripe/user/links"

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
]

BASE_HEADERS = {
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
}

_AFFILIATE_CACHE = {}
_AFFILIATE_CACHE_TTL = 3600


def extract_csrf(html):
    m = re.search(r'"csrf_token":"([^"]+)"', html)
    if m:
        return m.group(1)
    m = re.search(r'<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"', html)
    if m:
        return m.group(1)
    return None


def load_cookies(path):
    with open(path, 'r') as f:
        raw = json.load(f)
    if isinstance(raw, dict):
        return raw
    cookies = {}
    for c in raw:
        domain = c.get('domain', '')
        if 'mercadolivre.com.br' in domain:
            cookies[c['name']] = c['value']
    return cookies


def _generate_affiliate_link_raw(product_url, cookies_path, tag=''):
    cookies = load_cookies(cookies_path)
    s = requests.Session()
    s.cookies.update(cookies)

    ua = random.choice(USER_AGENTS)
    s.headers.update({'User-Agent': ua, **BASE_HEADERS})

    r = s.get(product_url, timeout=15)
    csrf = extract_csrf(r.text)

    if not csrf:
        csrf = cookies.get('csrf_token', '') or cookies.get('_csrf', '')

    if not csrf:
        return {'error': 'CSRF token nao encontrado'}

    api_headers = {
        'User-Agent': ua,
        **BASE_HEADERS,
        'Content-Type': 'application/json',
        'x-csrf-token': csrf,
        'Origin': API_BASE,
        'Referer': product_url,
        'Accept': 'application/json',
    }

    payload = {'urls': [product_url], 'tag': tag}
    r2 = s.post(API_BASE + CREATE_LINK, json=payload, headers=api_headers, timeout=15)

    if r2.status_code == 200:
        data = r2.json()
        if data.get('urls'):
            success = any(u.get('short_url') for u in data['urls'])
            if success:
                return data
        payload2 = {'url': product_url, 'tag': tag}
        r3 = s.post(API_BASE + STRIPE_LINK, json=payload2, headers=api_headers, timeout=15)
        if r3.status_code == 200:
            return r3.json()
        return data

    payload2 = {'url': product_url, 'tag': tag}
    r3 = s.post(API_BASE + STRIPE_LINK, json=payload2, headers=api_headers, timeout=15)

    if r3.status_code == 200:
        return r3.json()

    return {'error': f'API retornou {r2.status_code}', 'body1': r2.text[:500], 'body2': r3.text[:500]}


def extract_short_url(result):
    if not result or not isinstance(result, dict):
        return None
    if result.get('urls') and result['urls'][0].get('short_url'):
        return result['urls'][0]['short_url']
    if result.get('short_url'):
        return result['short_url']
    if result.get('url'):
        return result['url']
    if result.get('data') and isinstance(result['data'], list) and result['data']:
        return result['data'][0].get('short_url', '') or None
    return None


def build_affiliate_url(product_url, tag):
    if not tag:
        return product_url
    if '?' in product_url:
        return f'{product_url}&tag={tag}'
    return f'{product_url}?tag={tag}'


def generate_affiliate_link(product_url, cookies_path, tag='sergioskm'):
    now = time.time()
    cache_key = f'{product_url}|{tag}'
    cached = _AFFILIATE_CACHE.get(cache_key)
    if cached and (now - cached['ts']) < _AFFILIATE_CACHE_TTL:
        return cached['short_url']

    result = _generate_affiliate_link_raw(product_url, cookies_path, tag)
    short_url = extract_short_url(result)

    if short_url:
        _AFFILIATE_CACHE[cache_key] = {'short_url': short_url, 'ts': now}
        return short_url

    fallback = build_affiliate_url(product_url, tag)
    _AFFILIATE_CACHE[cache_key] = {'short_url': fallback, 'ts': now}
    return fallback
