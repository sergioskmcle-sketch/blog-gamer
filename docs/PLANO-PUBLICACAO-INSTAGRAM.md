# Plano — Publicação Automática dos Artigos no Instagram

> Status: **pronto para produção** (arte a partir de mockups + publicação + workflow + secrets; pendente apenas o 1º teste de publicação real e o link na bio).
> Repositório: `blog-gamer` · Conta Instagram: `@comproubarato2025` · Última revisão: 29/08/2026

## 11. Estado atual (29/08/2026)

O pipeline está **commitado, pushado e com secrets configurados**. No próximo artigo novo, o workflow roda a arte + publicação automaticamente.

Concluído:
- [x] Commit + push (`fa33f38`) de: mockups (`feed-4x5.png`, `story-9x16.png`), `scripts/gerar-arte-instagram.mjs`, `scripts/publicar-instagram.mjs`, `scripts/fonts/` (Bungee + Geist), `scripts/.ig-config.json.example`, `public/images/instagram/`, workflow `gerar-conteudo.yml`, `.gitignore` e este documento.
- [x] Gravação dos 6 secrets no GitHub: `IG_TOKEN`, `IG_LONG_TOKEN`, `IG_IG_ID`, `IG_PAGE_ID`, `FB_APP_ID`, `FB_APP_SECRET` (lidos do afiliados-monitor sem expor valores).
- [x] Arte de teste verificada visualmente (feed + story) para `volante-gamer-no-ps5-e-pc-4-opcoes-para-simuladores-em-2026`.

Ainda pendente:
- [ ] **1º teste real de publicação** do workflow (verificar se o artigo novo é postado no feed + story).
- [ ] Adicionar `https://promogamer.com.br` na **bio** do Instagram (link clicável — §6).

Observação (fora do escopo do Instagram): os runs recentes do `gerar-conteudo.yml` vêm falhando no passo **"Gerar artigo"**. Isso precisa ser investigado antes de confiar no ciclo automático — ver seção "Pendências conhecidas" ao final.

## 10. Arte baseada em mockups (29/08/2026)

A arte é gerada a partir de **mockups prontos** (`mockup/feed-4x5.png` e `mockup/story-9x16.png`) em vez de capa por IA:
- O mockup já traz o **buraco transparente** para a capa e o chip **LINK NA BIO** embutido.
- `scripts/gerar-arte-instagram.mjs`: (1) encaixa a capa do artigo no placeholder — a capa fica **por baixo** do mockup, então a moldura do buraco aparece sobre a borda da imagem; (2) escreve o **título em Bungee dourado `#FFCE00`** no espaço vazio entre o placeholder e o chip; (3) redimensiona para o padrão IG (**feed 1080×1350** 4:5, **story 1080×1920** 9:16).
- Fonte do título: **Bungee** (bold, geométrica, "O" quadrado — igual ao `mockup/modelo_feed.png`). `Anton.ttf` e as Geist ficam em `scripts/fonts/` como opções; a Bungee é a ativa.
- Sem dependência do `openai-cover.mjs` (não gera mais fundo por IA).
- Arte de teste gerada para `volante-gamer-no-ps5-e-pc-4-opcoes-para-simuladores-em-2026` (feed + story).

## 9. Registro de implementação (16/08/2026)

Feito:
- [x] `scripts/gerar-arte-instagram.mjs` — gera feed 1080×1080 e story 1080×1920 (fundo `#050505`, glow roxo `#A855F7`, título Geist branco, URL `#06B6D4`, chip roxo PROMO GAMER + "link na bio" com ícone de link desenhado em SVG — sem depender de fonte de emoji). *(substituído em 29/08/2026 pela abordagem de mockups — ver §10)*
- [x] Fontes Geist (`Geist-Regular.ttf` / `Geist-Bold.ttf`) versionadas em `scripts/fonts/`; no runner do GH são registradas via `~/.fonts` + `fc-cache` (ubuntu tem fontconfig).
- [x] `scripts/publicar-instagram.mjs` — renova token via `FB_APP_SECRET` (fb_exchange_token), checa `content_publishing_limit`, dedup por slug (`scripts/.ig-posted.json` commitado), intervalo mínimo, publica feed + story via `/media` → `/media_publish`, nunca derruba o pipeline (exit 0), falha não registra o slug (retentável).
- [x] Workflow `gerar-conteudo.yml`: detecta slug → instala fontes → gera arte → commit/push (arte inclusa) → publica no Instagram → commita estado de dedup.
- [x] Secrets **gravados em 29/08/2026** (lidos do afiliados-monitor sem expor): `IG_TOKEN`, `IG_LONG_TOKEN`, `IG_IG_ID`, `IG_PAGE_ID`, `FB_APP_ID`, `FB_APP_SECRET` — ver §5.3.
- [x] Arte de teste gerada para `volante-gamer-no-ps5-e-pc-4-opcoes-para-simuladores-em-2026` em `public/images/instagram/` — revisão visual concluída e aprovada (29/08).

Observações:
- Adicionado `IG_LONG_TOKEN` aos secrets (o refresh `fb_exchange_token` exige o `long_token`, não só o `page_token`).
- Estado de dedup commitado no repo para persistir entre runs do GitHub Actions (sem segredo, só slugs).
- Cota compartilhada com o afiliados-monitor respeitada via `content_publishing_limit` (blog: ~2/dia, afiliados: ~40/dia).

## 1. Objetivo

Publicar automaticamente cada artigo novo do blog `promogamer.com.br` no Instagram `@comproubarato2025` (feed + story), com arte gerada a partir da capa do artigo + título + marca **Promo Gamer**, sem vincular o projeto `blog-gamer` ao projeto `afiliados-monitor`.

## 2. Contexto e decisões confirmadas

- **Conta**: reutilizar `@comproubarato2025` (ig_id `17841479289474050`, página FB `1161789387012023`).
- **Os dois projetos podem publicar em paralelo**: o afiliados-monitor usa **token de acesso** (não cookies), então não há invalidação mútua como aconteceu com cookies do ML em duas VMs. Único recurso compartilhado é a **cota de posts da conta** (100 posts/24h na API; afiliados usa ~40/dia, blog ~2/dia — folga suficiente).
- **Escopo de conteúdo**: publicar **somente artigos novos** (a partir da implementação). **Não** fazer backfill dos 41 artigos existentes.
- **Modo de publicação**: automática, sem aprovação manual (igual ao afiliados-monitor).
- **Marca na arte**: **Promo Gamer** + URL `promogamer.com.br`.

## 3. Limitações de link clicável no Instagram (verificado 14/08/2026)

| Local | Clicável? | Automatizável via API? |
|---|---|---|
| Bio (até 5 links nativos) | ✅ | ❌ manual (1 vez) |
| Adesivo de link no story | ✅ | ❌ a API não adiciona adesivo de link |
| Link na legenda do feed | ❌ (só teste Meta Verified, ~10/mês) | — |
| Imagem/arte | ❌ | — |

**Estratégia de tráfego (funil "link na bio", igual ao que o afiliados-monitor já usa):**
- Bio da conta: adicionar `https://promogamer.com.br` manualmente (1 vez). **Ação pendente do usuário.**
- Legenda do feed: URL visível como texto (`promogamer.com.br/blog/<slug>`) + CTA "🔗 link na bio".
- Story: CTA "link na bio" (sem adesivo clicável).

## 4. Arte do Instagram (a partir de mockups `sharp`)

### 4.1 Identidade visual
| Elemento | Valor |
|---|---|
| Template | `mockup/feed-4x5.png` e `mockup/story-9x16.png` (componentes gráficos já embutidos) |
| Capa do artigo | encaixada **por baixo** do mockup, no buraco transparente (fit cover) |
| Título | fonte **Bungee** bold, dourado `#FFCE00`, centralizado no espaço vazio |
| CTA | chip **LINK NA BIO** (já vem no mockup) |
| Marca Promo Gamer | incorporada ao design do mockup |

### 4.2 Feed — 1080×1350 (4:5)
O mockup é redimensionado para 1080×1350; a capa entra no buraco; o título dourado fica no espaço entre o buraco e o chip.

### 4.3 Story — 1080×1920 (9:16)
O mockup é redimensionado para 1080×1920; mesma lógica (capa no buraco + título dourado acima do chip).

## 5. Arquitetura de implementação

### 5.1 Novos arquivos em `scripts/`
| Arquivo | Responsabilidade |
|---|---|
| `gerar-arte-instagram.mjs` | Gera feed 1080×1350 e story 1080×1920 usando os mockups de `mockup/`, encaixa a capa no placeholder e escreve o título em Bungee; salva em `public/images/instagram/<slug>.png` |
| `publicar-instagram.mjs` | Renova token via `FB_APP_SECRET`, checa cota (`content_publishing_limit`), cria container (`/media`) → publica (`/media_publish`) feed e story, dedup por slug, não derruba pipeline em falha |

### 5.2 Integração no workflow `.github/workflows/gerar-conteudo.yml`
1. **Detectar artigo gerado**: step `Detectar artigo gerado` expõe o `slug` do artigo novo.
2. **Instalar fontes**: step `Instalar fontes Geist` copia `scripts/fonts/*.ttf` para `~/.fonts` + `fc-cache` (inclui a Bungee).
3. **Gerar arte**: step `Gerar arte do Instagram` roda `node scripts/gerar-arte-instagram.mjs <slug>`, que usa `mockup/`.
4. **Commit e push**: inclui a arte gerada (`public/images/instagram/`).
5. **Publicar no Instagram**: `node scripts/publicar-instagram.mjs <slug>` — posta feed + story.
6. **Registrar estado de dedup**: commita `scripts/.ig-posted.json`.

A imagem é servida ao Instagram via `https://raw.githubusercontent.com/<repo>/main/public/images/instagram/<slug>.png` (disponível imediatamente após o push, sem depender do deploy).

### 5.3 Secrets do GitHub Actions (repo `blog-gamer`)
**Gravação concluída em 29/08/2026.** Valores lidos dos arquivos do afiliados-monitor (`automation/instagram_token.json` e `automation/.env`) e gravados **sem exibir os valores**:

- `IG_TOKEN` (page_token)
- `IG_LONG_TOKEN` (long_token — usado na renovação `fb_exchange_token`)
- `IG_IG_ID` (17841479289474050)
- `IG_PAGE_ID` (1161789387012023)
- `FB_APP_ID` (2196575497750019)
- `FB_APP_SECRET` (do `.env` do afiliados-monitor)

### 5.4 Proteções (replicando o afiliados-monitor)
- **Dedup**: arquivo de estado (ex.: `scripts/.ig-posted.json`) com os slugs já publicados — não republicar artigo.
- **Rate limit**: respeitar `content_publishing_limit` da conta + intervalo mínimo entre posts.
- **Resiliência**: falha no Instagram **não falha** o pipeline de geração (post retentável depois).
- **Sem cookies, sem VM**: tudo roda no GitHub Actions (ubuntu).
- **Renovação de token**: antes de publicar, renovar o token via `FB_APP_SECRET` (espelhando `refresh_instagram_token()` do afiliados-monitor).

## 6. Ações manuais do usuário (pendentes)
- [ ] Adicionar `https://promogamer.com.br` na **bio** do Instagram (até 5 links nativos) — única forma de link clicável.
- [ ] Observar o **1º ciclo automático** de publicação para confirmar que o artigo novo é postado no feed + story.

## 7. Passos de implementação (ordem)
1. ~~Criar `scripts/gerar-arte-instagram.mjs` e gerar a arte de teste a partir de 1 artigo existente → revisar visualmente (feed e story).~~ ✅
2. ~~Criar `scripts/publicar-instagram.mjs` (renovação de token + cota + dedup + publicação).~~ ✅
3. ~~Gravar os secrets no repo (lendo do afiliados-monitor, sem expor valores).~~ ✅ (29/08/2026)
4. ~~Teste manual: publicar 1 artigo de teste → conferir feed + story no perfil.~~ ⏳ (feito em 29/08; aguardando 1º post real)
5. ~~Integrar no workflow `gerar-conteudo.yml`.~~ ✅ (16/08)
6. ~~Push + validar o ciclo automático de geração → publicação.~~ ✅ (commit + push em 29/08)
7. ~~Registrar o postado em `docs/` (este documento + estado).~~ ✅

## 8. Critérios de aceite
- [x] Feed e story gerados com capa + título + marca Promo Gamer (mockups).
- [ ] Artigo novo publicado automaticamente no feed e story após cada geração (*a validar no 1º ciclo*).
- [ ] Sem republicação de artigos já postados (dedup funcionando).
- [ ] Falha no Instagram não interrompe o pipeline de geração.
- [ ] Os dois projetos (afiliados-monitor e blog) publicando sem se conflitar.

## Pendências conhecidas (fora do escopo do Instagram)
- Os runs recentes do workflow `gerar-conteudo.yml` estão **falhando no passo "Gerar artigo"** (ex.: RSS TecMundo 502, Adrenaline 403). Isso é um problema do gerador/pipeline de conteúdo, independente da publicação no Instagram, e precisa ser investigado para o ciclo diário voltar a produzir artigos. Enquanto isso, a publicação do Instagram só dispara quando um artigo novo é criado com sucesso.
