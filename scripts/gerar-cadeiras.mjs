import fs from 'fs';
import path from 'path';
import { gerarCapaOpenAI } from './openai-cover.mjs';

const SLUG = 'melhores-cadeiras-gamer-de-2026';
const DATA = new Date();
const DATE_STR = DATA.toISOString().slice(0, 10);

const products = [
  {
    name: 'Cadeira Gamer DT3 Rhino',
    price: 3559,
    image: 'https://m.media-amazon.com/images/I/71VRx5VKS4L._AC_SX679_.jpg',
    link: 'https://www.mercadolivre.com.br/cadeira-gamer-dt3-rhino/p/MLB27651414',
    desc: 'A DT3 Rhino é uma cadeira premium com encosto reclinável até 180°, apoio de braço 4D e espuma de alta densidade. Design imponente e máximo conforto para longas sessões de jogo.',
  },
  {
    name: 'Cadeira Gamer ThunderX3 Yama',
    price: 1599,
    image: 'https://m.media-amazon.com/images/I/71HBlNlD65L._AC_SX679_.jpg',
    link: 'https://www.mercadolivre.com.br/cadeira-gamer-thunderx3-yama/p/MLB28809216',
    desc: 'A ThunderX3 Yama combina design esportivo com ergonomia de ponta. Revestimento em couro sintético, almofadas lombar e cervical, e estrutura reforçada para até 150kg.',
  },
  {
    name: 'Cadeira Gamer Husky Storm',
    price: 1097,
    image: 'https://m.media-amazon.com/images/I/71bWpYl-9AL._AC_SY879_.jpg',
    link: 'https://www.mercadolivre.com.br/cadeira-gamer-husky-storm/p/MLB28696875',
    desc: 'A Husky Storm oferece excelente custo-benefício com reclinação ajustável, apoio de braço 3D e espuma injetada. Ideal para gamers que buscam qualidade sem gastar muito.',
  },
  {
    name: 'Cadeira Gamer Corsair T3 Rush',
    price: 2199,
    image: 'https://m.media-amazon.com/images/I/61x-1QHKMbL._AC_SX679_.jpg',
    link: 'https://www.mercadolivre.com.br/cadeira-gamer-corsair-t3-rush/p/MLB23996215',
    desc: 'A Corsair T3 Rush é feita com tecido respirável, ideal para climas quentes. Estrutura de aço, espuma moldada e suporte lombar ajustável para conforto durante horas.',
  },
  {
    name: 'Cadeira Gamer LuvinCo Genebra G500',
    price: 2199,
    image: 'https://m.media-amazon.com/images/I/71Ub1YHrpIL._AC_SX679_.jpg',
    link: 'https://www.mercadolivre.com.br/cadeira-gamer-luvinco-genebra-g500/p/MLB27545452',
    desc: 'A LuvinCo Genebra G500 é uma cadeira executiva com design gamer elegante. Encosto alto, braços ajustáveis e estofamento premium. Perfeita para jogar e trabalhar.',
  },
  {
    name: 'Cadeira Gamer DT3 Vita',
    price: 2499,
    image: 'https://m.media-amazon.com/images/I/71VRx5VKS4L._AC_SX679_.jpg',
    link: 'https://www.mercadolivre.com.br/cadeira-gamer-dt3-vita/p/MLB34923880',
    desc: 'A DT3 Vita é a evolução em cadeiras gamers, com design moderno, encosto em mesh respirável e sistema de suporte lombar inovador. Conforto premium para jogadores exigentes.',
  },
];

function buildProductCard(p, i) {
  return `<div class="product-card">
  <img src="${p.image}" alt="${p.name}" class="product-card-img" loading="lazy" decoding="async">
  <div class="product-card-body">
    <h3>${p.name}</h3>
    <div class="product-price">R$ ${p.price.toFixed(2)}</div>
    <p class="product-desc">${p.desc}</p>
    <a href="${p.link}" class="product-btn" target="_blank" rel="nofollow">VER NO MERCADO LIVRE</a>
  </div>
</div>`;
}

function gerarConteudo(coverPath) {
  const p1 = buildProductCard(products[0]);
  const p2 = buildProductCard(products[1]);
  const p3 = buildProductCard(products[2]);
  const p4 = buildProductCard(products[3]);
  const p5 = buildProductCard(products[4]);
  const p6 = buildProductCard(products[5]);

  return `---
title: "Melhores Cadeiras Gamer de 2026: Guia Completo com os Modelos Top do Mercado"
description: "Comparativo completo das melhores cadeiras gamers de 2026: DT3 Rhino, ThunderX3 Yama, Husky Storm, Corsair T3 Rush, LuvinCo Genebra G500 e DT3 Vita. Preços, características e onde comprar."
pubDate: ${DATE_STR}
tags: ["cadeira gamer", "dt3 rhino", "thunderx3 yama", "husky storm", "corsair t3 rush", "ergonomia", "guia de compra", "hardware gamer"]
category: "guia"
affiliate: true
image: "${coverPath || '/images/capas/' + SLUG + '.png'}"
---

## Introdução

Se você passa horas na frente do PC jogando, sabe que uma boa cadeira gamer não é luxo — é necessidade. Em 2026, o mercado brasileiro está repleto de opções que aliam design, ergonomia e durabilidade. Mas qual escolher? Preparamos um guia completo com as melhores cadeiras gamers disponíveis no Brasil, analisando conforto, materiais, ajustes e custo-benefício.

## Por que investir em uma cadeira gamer de qualidade?

Antes de mergulharmos nos modelos, vale entender por que uma cadeira gamer de qualidade faz diferença:

1. **Saúde da coluna**: Cadeiras ergonômicas previnem dores lombares e problemas posturais
2. **Conforto prolongado**: Espuma de alta densidade e tecidos respiráveis evitam desconforto após horas de uso
3. **Ajustes personalizados**: Altura, braços, inclinação e suporte lombar adaptam a cadeira ao seu corpo
4. **Durabilidade**: Materiais premium como aço e espuma injetada duram anos

## [PRODUTO:1] — A Melhor Cadeira Gamer Premium

${p1}

A DT3 Rhino é a escolha ideal para quem busca o que há de melhor em cadeiras gamers. Com encosto reclinável até 180°, você pode até tirar um cochilo entre uma partida e outra. O apoio de braço 4D permite ajustes de altura, profundidade, largura e rotação — um nível de personalização raro mesmo entre cadeiras premium.

**Destaques:**
- Reclinável até 180° com mecanismo frog
- Braço 4D (altura, profundidade, largura, rotação)
- Espuma de alta densidade (moldada)
- Capacidade para até 150kg
- Revestimento em linho respirável

## [PRODUTO:2] — Melhor Custo-Benefício Premium

${p2}

A ThunderX3 Yama é uma das cadeiras mais equilibradas do mercado. Ela entrega qualidade de construção impressionante por um preço mais acessível que as concorrentes diretas. O design esportivo com detalhes em vermelho ou azul combina com qualquer setup gamer.

**Destaques:**
- Revestimento em couro sintético premium
- Almofadas lombar e cervical inclusas
- Base reforçada com capacidade de 150kg
- Reclinação com trava em múltiplas posições
- Braços 3D ajustáveis

## [PRODUTO:3] — Melhor Custo-Benefício

${p3}

A Husky Storm prova que não precisa gastar uma fortuna para ter uma cadeira gamer de qualidade. Com um preço mais acessível, ela entrega o essencial: conforto, ajustes e durabilidade. É a escolha certa para quem está montando o primeiro setup gamer ou tem orçamento limitado.

**Destaques:**
- Reclinação ajustável com trava
- Braço 3D ajustável
- Espuma injetada de alta resiliência
- Design ergonômico com suporte lombar
- Custo-benefício imbatível

## [PRODUTO:4] — Melhor em Tecido Respirável

${p4}

A Corsair T3 Rush se destaca por usar tecido respirável em vez de couro sintético. Para quem mora em regiões quentes ou soa muito durante as partidas, essa é a melhor opção. O tecido permite maior circulação de ar, mantendo você fresco mesmo após horas de jogo.

**Destaques:**
- Tecido respirável (não esquenta)
- Estrutura de aço reforçada
- Espuma moldada de memória
- Suporte lombar ajustável
- Braços 4D com ajuste de altura

## [PRODUTO:5] — Melhor Design Elegante

${p5}

A LuvinCo Genebra G500 é a opção perfeita para quem quer uma cadeira que funcione tanto para jogar quanto para trabalhar. Seu design é mais discreto que as cadeiras gamers tradicionais, mas sem abrir mão do conforto e da ergonomia.

**Destaques:**
- Design executivo com toque gamer
- Encosto alto com suporte cervical
- Braços ajustáveis em altura
- Estofamento premium
- Base cromada com rodízios silenciosos

## [PRODUTO:6] — A Inovadora em Mesh

${p6}

A DT3 Vita representa a nova geração de cadeiras gamers, com encosto em mesh (tela respirável) que proporciona ventilação superior. O sistema de suporte lombar inovador se adapta aos movimentos do corpo, oferecendo conforto ativo durante o uso.

**Destaques:**
- Encosto em mesh respirável
- Suporte lombar adaptativo
- Design moderno e minimalista
- Estrutura em alumínio
- Braços 3D ajustáveis

## Tabela Comparativa

| Modelo | Preço | Reclinação | Braços | Material | Capacidade |
|--------|-------|------------|--------|----------|------------|
| DT3 Rhino | R$ 3.559 | 180° | 4D | Linho | 150kg |
| ThunderX3 Yama | R$ 1.599 | Multi-travas | 3D | Couro Sintético | 150kg |
| Husky Storm | R$ 1.097 | Ajustável | 3D | Couro Sintético | 120kg |
| Corsair T3 Rush | R$ 2.199 | 160° | 4D | Tecido | 120kg |
| LuvinCo Genebra G500 | R$ 2.199 | 135° | 3D | Couro Premium | 130kg |
| DT3 Vita | R$ 2.499 | 160° | 3D | Mesh | 130kg |

## Como escolher a cadeira gamer ideal?

### 1. Altura e peso
Verifique a capacidade máxima de peso e se a cadeira se adequa à sua altura. Modelos como a DT3 Rhino suportam até 150kg e são recomendadas para pessoas de até 1,90m.

### 2. Material do revestimento
- **Couro sintético**: Mais fácil de limpar, mas pode esquentar
- **Tecido/mesh**: Mais respirável, ideal para climas quentes
- **Linho**: Premium, respirável e durável

### 3. Tipo de espuma
- **Espuma injetada**: Maior durabilidade, não deforma com o tempo
- **Espuma de poliuretano**: Mais comum, custo menor

### 4. Ajustes disponíveis
- **Braços 3D**: Altura, profundidade e rotação
- **Braços 4D**: Altura, profundidade, rotação e largura
- **Reclinação**: De 135° a 180°

### 5. Garantia e suporte
Marcas como DT3 e Corsair oferecem garantia de 2 a 5 anos. Verifique antes de comprar.

## Perguntas Frequentes

**Qual a melhor cadeira gamer custo-benefício em 2026?**
A ThunderX3 Yama oferece o melhor equilíbrio entre preço e qualidade, com construção premium e preço acessível.

**Vale a pena investir em uma cadeira de R$ 3.000+?**
Para quem passa mais de 8 horas por dia sentado, sim. Modelos como a DT3 Rhino oferecem conforto superior que previne problemas de saúde a longo prazo.

**Cadeira gamer é melhor que cadeira de escritório?**
Depende. Cadeiras gamers focam em design e conforto para longas sessões, enquanto cadeiras ergonômicas de escritório priorizam ajustes finos de postura. Para jogos, as gamers são mais indicadas.

**Qual o prazo de entrega?**
O Mercado Livre oferece frete grátis em grande parte do Brasil para essas cadeiras, com entrega entre 2 a 10 dias úteis dependendo da região.

## Conclusão

A escolha da cadeira gamer ideal depende do seu orçamento e necessidades. Se o bolso permitir, a **DT3 Rhino** é a melhor opção premium do mercado. Para quem busca o melhor custo-benefício, a **ThunderX3 Yama** é imbatível. E se você prioriza frescor e respirabilidade, a **Corsair T3 Rush** em tecido é a escolha certa.

Independente da sua escolha, qualquer uma das cadeiras listadas aqui vai transformar sua experiência de jogo. Invista em conforto — sua coluna agradece!
`;
}

async function main() {
  let coverPath = null;
  try {
    coverPath = await gerarCapaOpenAI({
      mlProducts: products,
      category: 'guia',
      slug: SLUG,
    });
    console.log('Cover generated:', coverPath);
  } catch (e) {
    console.log('Cover generation failed:', e.message);
  }

  const content = gerarConteudo(coverPath);
  const outPath = path.join('src', 'content', 'artigos', `${SLUG}.md`);
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`Artigo salvo: ${outPath}`);
  console.log(`Tamanho: ${(Buffer.byteLength(content, 'utf8') / 1024).toFixed(1)} KB`);
}

main().catch(e => { console.error(e); process.exit(1); });
