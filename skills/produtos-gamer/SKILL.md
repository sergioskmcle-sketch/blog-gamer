# Skill: Produtos Gamer

## Descrição
Busca e valida produtos de gaming via Google Shopping (API Serper). Garante que cada produto é EXATAMENTE do tema do artigo.

## API
- **Provedor:** Serper (Google Shopping)
- **Script:** `scripts/google_shopping.mjs`
- **Função:** `searchGoogleShopping(query, apiKey, limit)`

## Regras de Busca

### Validação de Tema (regra de categoria única)

A regra de categoria única **é código**, não orientação textual. A fonte de verdade está em
`scripts/product_naming.mjs` (`PRODUCT_CATEGORIES`, `detectCategory()`, `productMatchesCategory()`),
aplicada em `sanitizeProducts()`:

- Produto deve ser da **MESMA categoria** do artigo (filtro em código, com exclusões por categoria)
- Exemplos:
  - Artigo de headset → apenas headsets (não kits, não teclados)
  - Artigo de teclado → apenas teclados (não mouse, não headsets)
  - Artigo de cadeira → apenas cadeiras gamer
- Produto que mistura categorias é **rejeitado pelo código** (`ACCESSORY_NOISE`/exclude)
- Se o filtro deixar a lista abaixo do mínimo, o gerador refaz a busca e, se ainda faltar, **falha** em vez de publicar errado

### Campos Obrigatórios por Produto
| Campo | Descrição | Obrigatório |
|-------|-----------|:-----------:|
| name | Nome completo do produto | Sim |
| brand | Marca (HyperX, Logitech, etc.) | Sim |
| price | Preço atual (BRL) | Sim |
| link | Link direto do Google Shopping | Sim |
| image | Thumbnail do Google Shopping | Sim |
| store | Nome da loja | Sim |
| specs | Especificações principais | Não (desejável) |

### Whitelist de Marcas (Hardware/Periféricos)
HyperX, Logitech, Razer, SteelSeries, Corsair, Kingston, Wooting, Keychron, ATK, Redragon, ThunderX3, DT3, Husky, AOC, Samsung, LG, ASUS, MSI, AMD, NVIDIA, Intel

### Blacklist de Produtos
- Kits gamer (headset + teclado + mouse)
- Produtos não-gaming (mouse genérico, teclado de escritório)
- Produtos sem preço
- Produtos de lojas não confiáveis

## Formato de Saída
```json
{
  "products": [
    {
      "name": "HyperX Cloud Stinger 2 Core",
      "brand": "HyperX",
      "price": "R$ 199,90",
      "link": "https://www.google.com/shopping/...",
      "image": "https://encrypted-tbn0.gstatic.com/...",
      "store": "Amazon",
      "specs": "Driver 40mm, USB-C, peso 275g"
    }
  ]
}
```

## Scripts Relacionados
- `scripts/google_shopping.mjs` — busca de produtos
- `scripts/gerar-artigo.mjs` — função `sanitizeProducts()` — filtra e deduplica
