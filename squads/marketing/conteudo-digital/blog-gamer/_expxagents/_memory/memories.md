# Memórias da Squad — Blog Gamer

## Histórico de Artigos Gerados

### Teste 1: "Melhores Headsets Gamer Custo-Benefício de 2026"
- **Data:** 2026-08-04
- **Status:** APROVADO COM NOTAS (8.5/10)
- **Arquivo:** `src/content/artigos/melhores-headsets-gamer-custo-beneficio-2026.md`
- **Produtores:** 7 headsets (HyperX Cloud Alpha, Cloud Stinger 2 Core, Redragon Zeus X H510, Razer BlackShark V2 X, Logitech G733, Havit H2002D, JBL Quantum 100M2)
- **Problemas corrigidos:** dado estatístico sem fonte (P2), tag genérica removida (P3), 7+ URLs de imagem quebradas corrigidas (P1) — verificadas com HEAD 200 em 2026-08-04
- **Imagens:** frontmatter + corpo usam URLs externas verificadas (HyperX CDN, RedragonShop, Razer, Logitech, BigCommerce Havit, JBL demandware, Shopify, YouTube, Amazon, Etsy); imagem do gráfico RTINGS removida (403/hotlink bloqueado)
- **Relatório:** `_expxagents/_memory/relatorio-teste-headsets-2026.md`

## Decisões Importantes

1. **Preços no corpo:** Aceitável em reviews de produto — apenas remover preços hardcoded em artigos de lista/notícia (usar tabela comparativa)
2. **Dados estatísticos:** Sempre incluir URL da fonte ou remover o dado
3. **Tags:** Máximo 6, todas específicas ao tema

## Lições Aprendidas

- Usar `product-btn` (nunca `product-card`) — formato legado proibido
- FAQ sempre com H3 (`###`) — nunca negrito ou número solto
- Mínimo 2 links internos no corpo + 2 em Continue Explorando
- Links meli.la existentes: MANTER. Novos: PROIBIR
- Imagens externas apenas (sem base64/local)
- Toda URL de imagem do redator deve ser validada com `curl -s -o NUL -L -I -w "%{http_code}"` antes de salvar (redator inventa URLs 404/403)
- URLs de imagem oficiais extraídas de `og:image` das páginas dos fabricantes (HyperX CDN, RedragonShop CDN, Razer assets2, JBL demandware `dw/image/v2`) são as mais confiáveis
- RTINGS bloqueia hotlinking (403) — não usar imagens do domínio rtings.com

## Artigos Publicados

| # | Artigo | Data | Status |
|---|--------|------|--------|
| 1 | Melhores Headsets Gamer Custo-Benefício de 2026 | 2026-08-04 | Rascunho pronto |
