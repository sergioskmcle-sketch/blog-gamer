import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import readline from 'readline';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SQUAD_DIR = path.join(PROJECT_ROOT, 'squads', 'marketing', 'conteudo-digital', 'blog-gamer');
const STATE_PATH = path.join(SQUAD_DIR, 'state.json');
const TMP_PATH = path.join(SQUAD_DIR, 'state.json.tmp');

const STEPS = [
  { id: 'pesquisadora', trigger: /INICIANDO GERACAO|Buscando topicos trending/, end: /Gerando artigo com LLM|Geracao SEGMENTADA/ },
  { id: 'redator', trigger: /Gerando artigo com LLM|Geracao SEGMENTADA|Corpo segmentado montado|Blurb ok/, end: /Validacoes OK|Validando links internos/ },
  { id: 'otimizador-seo', trigger: /Validacoes OK|Validando links internos|Links internos validados/, end: /Buscando imagens de jogos via RAWG|Gerando capa IA contextual|Baixando imagens dos/ },
  { id: 'designer', trigger: /Buscando imagens de jogos via RAWG|Gerando capa IA contextual|Baixando imagens dos|Injetando produtos do Mercado Livre/, end: /Corpo segmentado reprovado|produtos injetados no corpo|Ressalvas de qualidade/ },
  { id: 'revisora', trigger: /Corpo segmentado reprovado|produtos injetados no corpo|Ressalvas de qualidade|Publicando com ressalvas/, end: /Artigo salvo:/ },
  { id: 'publicadora', trigger: /Artigo salvo:|Estado atualizado|status.json gerado|CONCLUIDO/, end: /=== CONCLUIDO ===/ },
];

let state = null;
let currentIdx = -1;
let lastMessage = '';

function writeState() {
  fs.writeFileSync(TMP_PATH, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(TMP_PATH, STATE_PATH);
}

function resetAll() {
  const agents = state.agents.map(a => ({ ...a, status: 'idle', deliverTo: null, message: null }));
  state = { ...state, agents, status: 'idle', handoff: null };
}

function activate(idx) {
  const agent = state.agents[idx];
  const step = STEPS[idx];
  if (currentIdx !== -1 && currentIdx !== idx) {
    const prev = state.agents[currentIdx];
    prev.status = 'done';
    prev.deliverTo = step.id;
    state.handoff = { from: prev.id, to: step.id, message: `Entregou para ${agent.name}`, completedAt: new Date().toISOString() };
    currentIdx = -1;
  }
  agent.status = 'working';
  agent.message = 'Trabalhando...';
  state.step = { ...state.step, current: idx + 1, label: step.label || agent.stepLabel };
  state.status = 'running';
  currentIdx = idx;
  writeState();
}

function setMessage(msg) {
  if (currentIdx !== -1) {
    state.agents[currentIdx].message = msg;
    writeState();
  }
}

function complete() {
  if (currentIdx !== -1) {
    state.agents[currentIdx].status = 'done';
    state.agents[currentIdx].deliverTo = null;
  }
  state.step = { ...state.step, current: state.step.total, label: 'Concluido' };
  state.status = 'completed';
  state.handoff = null;
  currentIdx = -1;
  writeState();
}

function fail(msg) {
  if (currentIdx !== -1) {
    state.agents[currentIdx].status = 'failed';
    state.agents[currentIdx].message = msg;
  }
  state.status = 'failed';
  writeState();
}

function dispatch(raw) {
  const match = raw.match(/^\[([^\]]+)\] \[([A-Z]+)\]\s?(.*)$/);
  if (!match) return;
  const level = match[2];
  const msg = match[3];
  lastMessage = msg.slice(0, 60);

  if (level === 'ERROR') {
    fail(msg.slice(0, 80));
    return;
  }

  const stepIdx = STEPS.findIndex(s => s.trigger.test(msg));
  if (stepIdx !== -1 && currentIdx < stepIdx) {
    activate(stepIdx);
    return;
  }
  if (currentIdx !== -1) {
    state.agents[currentIdx].message = msg.slice(0, 60);
    writeState();
  }
}

const raw = fs.readFileSync(path.join(SQUAD_DIR, 'squad.yaml'), 'utf-8');
const doc = yaml.load(raw);
const squad = doc.squad;

const cols = Math.ceil(Math.sqrt(squad.agents.length));
const agents = squad.agents.map((agentConfig, index) => {
  const col = (index % cols) + 1;
  const row = Math.floor(index / cols) + 1;
  const stepIdx = squad.pipeline.steps.findIndex(s => s.agent === agentConfig.id);
  const step = stepIdx !== -1 ? squad.pipeline.steps[stepIdx] : null;
  return {
    id: agentConfig.id,
    name: agentConfig.name,
    icon: agentConfig.icon,
    status: 'idle',
    stepIndex: stepIdx + 1,
    stepLabel: step?.label ?? '',
    deliverTo: null,
    desk: { col, row },
    message: null,
  };
});

state = {
  squad: squad.code,
  status: 'idle',
  step: { current: 0, total: squad.pipeline.steps.length, label: '' },
  agents,
  handoff: null,
  startedAt: null,
  updatedAt: new Date().toISOString(),
};
resetAll();
writeState();

process.env.FORCE_GENERATE = 'true';
process.env.AFFILIATE_MODE = 'remote';

console.log(`[espelho] squad ${squad.code} pronto — ${agents.length} agentes, ${state.step.total} etapas`);
console.log(`[espelho] rodando: FORCE_GENERATE=true AFFILIATE_MODE=remote node scripts/gerar-artigo.mjs`);

const child = spawn(process.execPath, [path.join('scripts', 'gerar-artigo.mjs')], {
  cwd: PROJECT_ROOT,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
});
child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
});

const rl = readline.createInterface({ input: child.stdout });
rl.on('line', (line) => {
  dispatch(line.trim());
});

let done = false;
function finish(code) {
  if (done) return;
  done = true;
  if (code === 0 && state.status === 'running') {
    complete();
  }
  console.log(`[espelho] processo terminou (exit ${code}) — squad status: ${state.status}`);
}

child.on('exit', finish);
child.on('error', (err) => {
  console.error('[espelho] falha ao spawnar:', err.message);
  fail(err.message.slice(0, 80));
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});
