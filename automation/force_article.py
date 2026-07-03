#!/usr/bin/env python3
import sys, os, json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from generate_article import *

BATTLE_ROYALE_TOPIC = {
    'category': 'lista',
    'mode': 'melhores',
    'hint': 'battle royale mais jogados 2026, fortnite, free fire, pubg, apex legends, call of duty warzone, valorant',
    'ml_query': 'jogo battle royale ps5 xbox midia fisica original',
}

log('=== FORCING BATTLE ROYALE ARTICLE ===')

state = load_state()
old_state = dict(state)
log(f'State original: last_date={state.get("last_article_date")}, idx={state.get("last_category_index")}')

state['last_article_date'] = None
state['last_category_index'] = -1
save_state(state)

topic = BATTLE_ROYALE_TOPIC
log(f'Tema forçado: {topic["category"]} - {topic["hint"]}')

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

limit = 8
products = scrape_ml_products(topic['ml_query'], limit=limit)
log(f'ML products encontrados: {len(products)}')

if not products:
    log('Nenhum produto encontrado, abortando')
    save_state(old_state)
    sys.exit(1)

products = filter_by_brand_gaming(products, topic)
if not products:
    log('Nenhum produto apos filtro de marca')
    save_state(old_state)
    sys.exit(1)

products.sort(key=lambda p: p['price'], reverse=True)
log(f'Ordenados por preco (decrescente): melhores primeiro')

log('Gerando links de afiliado...')
for p in products:
    affiliate_url = generate_affiliate_link(
        p['permalink'], ML_COOKIES_PATH, ML_AFFILIATE_TAG
    )
    p['affiliate_url'] = affiliate_url
    log(f'  {p["title"][:50]}... -> {affiliate_url[:60]}')

cover_image = get_best_cover_image(products, topic)
log(f'Imagem de capa: {cover_image[:80]}')
system_prompt, user_prompt = build_groq_prompt(topic, products, sources_text, datetime.now(timezone.utc).date().isoformat(), cover_image)

log('Chamando Groq...')
try:
    raw = call_groq(system_prompt, user_prompt)
except Exception as e:
    log(f'Groq falhou: {e}')
    save_state(old_state)
    sys.exit(1)

log('Parseando frontmatter...')
fm, body = parse_frontmatter(raw)
if not fm:
    log('Falha ao extrair frontmatter YAML do Groq')
    log(f'Resposta bruta (primeiros 500): {raw[:500]}')
    save_state(old_state)
    sys.exit(1)

# Override image to ensure we use validated RAW or ML fallback
cover_image = get_best_cover_image(products, topic)
if cover_image:
    fm['image'] = cover_image

errors = validate_article(fm, body, products)
if errors:
    log(f'Validacao falhou: {errors}')
    save_state(old_state)
    sys.exit(1)

body = fix_affiliate_urls_in_body(body, products)
raw = f'---\n{yaml.dump(fm, allow_unicode=True, sort_keys=False).strip()}\n---\n{body}\n'

title = fm.get('title', 'Artigo sem titulo')
slug = slugify(title)

repo_path = BLOG_REPO_PATH
if repo_path:
    articles_dir = Path(repo_path) / 'src' / 'content' / 'artigos'
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
    'mode': topic['mode'],
    'date': datetime.now(timezone.utc).date().isoformat(),
    'ml_query': topic['ml_query'],
    'products': len(products),
})
save_history(history)

save_state(old_state)
log('State restaurado ao original')

git_push(slug, BLOG_REPO_PATH)
log('=== CONCLUIDO ===')
