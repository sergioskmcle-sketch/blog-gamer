#!/usr/bin/env python3
import os
import re
import subprocess
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BLOG_REPO_PATH = os.environ.get('BLOG_REPO_PATH', '')
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')

if not BLOG_REPO_PATH:
    print('BLOG_REPO_PATH nao configurado')
    exit(1)

ARTICLE_SLUG = 'gta-6-data-de-lancamento-preco-pre-venda'
ARTICLE_PATH = Path(BLOG_REPO_PATH) / 'src' / 'content' / 'artigos' / f'{ARTICLE_SLUG}.md'

if not ARTICLE_PATH.exists():
    print(f'Artigo nao encontrado: {ARTICLE_PATH}')
    exit(1)

replacements = {
    'https://www.mercadolivre.com.br/console-sony-playstation-5-edico-slim-disk-1tb-branco-controle-sem-fio-dualsense-ps5-branco/p/MLB52897777?tag=sergioskm': 'https://meli.la/1grsfwV',
    'https://www.mercadolivre.com.br/console-playstation-5-slim-edico-digital-825-gb-branco-sony/p/MLB29001054?tag=sergioskm': 'https://meli.la/1Bj3UZc',
    'https://www.mercadolivre.com.br/microsoft-xbox-series-x-1tb/p/MLB16160759?tag=sergioskm': 'https://meli.la/1o2Auui',
    'https://www.mercadolivre.com.br/microsoft-xbox-series-s-512gb-standard-cor-branco/p/MLB16650345?tag=sergioskm': 'https://meli.la/1bAzcod',
}

content = ARTICLE_PATH.read_text(encoding='utf-8')
original = content

for old_url, new_url in replacements.items():
    count = content.count(old_url)
    if count > 0:
        content = content.replace(old_url, new_url)
        print(f'{count}x: {old_url[:70]}... -> {new_url}')
    else:
        print(f'0x: {old_url[:70]}... (nao encontrado)')

if content == original:
    print('Nenhuma alteracao necessaria')
    exit(0)

ARTICLE_PATH.write_text(content, encoding='utf-8')
print(f'Artigo atualizado: {ARTICLE_PATH}')

os.chdir(BLOG_REPO_PATH)

remote = f'https://x-access-token:{GITHUB_TOKEN}@github.com/sergioskmcle-sketch/blog-gamer.git'
subprocess.run(['git', 'remote', 'set-url', 'origin', remote], capture_output=True)
subprocess.run(['git', 'add', '-A'], check=True)

result = subprocess.run(['git', 'diff', '--cached', '--stat'], capture_output=True, text=True)
print(f'Changes:\n{result.stdout}')

subprocess.run(['git', 'commit', '-m', 'fix: substituir links tag por meli.la nos produtos do GTA 6'], check=True)
subprocess.run(['git', 'push', 'origin', 'main'], check=True)
print('Push realizado com sucesso!')
