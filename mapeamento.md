# Mapeamento do Blog Gamer

Este documento explica **como o blog funciona hoje**, passo a passo, em linguagem simples.

---

## 1. O que é o Blog Gamer

É um blog de notícias, reviews e listas sobre games e periféricos gamers. Os artigos são criados **automaticamente por inteligência artificial** e publicados no GitHub Pages (um serviço gratuito de hospedagem de sites).

O blog foca em:
- Notícias de jogos e consoles
- Reviews de periféricos (mouse, teclado, headset, monitor)
- Listas dos melhores produtos com preços do Mercado Livre
- Guias de compra
- Comparativos

Todo artigo tem **links de afiliado** do Mercado Livre. Quando alguém clica e compra, o blog recebe uma comissão.

---

## 2. Visão Geral — Como tudo funciona

Existem **duas formas** de gerar artigos. Uma é mais completa e roda automaticamente a cada 2 dias. A outra é mais simples e roda todos os dias em um servidor.

### Pipeline Principal (a completa)

- Roda a cada 2 dias automaticamente
- Faz tudo: pesquisa trending, busca produtos, gera artigo com IA, injeta imagens, publica
- É a que realmente importa

### Pipeline Secundária (a simples)

- Roda todo dia em um servidor (VM) no Google Cloud
- Faz o básico: escolhe tema, busca produtos, gera artigo, publica
- É uma versão mais antiga e simplificada

Vou explicar cada uma em detalhe.

---

## 3. Pipeline Principal — Passo a Passo

### Passo 1: O sistema acorda

Todo 2 dias, às 9h30 da manhã (horário de Brasília), o GitHub Actions dispara automaticamente. É como um alarme que faz tudo começar.

Também é possível disparar manualmente pelo painel do GitHub.

### Passo 2: Verificação de segurança

Antes de tudo, o sistema verifica:
- Já geramos um artigo há menos de 20 horas? Se sim, para tudo (para não criar artigos demais)
- Se alguém pediu para forçar a geração, ignora essa verificação

### Passo 3: Descoberta do tema

O sistema precisa decidir **sobre o que escrever**. Para isso, ele faz 3 coisas:

#### 3a. Coleta tendências da internet

Ele visita automaticamente 4 sites de notícias de games e 2 fóruns do Reddit, e lê os títulos das matérias mais recentes:
- **MeuPlayStation** — notícias de PlayStation
- **GameVicio** — notícias gerais de games
- **IGN Brasil** — notícias internacionais traduzidas
- **TecMundo Games** — notícias de tecnologia e games
- **Reddit r/gaming** — o que está em alta nos games
- **Reddit r/gamesEcultura** — games em português

#### 3b. Extrai palavras-chave

De todos esses títulos, o sistema conta quais palavras aparecem mais. Por exemplo, se "GTA 6" aparece 15 vezes, é porque está em alta. Ele tem uma lista de palavras que ele procura: nomes de jogos, consoles, marcas de periféricos, eventos de games, etc.

#### 3c. Escolhe o tema (com ajuda da IA, opcionalmente)

O sistema pode enviar essas tendências para a inteligência artificial (Groq) e pedir: "qual tema é mais relevante e que ainda não escrevemos sobre?".

Se a IA não estiver disponível, o sistema escolhe automaticamente com base nas palavras-chave que mais apareceram.

#### 3d. Rotação de categorias

O sistema alterna entre 5 categorias de artigo, sempre na mesma ordem:
1. **Notícia** — algo que aconteceu
2. **Review** — análise de produto/jogo
3. **Guia de compra** — o que comprar
4. **Lista** — os melhores de algo
5. **Promoção** — ofertas e descontos

Se o último artigo foi "notícia", o próximo será "review", e assim por diante.

### Passo 4: Pesquisa sobre o tema

O sistema usa o **Tavily** (um serviço de pesquisa) para buscar informações sobre o tema escolhido. É como fazer uma pesquisa no Google, mas de forma automatizada.

Ele busca 5 resultados e guarda as informações para usar no artigo.

### Passo 5: Busca de produtos no Mercado Livre

Se a categoria do artigo for "review", "guia", "lista" ou "promoção", o sistema precisa encontrar produtos para recomendar.

#### 5a. Como ele busca os produtos

Ele tenta duas abordagens:

**Primeira tentativa (via Google):**
- Usa o Tavily para pesquisar no Google: "mouse gamer Mercado Livre preço"
- Encontra links de produtos no Mercado Livre
- Visita cada página do produto e lê as informações (nome, preço, imagem)

**Segunda tentativa (via API do Mercado Livre):**
- Usa o Tavily para encontrar IDs de produtos (MLB12345678)
- Consulta a API oficial do Mercado Livre para pegar detalhes
- Precisa de uma "senha" (OAuth) para acessar a API

#### 5b. Filtragem dos produtos

O sistema filtra os produtos encontrados:
- **Só produtos gamer**: remove anything que não é de games (ex: whey protein, parafusadeira)
- **Só marcas conhecidas**: só mantém marcas como Logitech, Razer, HyperX, Corsair, etc.
- **Sem duplicatas**: se o mesmo produto aparece duas vezes, remove
- **Máximo 4 produtos**: não coloca mais que 4 em um artigo

### Passo 6: Geração dos links de afiliado

Para cada produto encontrado, o sistema gera um **link de afiliado**. É um link especial que rastreia se alguém comprou através do blog.

Como funciona:
1. O sistema visita a página do produto no Mercado Livre
2. Pega uma "chave de segurança" (CSRF token) da página
3. Envia um pedido para a API do Mercado Livre: "crie um link de afiliado para este produto"
4. O Mercado Livre retorna um link curto (tipo: meli.la/abc123)
5. Se falhar, ele tenta outro método
6. Se falhar de novo, usa o link original com o código de afiliado na URL

### Passo 7: Escrita do artigo pela IA

Agora o sistema envia tudo para a inteligência artificial (Groq, modelo GPT-OSS 120B):

#### O que ele envia:
- O tema escolhido
- As informações coletadas na pesquisa
- Os produtos encontrados com preços e links de afiliado
- Instruções detalhadas de como escrever

#### As instruções incluem:
- **Tom de voz**: "escreva como um gamer experiente, natural, sem parecer robô"
- **Estrutura obrigatória**: introdução, corpo com seções, tabela comparativa, FAQ, conclusão
- **Regras de SEO**: título entre 55-65 caracteres, palavra-chave no início
- **Marcações especiais**: [IMG:Nome do Jogo] antes de cada seção de jogo, [PRODUTO:1] depois de cada descrição de produto
- **Proibições**: não mencionar IA, não inventar dados, não repetir frases

#### Personalidade do escritor:
- Para notícias e listas: usa uma personalidade mais informal ("Mano Gamer")
- Para reviews e guias: usa um tom mais técnico e informativo

#### Tenta até 3 vezes:
Se o artigo não passar na validação (título muito curto, poucas palavras, sem marcações), a IA tenta de novo, enviando os erros para ela corrigir.

Se depois de 3 tentativas o título ainda estiver ruim, faz uma chamada separada só para reescrever o título.

### Passo 8: Pós-processamento

Depois que o artigo é escrito, o sistema faz vários ajustes:

#### 8a. Validação de links internos
O sistema verifica se os links para outros artigos do blog realmente existem. Se não existirem, remove.

#### 8b. Limpeza de imagens falsas
Remove imagens que a IA pode ter inventado (links de Wikipedia, Google, etc).

#### 8c. Injeção de imagens de jogos
Para cada marcação [IMG:Nome do Jogo]:
1. Busca a imagem do jogo no RAWG (um banco de dados de jogos)
2. Usa busca "inteligente" — se não encontrar "The Last of Us Part II", tenta variações como "The Last of Us"
3. Se não encontrar no RAWG, busca imagens no Tavily
4. Coloca a imagem no artigo com o comando HTML correto

#### 8d. Injeção de cards de produto
Para cada marcação [PRODUTO:N]:
1. Pega os dados do produto (nome, preço, imagem, link de afiliado)
2. Gera um card bonito com botão "VER NO MERCADO LIVRE"
3. Substitui a marcação pelo card

#### 8e. Imagem de capa
O sistema escolhe uma imagem de capa para o artigo, nesta ordem de preferência:
1. Imagem do jogo (se for artigo sobre jogo)
2. Imagem do produto mais caro (se tiver produtos)
3. Imagem gerada por IA (OpenAI GPT-5)
4. Imagem genérica do jogo relacionado

### Passo 9: Salvar o artigo

O sistema salva o artigo em formato Markdown (um formato simples de texto com formatação) na pasta `src/content/artigos/`. O arquivo tem:
- **Frente do arquivo** (frontmatter): título, descrição, data, categorias, tags, se tem afiliado
- **Corpo do artigo**: o texto completo com imagens e cards

### Passo 10: Atualizar estado

O sistema atualiza um arquivo de controle (`state.json`) com:
- Data do último artigo gerado
- Slug (nome do arquivo) do último artigo
- Categoria do último artigo
- Palavras-chave usadas recentemente
- Temas cobertos recentemente

Isso evita que o sistema gere artigos repetidos.

### Passo 11: Publicar no GitHub

O sistema faz um commit (salva as alterações) e envia para o GitHub:
1. Adiciona o novo artigo
2. Cria uma mensagem de commit: "feat: artigo gerado automaticamente - [nome-do-artigo]"
3. Envia para o repositório principal (branch main)

### Passo 12: Deploy (publicação)

Depois de enviar para o GitHub, o sistema dispara o workflow de deploy:
1. O GitHub Actions roda o comando `astro build` (transforma os arquivos Markdown em HTML)
2. Gera um arquivo de status do blog
3. Faz upload dos arquivos HTML para o GitHub Pages
4. O blog é atualizado em: https://sergioskmcle-sketch.github.io/blog-gamer/

**Pronto! O artigo está no ar.**

---

## 4. Pipeline Secundária — Passo a Passo

Esta é a versão mais simples que roda em um servidor (VM) no Google Cloud.

### Passo 1: O scheduler dispara

Todo dia às 10h00 (horário de Brasília), um programa chamado `scheduler.py` acorda e roda a geração.

### Passo 2: Verificação de duplicata

Se já gerou um artigo hoje, para tudo.

### Passo 3: Escolha do tema

O sistema tem uma lista pré-definida de 13 tipos de artigo, com 9 categorias:
- noticia, review, guia, lista, promoção, curiosidade, tutorial, comparativo, lançamento

Ele vai alternando entre eles, verificando se o último artigo não foi da mesma categoria.

### Passo 4: Pesquisa

Usa o Tavily para buscar informações (versão básica, sem pesquisa avançada).

### Passo 5: Busca de produtos

Diferente da pipeline principal (que usa API), esta faz **scraping direto**:
1. Monta URLs de busca no Mercado Livre (ex: lista.mercadolivre.com.br/headset-gamer)
2. Visita as páginas de listagem
3. Extrai IDs dos produtos com expressões regulares
4. Para cada produto, visita a página individual e extrai dados do HTML

### Passo 6: Filtros

Filtra por marcas gamer e remove produtos não-gamer (mesma lógica da pipeline principal).

### Passo 7: Links de afiliado

Gera links de afiliado pelo mesmo método da pipeline principal (CSRF + API).

### Passo 8: Escrita do artigo

Usa o modelo `llama-3.3-70b-versatile` do Groq (mais simples que o da pipeline principal).

O artigo pode ter 4 modos:
- **Informativo**: sem produtos, só conteúdo
- **Melhores**: produtos do mais caro ao mais barato (qualidade primeiro)
- **Custo-benefício**: produtos do mais barato ao mais caro
- **Misto**: conteúdo informativo + seção de produtos no final

### Passo 9: Validação e imagens

Valida frontmatter e injeta imagens RAWG (busca simples, sem fuzzy matching).

### Passo 10: Salvar e publicar

Salva o Markdown e faz git push direto (com token de acesso).

---

## 5. Scripts Auxiliares

### ml_affiliate.mjs / ml_affiliate.py
- **O que faz**: Gera links de afiliado do Mercado Livre
- **Como funciona**: Visita a página do produto, pega uma chave de segurança, pede à API do ML para criar um link curto (meli.la/...)

### openai-cover.mjs
- **O que faz**: Gera imagens de capa com inteligência artificial
- **Como funciona**: Baixa as imagens dos produtos, analisa o brilho, envia para o OpenAI GPT-5 com instruções específicas por categoria

### gerar-artigo-pilar.mjs
- **O que faz**: Gera artigos "pilares" (guias completos e detalhados)
- **Como funciona**: Divide o artigo em 9 seções, pesquisa cada uma separadamente, gera tudo de uma vez
- **Exemplo**: "Guia Definitivo do Setup Gamer 2026"

### download-images.mjs
- **O que faz**: Baixa imagens do Mercado Livre para o servidor local
- **Como funciona**: Substitui links de imagens externas por imagens locais (mais rápido e confiável)

### gerar-status.cjs
- **O que faz**: Gera um arquivo de status do blog
- **Como funciona**: Conta artigos, verifica se as APIs estão funcionando, gera um JSON com informações de saúde do blog

### gerar-placas-video.mjs
- **O que faz**: Gera artigos específicos sobre placas de vídeo
- **Como funciona**: Pipeline dedicada para o tema, com prompts específicos

### gerar-lista-monitores.mjs
- **O que faz**: Gera artigos específicos sobre monitores gamer
- **Como funciona**: Pipeline dedicada para o tema, com prompts específicos

### gerar-gta6.mjs
- **O que faz**: Gera artigo sobre o GTA 6
- **Como funciona**: Usa um template pré-definido com conteúdo hardcoded (não gera conteúdo novo)

---

## 6. Workflows do GitHub Actions

### gerar-conteudo.yml (o principal)
- **Quando roda**: A cada 2 dias às 9h30 UTC (6h30 horário de Brasília)
- **O que faz**: Roda o script principal de geração de artigo
- **Segredos usados**: Groq, Tavily, ML Client ID/Secret, ML Cookies, RAWG, OpenAI

### gerar-artigo-pilar.yml
- **Quando roda**: Só quando disparado manualmente
- **O que faz**: Roda o script de artigo pilar (guia completo)

### deploy.yml
- **Quando roda**: Sempre que algo é enviado para o branch main
- **O que faz**: Constrói o site (astro build) e publica no GitHub Pages

---

## 7. Credenciais (Chaves de API)

| Nome | Para que serve | Onde é usada |
|------|----------------|--------------|
| **GROQ_API_KEY** | Acesso à API de IA que escreve os artigos | Todos os scripts de geração |
| **TAVILY_API_KEY** | Acesso à ferramenta de pesquisa na internet | Todos os scripts de pesquisa |
| **ML_CLIENT_ID** | Identificação do app no Mercado Livre (para acessar a API) | Busca de produtos via API |
| **ML_CLIENT_SECRET** | Senha do app no Mercado Livre | Busca de produtos via API |
| **ML_COOKIES_B64** | Cookies de sessão do navegador (para gerar links de afiliado) | Geração de links de afiliado |
| **RAWG_API_KEY** | Acesso ao banco de dados de imagens de jogos | Injeção de imagens |
| **OPENAI_API_KEY** | Acesso à IA que gera imagens de capa | Geração de capa com IA |
| **GITHUB_TOKEN** | Permissão para enviar alterações para o GitHub | Git push + API do GitHub |
| **ADMIN_API_KEY** | Senha do painel administrativo | Login no admin |
| **ML_AFFILIATE_TAG** | Código de afiliado (sergioskm) | Todos os scripts de afiliado |

---

## 8. Arquivos de Estado

### state.json (raiz)
- **O que registra**: Último artigo gerado, data, slug, categoria, palavras-chave usadas, temas cobertos
- **Para que serve**: Evitar artigos repetidos e manter rotação

### state.json (automation/)
- **O que registra**: Índice da última categoria, data do último artigo, último slug
- **Para que serve**: Controle da pipeline secundária

### article_history.json
- **O que registra**: Histórico completo de artigos gerados (título, slug, categoria, modo, data, query do ML, quantidade de produtos)
- **Para que serve**: Verificar o que já foi escrito e evitar repetição

### public/status.json
- **O que registra**: Informações de saúde do blog (total de artigos, último deploy, categorias, status das APIs)
- **Para que serve**: Dashboard de status

---

## 9. Painel Administrativo

### O que é
Um site interno (não público) que permite gerenciar o blog.

### O que permite fazer
- Ver lista de todos os artigos
- Criar, editar e excluir artigos
- Definir artigo destaque
- Ver estatísticas de visualização
- Alterar cores e configurações do blog

### Como funciona
- É um servidor FastAPI que roda na VM
- Tem autenticação por senha
- Usa a API do GitHub para ler/escrever artigos
- Usa SQLite para armazenar contagem de visualizações

---

## 10. Resumo do Fluxo Completo

```
A cada 2 dias:
  GitHub Actions acorda
    → Verifica se pode gerar
    → Lê notícias e Reddit (tendências)
    → Pesquisa na internet (Tavily)
    → Busca produtos no Mercado Livre
    → Gera links de afiliado
    → IA escreve o artigo (Groq)
    → Injeta imagens (RAWG + OpenAI)
    → Salva o arquivo .md
    → Envia para o GitHub
    → GitHub Pages publica o blog
    → Artigo está no ar!
```

---

*Este documento foi criado para análise do pipeline atual. Após revisão, será criada uma versão técnica detalhada.*
