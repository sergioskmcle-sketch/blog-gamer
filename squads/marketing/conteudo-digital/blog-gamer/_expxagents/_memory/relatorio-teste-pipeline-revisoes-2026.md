# Relatório de Validação — Pipeline de Revisão Automatizada (6 hooks)

**Data:** 2026-08-11
**Artigo alvo:** "5 Melhores headsets gamer com som espacial em 2026" (`src/content/artigos/5-melhores-headsets-gamer-com-som-espacial-em-2026.md`)
**Resultado:** TESTE CONCLUÍDO — 6 hooks executados de ponta a ponta; 4 etapas reprovaram e capturaram problemas reais; artigo revertido ao estado commitado ao final.

---

## O que deu certo

- **6 hooks de revisão executaram de ponta a ponta** (pesquisa → redação → SEO → design → revisão → publicação), sem travamento do pipeline.
- **Relatórios gerados automaticamente** em `output/reviews/5-melhores-headsets-gamer-com-som-espacial-em-2026/` (1 por etapa + `00-consolidado.md` + `revisoes.json` + `ocorrencias.jsonl`).
- **Consolidado automático** com score/status por etapa e resumo executivo (contagem P0/P1/P2).
- **Parecer do Agente (LLM)** gerado para cada etapa reprovada, com diagnóstico, tabela de impacto e correções recomendadas (redação, SEO, design e revisão produziram pareceres acionáveis).
- **Etapas aprovadas:** Pesquisa 10/10 (8/8 critérios) e Publicação 10/10 (9/9 critérios).
- **Captura de problemas reais:** a revisão pegou o P0 de montagem quebrada (lista dizia 5, corpo trazia blocos agrupados), imagens de produto inexistentes (P1), título sem keyword (P2) e preços em prosa (P1/P2) — todos confirmados manualmente.

## O que não deu certo / bugs encontrados

| # | Severidade | Problema | Origem |
|---|-----------|----------|--------|
| 1 | P0 | Montagem segmentada quebrou: título "5 Melhores" mas corpo sem seção própria por produto (blocos agrupados) | `gerar-artigo.mjs` — flag de seção própria não ativada |
| 2 | P0 | Corpo mistura domínios games × hardware (valorant, call of duty, gameplay + monitor, mouse, cadeira) | Prompt do gerador sem foco estrito de categoria |
| 3 | P1 | 4 imagens locais de produto inexistentes referenciadas (`/images/produtos/*`) | copy-assets não valida existência do arquivo antes do markup |
| 4 | P1 | Capa considerada ausente na validação de SEO (falta fallback por categoria) | `validarImagemCapa` pulada sem `defaultCover` |
| 5 | P2 | `keepPubDate` falha silenciosamente com arquivos CRLF → pubDate resetado na regeneração | regex `^---\n` não casa com `\r\n` em `gerar-artigo.mjs` |
| 6 | P2 | Categoria sobrescrita de `review` → `lista` pela montagem segmentada | frontmatter da montagem não preserva `category` |
| 7 | P2 | Título sem a keyword "headset gamer" e fora dos primeiros 40% | `gerarTitulo` sem validação de posição da keyword |
| 8 | P2 | Preços em prosa no corpo (4x) em vez de só no product-card | pós-processamento sem `stripPriceFromBody` |
| 9 | — | Cadeiras/teclados abortaram no teste: oferta fraca da API do monitor (modo `remote`); `AFFILIATE_MODE` vazio cai em `legacy`, que exige SERPER não configurado | `gerar-artigo.mjs` configuração/env |

## Scores por etapa

| Etapa | Agente | Status | Score | Problemas |
|-------|--------|--------|-------|-----------|
| Pesquisa e Fontes | Ana Pesquisadora | APROVADO | 10/10 | 0 |
| Redacao e Persona | Carlos Redator | REPROVADO | 7/10 | 1 |
| SEO On-Page | Felipe Otimizador | REPROVADO | 5/10 | 4 |
| Design e Layout | Lucas Designer | REPROVADO | 8/10 | 1 |
| Qualidade e Precisao | Juliana Revisora | REPROVADO | 4/10 | 3 |
| Pipeline e Publicacao | Rafaela Publicadora | APROVADO | 10/10 | 0 |

## Ações tomadas após o teste

- Artigo e capa revertidos ao estado commitado (`git restore`).
- Imagens de produto baixadas no teste removidas.
- Relatórios mantidos em `output/reviews/` como registro do teste (fora do versionamento, via gitignore).

## Próximos passos sugeridos

1. Corrigir regex do `keepPubDate` para tolerar `\r\n`.
2. Ativar seção própria por produto na montagem e validar `## ` por item.
3. Preservar `category` no frontmatter da montagem segmentada.
4. Adicionar validação de existência das imagens locais antes do markup.
5. Configurar `AFFILIATE_MODE=remote` (ou SERPER) para destravar cadeiras/teclados.
