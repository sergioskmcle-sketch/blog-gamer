# Squad Blog Gamer — Memórias

## Histórico
- **2026-08-04:** Squad criada com 6 agentes. Fase 0 (auditoria) concluída com 5 relatórios especializados.
- **17 artigos** existentes analisados. Problemas críticos: links meli.la quebrados, product-cards legados, placeholders visíveis, foco misturado.

## Decisões
- **Afiliado:** links diretos Google Shopping (Serper), sem cookies de sessão
- **Imagens:** RAWG para jogos, Serper para produtos, IA para capas. Nada de imagens locais.
- **Foco:** 1 tema por artigo. Proibido misturar categorias.
- **Agentes:** 6 agentes (Ana, Carlos, Felipe, Juliana, Lucas, Rafaela)

## Lições Aprendidas
- Artigo battle-royale (nota 2/10) mostrou que sem persona o conteúdo vira Wikipedia
- Artigo cadeiras-gamer mostrou que placeholders passam sem validação
- Artigo god-of-war mostrou que imagens base64 poluem o markdown
- Artigos duplicados (Xbox sale x2 no mesmo dia) canibalizam keywords

## 2026-08-11 — Pipeline de Revisão Automatizada (6 hooks)
- **Deu certo:** 6 hooks executaram de ponta a ponta; consolidado + ocorrencias + parecer LLM por etapa; Pesquisa e Publicação 10/10; captura de problemas reais (P0 montagem quebrada, imagens inexistentes, título sem keyword).
- **Não deu:** 4/6 etapas reprovaram. Bugs pré-existentes: `keepPubDate` falha com CRLF (`^---\n` não casa `\r\n` em `gerar-artigo.mjs`), montagem segmentada sem seção por produto, `category` sobrescrita (review→lista), copy-assets sem validar imagem local, capa sem fallback, preços em prosa. Cadeiras/teclados abortam: API monitor com oferta fraca no modo `remote` e `AFFILIATE_MODE` vazio cai em `legacy` (exige SERPER).
- **Ação:** artigo/capa revertidos; relatório em `_expxagents/_memory/relatorio-teste-pipeline-revisoes-2026.md`.
