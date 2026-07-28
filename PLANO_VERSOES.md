# Plano de Versões — Blog Gamer

Este documento registra as versões do pipeline de geração de artigos, explica o que muda em cada uma e fornece os comandos para alternar entre elas.

---

## Versão 1.0 (atual — estável)

**Data:** 2026-07-28  
**Commit de referência:** `adbb609`  
**Tag:** `v1.0`

### Características

- Pipeline de pesquisa simples com **1 query no Tavily** por artigo.
- **Máximo de 5 resultados** usados como contexto.
- **Score de relevância do Tavily ignorado** — os resultados são usados na ordem que chegam.
- **Nenhum filtro de domínio** — qualquer site pode entrar no contexto.
- **Sem deduplicação** de URLs repetidos.
- **Truncamento fixo** de 450 caracteres por resultado.
- **Corte de tokens cego**: quando o prompt estoura o limite, o contexto de pesquisa é reduzido em 25% do final.
- **Prompt básico** para a IA: "use estes fatos".
- Tratamento de erros corrigido para evitar `Cannot read properties of undefined (reading 'slice')`.

### Quando usar

Use a v1.0 quando quiser garantia de estabilidade. Ela está funcionando e publicando artigos normalmente.

---

## Versão 1.1 (em desenvolvimento — branch `feature/v1.1-multisource`)

**Objetivo:** melhorar a qualidade dos artigos com pesquisa em múltiplas fontes e síntese original.

### Mudanças planejadas

- **Múltiplas queries** por artigo (ex: notícia, review, guia).
- Coleta de **10–15 resultados**.
- **Ranking de fontes** usando:
  - Score de relevância do Tavily.
  - Tier de confiança do domínio (jornalismo gamer > tech geral > fóruns).
  - Recência do conteúdo.
  - Sobreposição de palavras-chave com o tema.
- **Deduplicação** de URLs repetidos.
- **Alocação inteligente de tokens**: fontes melhores ganham mais espaço.
- **Corte de tokens por qualidade**: remove a pior fonte primeiro, preservando as melhores.
- **Prompt refinado** instruindo a IA a sintetizar, não copiar.
- **Citação de fontes** com base no ranking.

### Quando usar

Use a v1.1 para testar se a qualidade dos artigos melhora. Caso contrário, volte para a v1.0.

---

## Comandos de rollback

### Voltar para a v1.0 (código estável)

```bash
# Restaura todos os arquivos do commit da v1.0
git checkout v1.0 -- .

# Cria um commit de rollback
git add -A
git commit -m "rollback: retorna para v1.0 (pesquisa simples)"

# Envia para o GitHub
git push origin main
```

### Voltar para a v1.1 (depois de um rollback)

```bash
# Restaura todos os arquivos da tag v1.1
git checkout v1.1 -- .

# Cria um commit de restauração
git add -A
git commit -m "restore: volta para v1.1 (pesquisa multi-source)"

# Envia para o GitHub
git push origin main
```

### Usar tags para alternar rapidamente

```bash
# Listar tags
git tag

# Ver qual commit uma tag aponta
git show v1.0 --quiet

# Criar uma nova tag de backup manualmente
git tag -a v1.0-backup-2026-07-28 -m "Backup antes de testar v1.1"
git push origin v1.0-backup-2026-07-28
```

---

## O que não é revertido

O rollback restaura **código e scripts**. Ele **não remove** artigos já publicados pelo GitHub Actions durante a v1.1.

Se quiser remover artigos gerados pela v1.1, será necessário:

1. Apagar o arquivo `.md` em `src/content/artigos/`
2. Apagar imagens relacionadas em `public/images/produtos/` se houver
3. Commitar e pushar
4. Aguardar o deploy

---

## Fluxo recomendado para testar a v1.1

1. Criar a branch `feature/v1.1-multisource` a partir da `main`.
2. Implementar as mudanças nessa branch.
3. Fazer testes locais com `npm test`.
4. Disparar o workflow manualmente na branch para gerar um artigo de teste.
5. Avaliar a qualidade do artigo.
6. Se ficar bom: fazer merge na `main`.
7. Se não ficar bom: fazer checkout da `v1.0` na `main` e pushar.

---

## Notas

- As **secrets do GitHub** (`GROQ_API_KEY`, `TAVILY_API_KEY`, etc.) não são afetadas por rollback.
- O **cron** do workflow continua o mesmo a menos que seja alterado explicitamente.
- O **limite do Tavily** (1.000 consultas/mês) deve ser monitorado durante os testes da v1.1, pois o número de queries por artigo pode aumentar.
