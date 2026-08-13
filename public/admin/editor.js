/* === Layout Visual Editor === */

const PALETTE_COLORS = [
  '#A855F7','#9333EA','#7C3AED','#6D28D9','#5B21B6','#4C1D95','#3B0764','#2E1065',
  '#2ff801','#22d700','#1cb800','#16a300','#0d8a00','#0a7000','#005c00','#004d00',
  '#efecfb','#d4d0e8','#aca9b7','#757481','#555460','#3d3c4a','#2b2b3a','#1e1e2c',
  '#050505','#0d0d17','#12121d','#181825','#242433','#2b2b3a','#1C1C2E','#3D3D60',
  '#ff6e84','#ef4444','#dc2626','#b91c1c','#991b1b','#7f1d1d','#450a0a',
  '#F97316','#ea580c','#d97706','#b45309','#92400e','#78350f','#431407',
  '#22d3ee','#06b6d4','#0891b2','#0e7490','#155e75','#164e63','#083344',
  '#6366f1','#4f46e5','#4338ca','#3730a3','#312e81','#1e1b4b',
  '#10b981','#059669','#047857','#065f46','#064e3b',
  '#f59e0b','#d97706','#b45309','#92400e',
  '#ec4899','#db2777','#be185d','#9d174d',
  '#ffffff','#f5f5f5','#e5e5e5','#d4d4d4','#a3a3a3','#737373','#525252','#404040','#262626','#171717','#0a0a0a','#000000',
  '#38bdf8','#0ea5e9','#0284c7','#0369a1','#075985','#0c4a6e','#082f49',
  '#3b82f6','#2563eb','#1d4ed8','#1e40af','#1e3a8a','#172554','#0f172a',
  '#f0abfc','#e879f9','#d946ef','#c026d3','#a21caf','#86198f','#701a75','#581c87','#4a044e',
  '#f8fafc','#f1f5f9','#e2e8f0','#cbd5e1','#94a3b8','#64748b','#475569','#334155','#1e293b','#020617',
];

const COLOR_MAP = [
  {key:'accent',label:'Principal (roxo)',default:'#A855F7'},
  {key:'accent-hover',label:'Principal hover',default:'#9333EA'},
  {key:'accent-dim',label:'Principal suave',default:'rgba(168, 85, 247, 0.08)'},
  {key:'accent-glow',label:'Brilho do principal',default:'rgba(168, 85, 247, 0.25)'},
  {key:'bg-primary',label:'Fundo página',default:'#050505'},
  {key:'bg-secondary',label:'Fundo alternativo',default:'#020203'},
  {key:'bg-card',label:'Fundo card',default:'#0A0A0F'},
  {key:'bg-elevated',label:'Fundo elevado',default:'#12121D'},
  {key:'text-primary',label:'Texto principal',default:'#efecfb'},
  {key:'text-secondary',label:'Texto secundário',default:'#aca9b7'},
  {key:'text-muted',label:'Texto esmaecido',default:'#757481'},
  {key:'border',label:'Bordas',default:'#1C1C2E'},
  {key:'border-hover',label:'Bordas hover',default:'#3D3D60'},
  {key:'success',label:'Destaque (verde)',default:'#2ff801'},
  {key:'warning',label:'Aviso',default:'#F97316'},
  {key:'danger',label:'Erro/Perigo',default:'#EF4444'},
  {key:'on-accent',label:'Texto sobre o principal',default:'#fff'},
  {key:'selection-bg',label:'Seleção (fundo)',default:'rgba(204, 151, 255, 0.3)'},
  {key:'selection-color',label:'Seleção (texto)',default:'#fff'},
];

const BG_COLORS = [
  '#000000','#050505','#0a0a0a','#0d0d0d','#111111','#161616','#1c1c1c','#222222',
  '#2a2a2a','#333333','#404040','#4a4a4a','#525252','#5c5c5c','#666666','#737373',
  '#07070d','#0a0a12','#0d0d17','#10101c','#12121d','#151522','#181825','#1c1c2b',
  '#1e1e2c','#242433','#2b2b3a','#33333f','#3d3d4a','#464652','#050a18','#0a1628',
  '#0c1a33','#0f223f','#16213e','#1a2b4f','#0f3460','#1e3a5f','#274066','#31548a',
  '#090312','#0f0620','#1b0a3e','#200b33','#250d45','#2d1b69','#330a3d','#3b0764',
  '#3d0c5c','#241437','#022c22','#042a26','#064e3b','#0b2b26','#0f2e2a','#0f3a33',
  '#1a0f0f','#2d1115','#3b1212','#450a0a','#4c1d1d','#221812','#2b1f14','#2a0a1e',
];

let iframeReady = false;
let layoutEditorInitialized = false;
let selectedElement = null;
let pendingChanges = {};
let pendingLogoFile = null;

function getBlogBase() {
  const path = window.location.pathname;
  const idx = path.indexOf('/admin');
  if (idx > 0) return path.substring(0, idx) + '/';
  return '/';
}

function getPreviewUrl() {
  const base = getBlogBase();
  return window.location.origin + base + '?edit=true';
}

function initLayoutEditor() {
  if (layoutEditorInitialized) {
    refreshIframeConnection();
    updateIframeScale();
    return;
  }
  layoutEditorInitialized = true;

  const iframe = document.getElementById('layoutIframe');
  iframe.src = getPreviewUrl();

  window.addEventListener('message', handleEditorMessage);
  window.addEventListener('resize', updateIframeScale);

  initColorSelector();
  initBgColorSwatches();
  populateColorSwatches(COLOR_MAP[0].key);

  iframe.addEventListener('load', () => {
    updateIframeScale();
    setTimeout(refreshIframeConnection, 300);
  });

  requestAnimationFrame(() => {
    updateIframeScale();
  });
}

function updateIframeScale() {
  const preview = document.getElementById('layoutPreview');
  const iframe = document.getElementById('layoutIframe');
  if (!preview || !iframe) return;

  const containerWidth = preview.clientWidth;
  const containerHeight = preview.clientHeight;

  if (containerWidth <= 0 || containerHeight <= 0) {
    requestAnimationFrame(updateIframeScale);
    return;
  }

  const targetWidth = 1440;

  if (containerWidth < targetWidth) {
    const scale = containerWidth / targetWidth;
    iframe.style.width = targetWidth + 'px';
    iframe.style.height = Math.round(containerHeight / scale) + 'px';
    iframe.style.transformOrigin = 'top left';
    iframe.style.transform = `scale(${scale})`;
  } else {
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.transform = 'none';
  }
}

function handleEditorMessage(event) {
  const msg = event.data;
  if (!msg || !msg.type) return;

  if (msg.type === 'editor-loaded') {
    iframeReady = true;
    document.getElementById('layoutElementInfo').textContent = '✓ Blog carregado. Clique em um elemento para editar.';
    setTimeout(() => syncSlidersFromIframe(), 300);
  }

  if (msg.type === 'editor-select') {
    selectedElement = msg.element;
    const elLabel = {
      'nav': 'Barra de menu',
      'logo': 'Logo',
      'sidebar': 'Sidebar',
      'main-content': 'Conteúdo principal',
    }[msg.element] || msg.element;
    document.getElementById('layoutElementInfo').textContent = `🔵 Selecionado: ${elLabel}`;
  }

  if (msg.type === 'editor-state') {
    if (msg.cssValues) applyCssValuesToUI(msg.cssValues);
  }

  if (msg.type === 'editor-elements') {
    console.log('Elementos encontrados:', msg.elements);
  }
}

function refreshIframeConnection() {
  const iframe = document.getElementById('layoutIframe');
  if (!iframe || !iframe.contentWindow) return;
  iframeReady = false;
  iframe.contentWindow.postMessage({ type: 'editor-ready' }, '*');
  setTimeout(() => {
    iframe.contentWindow.postMessage({ type: 'editor-get-state' }, '*');
  }, 300);
}

function sendToIframe(msg) {
  const iframe = document.getElementById('layoutIframe');
  if (!iframe || !iframe.contentWindow) return;
  iframe.contentWindow.postMessage(msg, '*');
}

function applyStyle(prop, value) {
  pendingChanges[prop] = value;
  sendToIframe({ type: 'editor-apply-style', payload: { property: prop, value: value } });
}

function layoutSliderChange(input) {
  const prop = input.dataset.prop;
  const unit = input.dataset.unit || '';
  const val = input.value + unit;
  input.nextElementSibling.textContent = val;
  applyStyle(prop, val);
}

function layoutRefresh() {
  const iframe = document.getElementById('layoutIframe');
  iframe.src = getPreviewUrl();
  iframeReady = false;
  document.getElementById('layoutElementInfo').textContent = '🔄 Recarregando preview...';
  setTimeout(() => {
    refreshIframeConnection();
  }, 1500);
}

/* === COLOR SYSTEM === */

let currentColorProperty = COLOR_MAP[0].key;

function initColorSelector() {
  const select = document.getElementById('colorPropSelect');
  if (!select) return;
  select.innerHTML = COLOR_MAP.map(c =>
    `<option value="${c.key}">${c.label}</option>`
  ).join('');
  select.onchange = function() {
    currentColorProperty = this.value;
    populateColorSwatches(this.value);
  };
}

function populateColorSwatches(propKey) {
  const container = document.getElementById('colorSwatches');
  if (!container) return;
  const colorInfo = COLOR_MAP.find(c => c.key === propKey);
  const currentVal = colorInfo ? colorInfo.default : '#A855F7';

  container.innerHTML = PALETTE_COLORS.map(c =>
    `<div class="color-swatch${c.toLowerCase() === currentVal.toLowerCase() ? ' active' : ''}"
          style="background:${c}"
          onclick="pickColor('${propKey}','${c}')"
          title="${c}"></div>`
  ).join('');
}

function pickColor(propKey, color) {
  const cssName = propKey;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
  event.target.classList.add('active');
  applyStyle(cssName, color);
  toast(`Cor alterada: ${color}`, 'success');
}

function updateColorSwatches() {
  const select = document.getElementById('colorPropSelect');
  if (select) populateColorSwatches(select.value);
}

function initBgColorSwatches() {
  const container = document.getElementById('bgColorSwatches');
  if (!container) return;
  container.innerHTML = BG_COLORS.map(c =>
    `<div class="color-swatch" style="background:${c}"
          onclick="pickBgColor('${c}')" title="${c}"></div>`
  ).join('');
}

function pickBgColor(color) {
  document.querySelectorAll('#bgColorSwatches .color-swatch').forEach(s => s.classList.remove('active'));
  event.target.classList.add('active');
  applyBackgroundVars({ '--body-bg-color': color });
}

function applyBackgroundVars(vars) {
  pendingChanges['__background_vars__'] = Object.assign({}, pendingChanges['__background_vars__'], vars);
  sendToIframe({ type: 'editor-apply-background', payload: { action: 'apply', vars: vars } });
}

function resetBackgroundVars() {
  delete pendingChanges['__background_vars__'];
  sendToIframe({ type: 'editor-apply-background', payload: { action: 'reset' } });
}

function applyImageVars() {
  const img = document.getElementById('bgImageUrl').value.trim();
  if (!img) return;
  applyBackgroundVars({
    '--body-bg-image': `url('${img}')`,
    '--body-bg-size': 'cover',
    '--body-bg-position': 'center center',
    '--body-bg-repeat': 'no-repeat',
    '--body-bg-attachment': 'fixed',
  });
}

function applyBgImage() {
  applyImageVars();
  toast('Imagem de fundo aplicada!');
}

async function handleBgUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  const fromAparencia = event.target.id === 'apBgImageUpload';

  if (file.size > 1024 * 1024 * 4) {
    toast('Imagem muito grande (máx. 4 MB).', 'error');
    return;
  }

  toast('Enviando imagem de fundo...', 'success');

  try {
    const compressed = await compressImage(file, 1920, 0.82);
    const b64 = await fileToBase64(compressed);
    const ext = compressed._ext || 'jpg';
    const name = `bg-${Date.now()}.${ext}`;
    const path = `public/images/backgrounds/${name}`;
    const existing = await getFile(path).catch(() => null);
    await putFileRaw(path, b64, 'cms: upload background image', existing ? existing.sha : null);

    const url = `/images/backgrounds/${name}`;
    if (fromAparencia) {
      const urlInput = document.getElementById('apBgImageUrl');
      if (urlInput) urlInput.value = url;
      const mode = document.getElementById('apBgMode');
      if (mode) mode.value = 'image';
      if (typeof onAparenciaModeChange === 'function') onAparenciaModeChange();
      if (typeof apResolveBackgroundVars === 'function') {
        applyBackgroundVars(apResolveBackgroundVars());
      }
    } else {
      const urlInput = document.getElementById('bgImageUrl');
      if (urlInput) urlInput.value = url;
      applyImageVars();
    }
    toast('Imagem de fundo enviada ao repositório!');
  } catch (e) {
    toast('Erro ao enviar imagem de fundo: ' + e.message, 'error');
  }
}

function resetBgImage() {
  if (document.getElementById('bgImageUrl')) document.getElementById('bgImageUrl').value = '';
  if (document.getElementById('apBgImageUrl')) document.getElementById('apBgImageUrl').value = '';
  resetBackgroundVars();
  toast('Fundo restaurado');
}

/* === LOGO === */

function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    applyStyle('logo-src', dataUrl);
    pendingLogoFile = file;
    toast('Logo carregada! Clique em "Salvar Tema" para publicar.');
  };
  reader.readAsDataURL(file);
}

async function saveLogoToRepo(file) {
  if (typeof token === 'undefined' || !token) {
    toast('Faça login no GitHub para salvar a logo permanentemente.', 'error');
    return false;
  }
  try {
    const compressed = await compressImage(file, 400, 0.85, 'webp');
    const b64 = await fileToBase64(compressed);
    const path = 'public/images/logo-blog.webp';
    const existing = await getFile(path);
    await putFileRaw(path, b64, 'cms: update logo', existing ? existing.sha : null);
    toast('Logo salva no repositório como logo-blog.webp!');
    return true;
  } catch (e) {
    toast('Erro ao salvar logo: ' + e.message, 'error');
    return false;
  }
}

function resetLogo() {
  const base = getBlogBase();
  pendingLogoFile = null;
  delete pendingChanges['logo-src'];
  applyStyle('logo-src', window.location.origin + base + 'images/logo-blog.webp');
  toast('Logo original restaurada');
}

/* === SYNC SLIDERS === */

function applyCssValuesToUI(values) {
  const sliderMap = {
    'nav-height': 'nav-height',
    'logo-height': 'logo-height',
    'logo-offset': 'logo-offset',
    'content-top': 'content-top',
    'main-cols': 'main-cols',
    'sidebar-cols': 'sidebar-cols',
    'font-size-h1': 'font-size-h1',
    'font-size-h2': 'font-size-h2',
    'font-size-h3': 'font-size-h3',
    'font-size-body': 'font-size-body',
    'font-size-label': 'font-size-label',
  };
  for (const [prop, value] of Object.entries(values)) {
    const sliderProp = sliderMap[prop];
    if (!sliderProp) continue;
    const input = document.querySelector(`input[data-prop="${sliderProp}"]`);
    if (!input) continue;
    const numVal = parseInt(value);
    if (isNaN(numVal)) continue;
    input.value = numVal;
    input.nextElementSibling.textContent = value;
  }

  if (values['body-bg-color']) {
    const bgColor = values['body-bg-color'];
    document.querySelectorAll('#bgColorSwatches .color-swatch').forEach(s => {
      const swatchColor = rgbToHex(s.style.backgroundColor);
      const targetColor = rgbToHex(bgColor);
      if (swatchColor && targetColor && swatchColor.toLowerCase() === targetColor.toLowerCase()) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });
  }
}

function syncSlidersFromIframe() {
  sendToIframe({ type: 'editor-get-state' });
}

function rgbToHex(rgb) {
  if (!rgb) return rgb;
  if (rgb.startsWith('#')) return rgb;
  const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb;
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

/* === SAVE THEME === */

async function layoutSaveTheme() {
  if (typeof token === 'undefined' || !token) {
    toast('Faça login no GitHub para salvar o tema.', 'error');
    return;
  }

  const css = generateThemeCSS();
  let savedSomething = false;

  toast('Salvando...', 'success');
  setLoading('btnSaveTheme', true);

  if (css) {
    try {
      const existingCSS = await getFile('src/styles/global.css');
      if (existingCSS) {
        const newContent = injectThemeVars(existingCSS.content, css);
        if (newContent) {
          await putFile('src/styles/global.css', newContent, 'cms: update visual theme', existingCSS.sha);
          savedSomething = true;
        }
      }
    } catch (e) {
      toast('Erro ao salvar o tema: ' + e.message, 'error');
    }
  }

  if (pendingLogoFile) {
    try {
      const ok = await saveLogoToRepo(pendingLogoFile);
      if (ok) {
        pendingLogoFile = null;
        delete pendingChanges['logo-src'];
        savedSomething = true;
      }
    } catch (e) {
      toast('Erro ao salvar a logo: ' + e.message, 'error');
    }
  }

  if (savedSomething) {
    fetch(`${GH_API}/repos/${REPO}/actions/workflows/deploy.yml/dispatches`, {
      method: 'POST',
      headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main' }),
    }).catch(() => {});

    toast('Alterações salvas! Deploy em andamento 🚀', 'success');
  } else {
    toast('Nenhuma alteração para salvar.', 'error');
  }

  setLoading('btnSaveTheme', false);
}

function generateThemeCSS() {
  const vars = [];
  const sliderMap = {
    'nav-height': 'nav-height',
    'logo-height': 'logo-height',
    'logo-offset': 'logo-offset',
    'content-top': 'content-top',
    'main-cols': 'main-cols',
    'sidebar-cols': 'sidebar-cols',
    'font-size-h1': 'font-size-h1',
    'font-size-h2': 'font-size-h2',
    'font-size-h3': 'font-size-h3',
    'font-size-body': 'font-size-body',
    'font-size-label': 'font-size-label',
  };

  for (const [prop, cssProp] of Object.entries(sliderMap)) {
    if (pendingChanges[cssProp]) {
      vars.push(`  --${cssProp}: ${pendingChanges[cssProp]};`);
    }
  }

  for (const color of COLOR_MAP) {
    if (pendingChanges[color.key]) {
      vars.push(`  --${color.key}: ${pendingChanges[color.key]};`);
    }
  }

  const bgVars = pendingChanges['__background_vars__'] || {};
  for (const [cssKey, cssVal] of Object.entries(bgVars)) {
    if (cssKey.startsWith('--')) {
      vars.push(`  ${cssKey}: ${cssVal};`);
    }
  }

  if (vars.length === 0) {
    return null;
  }

  const body = vars.join('\n');
  const lightBody = vars
    .filter((v) => !/--body-bg-(color|image|size|position|repeat|attachment)/.test(v))
    .join('\n');

  let out = `/* Theme overrides generated by Layout Editor */
:root {
${body}
}
`;

  if (lightBody.trim()) {
    out += `
:root[data-theme="light"] {
${lightBody}
}`;
  }

  return out.trim();
}

function injectThemeVars(originalContent, themeCSS) {
  if (!themeCSS) return originalContent;
  if (!originalContent || !originalContent.includes('@tailwind')) {
    toast('Erro de segurança: o global.css está vazio ou inválido. Nada foi salvo para proteger o site.', 'error');
    return null;
  }

  const marker = '/* --- EDITOR THEME OVERRIDES --- */';
  const markerRegex = /\/\* --- EDITOR THEME OVERRIDES --- \*\/[\s\S]*?\/\* --- END EDITOR THEME --- \*\//;
  const block = `${marker}\n${themeCSS}\n/* --- END EDITOR THEME --- */\n`;

  let content = originalContent.replace(markerRegex, '').trim();
  if (!content.includes('@tailwind')) {
    toast('Erro de segurança: o conteúdo original do global.css está incompleto. Nada foi salvo.', 'error');
    return null;
  }

  const result = content + '\n\n' + block;

  if (!result.includes('@tailwind') || !result.includes('/* --- END EDITOR THEME --- */')) {
    toast('Erro de segurança: o global.css não pôde ser atualizado. Nada foi salvo.', 'error');
    return null;
  }

  return result;
}

/* === DEPLOY PREVIEW OVERLAY === */

(function() {
  const style = document.createElement('style');
  style.textContent = `
    #layoutTools .card { margin-bottom:0; }
    #layoutTools .card + .card { margin-top:0; }
    #layoutBody { gap:16px; }
    #layoutPreview { position:relative; overflow:hidden; }
    #layoutIframe { background:#050505; border:none; transform-origin:top left; }
    .color-swatch { position:relative; }
    .color-swatch:hover::after {
      content:attr(title);
      position:absolute; bottom:100%; left:50%; transform:translateX(-50%);
      background:#000; color:#fff; padding:2px 6px; border-radius:4px;
      font-size:10px; white-space:nowrap; z-index:10;
      pointer-events:none;
    }
  `;
  document.head.appendChild(style);
})();
