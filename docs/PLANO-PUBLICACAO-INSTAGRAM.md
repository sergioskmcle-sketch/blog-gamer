# Plano — Publicação Automática dos Artigos no Instagram

> Status: **em implementação** (arte + publicação + workflow prontos; pendente revisão visual, secrets e teste de publicação).
> Repositório: `blog-gamer` · Conta Instagram: `@comproubarato2025` · Última revisão: 29/08/2026

## 10. Arte baseada em mockups (29/08/2026)

Revisão da geração de arte para usar **mockups prontos** (`mockup/feed-4x5.png` e `mockup/story-9x16.png`) em vez de capa gerada por IA:
- O mockup já traz o **buraco transparente** para a capa e o chip **LINK NA BIO** embutido.
- `scripts/gerar-arte-instagram.mjs` agora só: (1) encaixa a capa do artigo no placeholder (fit cover), (2) escreve o **título em dourado `#FFCE00`** no espaço vazio entre o placeholder e o chip, (3) redimensiona para o padrão IG (**feed 1080×1350** 4:5, **story 1080×1920** 9:16).
- Estilo segue `mockup/modelo_feed.png` (título dourado). Removida a dependência do `openai-cover.mjs` (não gera mais fundo por IA).
- Arte de teste regenerada para `volante-gamer-no-ps5-e-pc-4-opcoes-para-simuladores-em-2026` (feed + story) em `public/images/instagram/`.

## 9. Registro de implementação (16/08/2026)

Feito:
- [x] `scripts/gerar-arte-instagram.mjs` — gera feed 1080×1080 e story 1080×1920 (fundo `#050505`, glow roxo `#A855F7`, título Geist branco, URL `#06B6D4`, chip roxo PROMO GAMER + "link na bio" com ícone de link desenhado em SVG — sem depender de fonte de emoji). *(substituído em 29/08/2026 pela abordagem de mockups — ver §10)*
- [x] Fontes Geist (`Geist-Regular.ttf` / `Geist-Bold.ttf`) versionadas em `scripts/fonts/`; no runner do GH são registradas via `~/.fonts` + `fc-cache` (ubuntu tem fontconfig).
- [x] `scripts/publicar-instagram.mjs` — renova token via `FB_APP_SECRET` (fb_exchange_token), checa `content_publishing_limit`, dedup por slug (`scripts/.ig-posted.json` commitado), intervalo mínimo, publica feed + story via `/media` → `/media_publish`, nunca derruba o pipeline (exit 0), falha não registra o slug (retentável).
- [x] Workflow `gerar-conteudo.yml`: detecta slug → instala fontes → gera arte → commit/push (arte inclusa) → publica no Instagram → commita estado de dedup.
- [x] Secrets **pendentes de gravação** (ler do afiliados-monitor sem expor): `IG_TOKEN`, `IG_LONG_TOKEN`, `IG_IG_ID`, `IG_PAGE_ID`, `FB_APP_ID`, `FB_APP_SECRET`.
- [x] Arte de teste gerada para `volante-gamer-no-ps5-e-pc-4-opcoes-para-simuladores-em-2026` em `public/images/instagram/` — **aguardando revisão visual**.

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

## 4. Arte do Instagram (gerada com `sharp`, a partir da capa do artigo)

### 4.1 Identidade visual (cores reais do blog — `src/styles/global.css`)
| Elemento | Valor |
|---|---|
| Fundo | `#050505` (quase preto) |
| Glow de fundo | roxo `#A855F7` suave (radial no topo) |
| Título | fonte **Geist** bold, branco `#FFFFFF` |
| URL | ciano `#06B6D4` |
| Marca/CTA | chip roxo `#A855F7` + texto branco |
| Cantos arredondados | raio ~24px |
| Fontes | Geist (SVG → PNG via sharp; o runner do GH tem fontes nativas) |

### 4.2 Feed — 1080×1080 (quadrado)
1. Fundo preto `#050505` com glow roxo no topo.
2. Card central com a **capa do artigo** (1200×630, crop/contain), cantos arredondados, borda sutil e sombra.
3. **Título do artigo** (2–3 linhas, Geist bold, branco, grande).
4. `promogamer.com.br` em ciano.
5. Chip central roxo: **PROMO GAMER** + CTA **"🔗 link na bio"**.

### 4.3 Story — 1080×1920 (9:16)
Mesma identidade empilhada verticalmente:
1. Topo: título do artigo (grande, branco, bold) sobre fundo preto com glow roxo.
2. Meio: capa do artigo em card central (~1000×560).
3. Chip roxo **PROMO GAMER** + CTA **"🔗 link na bio"**.
4. Rodapé: `promogamer.com.br` em ciano.

## 5. Arquitetura de implementação

### 5.1 Novos arquivos em `scripts/`
| Arquivo | Responsabilidade |
|---|---|
| `gerar-arte-instagram.mjs` | Gera feed 1080×1080 e story 1080×1920 via sharp + template SVG, salva em `public/images/instagram/<slug>.png` |
| `publicar-instagram.mjs` | Renova token via `FB_APP_SECRET`, checa cota (`content_publishing_limit`), cria container (`/media`) → publica (`/media_publish`) feed e story, dedup por slug, não derruba pipeline em falha |

### 5.2 Integração no workflow `.github/workflows/gerar-conteudo.yml`
Após o passo "Commit e push" (e antes/depois do deploy):
1. Passo atual gera o artigo e a capa.
2. **Novo passo**: gera a arte do Instagram a partir da capa.
3. **Novo passo**: detecta o slug do artigo gerado e o expõe ao job.
4. Commit + push inclui a arte (`public/images/instagram/`).
5. **Novo passo**: `node scripts/publicar-instagram.mjs <slug>` — posta feed + story.

A imagem é servida ao Instagram via `https://raw.githubusercontent.com/<repo>/main/public/images/instagram/<slug>.png` (disponível imediatamente após o push, sem depender do deploy).

### 5.3 Secrets do GitHub Actions (repo `blog-gamer`)
Ler os valores **diretamente dos arquivos do afiliados-monitor** (`automation/instagram_token.json` e `automation/.env`) e gravar como secrets, **sem nunca exibir os valores nos logs**:

- `IG_TOKEN` (page_token)
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
- [ ] Confirmar que o token existente continua válido (verificado válido em 14/08/2026; renova a cada 60 dias).

## 7. Passos de implementação (ordem)
1. Criar `scripts/gerar-arte-instagram.mjs` e gerar a arte de teste a partir de 1 artigo existente → revisar visualmente (feed e story).
2. Criar `scripts/publicar-instagram.mjs` (renovação de token + cota + dedup + publicação).
3. Gravar os secrets no repo (lendo do afiliados-monitor, sem expor valores).
4. Teste manual: publicar 1 artigo de teste → conferir feed + story no perfil.
5. Integrar no workflow `gerar-conteudo.yml`.
6. Push + validar o ciclo automático de geração → publicação.
7. Registrar o postado em `docs/` (este documento + estado).

## 8. Critérios de aceite
- [ ] Feed 1080×1080 e story 1080×1920 gerados com capa + título + marca Promo Gamer.
- [ ] Artigo novo publicado automaticamente no feed e story após cada geração.
- [ ] Sem republicação de artigos já postados (dedup funcionando).
- [ ] Falha no Instagram não interrompe o pipeline de geração.
- [ ] Os dois projetos (afiliados-monitor e blog) publicando sem se conflitar.
