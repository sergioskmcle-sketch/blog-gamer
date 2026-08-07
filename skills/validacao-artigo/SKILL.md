# Skill: Validação de Artigo

## Descrição
Valida qualidade, estrutura e conformidade do artigo antes da publicação. Baseado nas regras editoriais do Promo Gamer.

## Checklist de Validação

### P0 — Crítico (REJEITAR se falhar)
- [ ] NENHUM placeholder visível ([PRODUTO:1], [IMG:xxx])
- [ ] NENHUM bloco `<div class="product-card">` (formato legado)
- [ ] NENHUMA imagem data:URI (base64)
- [ ] NENHUM link interno quebrado (verificar se artigo existe)
- [ ] Frontmatter YAML válido

### P1 — Alto (ACEITAR COM NOTA se falhar)
- [ ] title: 55-65 caracteres, keyword nos primeiros 40%
- [ ] description: 120-160 caracteres
- [ ] word count >= mínimo da categoria
- [ ] Links internos >= 2
- [ ] Fontes >= 2 com URLs clicáveis
- [ ] FAQ usa H3 (###) para cada pergunta
- [ ] Seção "Continue Explorando" existe
- [ ] Seção "Fontes" existe com URLs

### P2 — Médio (NOTA se falhar)
- [ ] Tags >= 3 e específicas
- [ ] category: valor válido
- [ ] affiliate: boolean correto
- [ ] Imagem de capa presente
- [ ] NENHUM preço hardcoded no corpo (apenas na tabela)
- [ ] NENHUM dado sem fonte
- [ ] Foco em 1 tema único (sem mistura de categorias)

### P3 — Baixo (SUGESTÃO)
- [ ] Slug SEO-friendly (< 75 chars)
- [ ] Título com keyword nos primeiros 40%
- [ ] Descrição com CTA ou gancho

## Validação de Foco (Obrigatório)
O artigo deve tratar de APENAS 1 tema:
- Headset → apenas headsets (não kits, não teclados)
- GTA 6 → apenas GTA 6 (não God of War)
- PS5 → apenas PS5 (não Xbox)

Se o artigo mencionar produto/conteúdo de outra categoria → REJEITAR

## Validação de Produto↔Imagem
- Cada produto mencionado deve ter imagem correspondente
- Imagem deve ser do produto EXATO (não genérica)

## Validação de Links
- meli.la existentes: MANTER
- meli.la novos: PROIBIR
- Afiliados novos: apenas Google Shopping (Serper)
- Links internos: devem retornar 200

## Scripts Relacionados
- `scripts/test-injecao.mjs` — 145 asserts de validação
- `scripts/gerar-artigo.mjs` — função `validate()` (L1650-1750)
- `scripts/gerar-artigo.mjs` — função `checkTitle()` (L1580-1620)
