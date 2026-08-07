# Skill: Pesquisa Web

## Descrição
Coleta tendências, notícias e dados de fontes confiáveis sobre gaming no Brasil.

## Fontes de Trending

### RSS Feeds
- MeuPlayStation: https://meuplaystation.com/feed
- GameVicio: https://www.gamevicio.com.br/feed
- IGN Brasil: https://br.ign.com/feed
- TecMundo Games: https://www.tecmundo.com.br/rss/games.xml

### Reddit
- r/gaming (hot posts)
- r/gamesEcultura (hot posts)

### Google Trends
- Buscar tendências de gaming no Brasil

## Fluxo
1. Buscar headlines dos RSS feeds (últimas 24h)
2. Buscar posts do Reddit (hot, últimas 24h)
3. Extrair keywords e frecuência
4. Classificar dominio: games / hardware / mixed / promo
5. Filtrar duplicatas vs últimos 5 artigos
6. Retornar top 15 trending topics com fontes

## Classificação de Dominio
- **GAMES:** jogos, consoles, software, DLC, updates, esports
- **HARDWARE:** periféricos, peças, acessórios, setups
- **MISTURA:** NUNCA — rejeitar artigo que mistura
- **PROMO:** ofertas, descontos, sales

## Scripts Relacionados
- `scripts/gerar-artigo.mjs` — função `discoverTrendingTopic()` (L367-452)
- `scripts/gerar-artigo.mjs` — função `extractTrendingTopics()` (L179-191)
- `scripts/gerar-artigo.mjs` — função `classifyDomain()` (L137-150)
