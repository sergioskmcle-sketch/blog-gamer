# Plano de Versões — Blog Gamer

Este documento registra as versões do pipeline de geração de artigos, explica o que muda em cada uma e fornece os comandos para alternar entre elas.

---

## Versão 1.0 (estável)

**Data:** 2026-07-28  
**Commit de referência:** `adbb609`  
**Tag:** `v1.0`

### Características

- Pipeline de pesquisa simples com **1 query no Tavily** por artigo.
- **Máximo de 5 resultados** usados como contexto.
- **Score de relevância do Tavily ignorado** — os resultados são usados na ordem que chegam.
- Botão de afiliado simples (texto com link).
- Sem índice de artigos no início do conteúdo.
- Validação básica de frontmatter, word count e marcadores.
- Tratamento de erros corrigido para evitar `Cannot read properties of undefined (reading 'slice')`.

### Quando usar

Use a v1.0 quando quiser garantia máxima de estabilidade. Ela está funcionando e publicando artigos normalmente.

---

## Versão 1.1 (em desenvolvimento — branch `feature/v1.1-melhorias-artigo`)

**Objetivo:** melhorar a qualidade, estrutura e visual dos artigos publicados.

### Mudanças planejadas

1. **Cards visuais de produto**
   - Substituir o botão de afiliado simples por cards com imagem, título, preço e botão.
   - Layout responsivo no CSS.

2. **Sumário/índice + rich snippets**
   - Gerar um `## Índice` com links âncora no início de cada artigo.
   - Adicionar schema.org `Article` no `<head>` para rich snippets do Google.

3. **Validação de dados concretos + fontes**
   - Verificar se fatos do artigo (datas, preços, notas, especificações) aparecem nas fontes de pesquisa.
   - Reforçar a seção `## Fontes` e garantir que dados tenham suporte.

### Quando usar

Use a v1.1 para testar se os artigos ficam mais organizados, visuais e confiáveis. Caso contrário, volte para a v1.0.

---

## Versão 1.2 — ideia arquivada (multi-source)

**Tag:** `v1.2-ideia-multisource`  
**Branch original:** `feature/v1.1-multisource` (antiga)

Esta ideia foi **arquivada** e renomeada para não conflitar com a v1.1. O objetivo era pesquisar em múltiplas fontes, ranqueá-las e fazer a IA sintetizar um artigo original.

Pode ser retomada no futuro se houver interesse.

---

## Comandos de rollback

### Voltar para a v1.0 (código estável)

```bash
# Restaura todos os arquivos do commit da v1.0
git checkout v1.0 -- .

# Cria um commit de rollback
git add -A
git commit -m "rollback: retorna para v1.0"

# Envia para o GitHub
git push origin main
```

### Voltar para a v1.1 (depois de um rollback)

```bash
# Restaura todos os arquivos da tag v1.1
git checkout v1.1 -- .

# Cria um commit de restauração
git add -A
git commit -m "restore: volta para v1.1 (melhorias de artigo)"

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

1. Trabalhar na branch `feature/v1.1-melhorias-artigo`.
2. Implementar as melhorias.
3. Fazer testes locais com `npm test`.
4. Disparar o workflow manualmente na branch para gerar um artigo de teste.
5. Avaliar a qualidade do artigo.
6. Se ficar bom: fazer merge na `main`.
7. Se não ficar bom: fazer checkout da `v1.0` na `main` e pushar.

---

## Notas

- As **secrets do GitHub** (`GROQ_API_KEY`, `TAVILY_API_KEY`, etc.) não são afetadas por rollback.
- O **cron** do workflow continua o mesmo a menos que seja alterado explicitamente.
- O **limite do Tavily** (1.000 consultas/mês) não muda na v1.1, pois a quantidade de buscas continua a mesma.
