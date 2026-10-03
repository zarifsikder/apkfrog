import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { publish } from '@/lib/events'
import { defaultFilesFor } from '@/lib/projectTemplates'

/**
 * AI Assistant Tools — these are the actions the AI can perform on behalf
 * of the signed-in user. Every tool here runs with the *same* user identity
 * as the human user (it reads the session cookie via getUser(req)), so the
 * AI never has more access than the user — that is by design.
 *
 * Each tool returns a JSON-serializable result that gets fed back to the LLM
 * so it can reason about what happened and decide the next step.
 *
 * Tools also return optional `ui` actions (navigate, toast, openEditor) that
 * the frontend AssistantChat widget applies to make the user actually *see*
 * what the AI did (jump to the editor, refresh projects list, etc.).
 */

export type UiAction =
  | { type: 'navigate'; view: string }
  | { type: 'open_editor'; project: { id: string; name: string; type: string } }
  | { type: 'toast'; message: string }
  | { type: 'refresh_projects' }
  | { type: 'refresh_builds' }
  | { type: 'open_build'; source: { type: 'html' | 'kotlin'; projectId?: string } }

export interface ToolResult {
  ok: boolean
  /** short status string for the chat log, e.g. "Created project 'Calculator'" */
  summary: string
  /** full JSON payload returned to the LLM as the tool result */
  data?: unknown
  /** optional UI commands the frontend should apply */
  ui?: UiAction[]
  /** optional error message when ok=false */
  error?: string
}

export interface ToolDef {
  name: string
  description: string
  /** terse JSON-schema-ish argument description the LLM uses to call */
  parameters: Record<string, { type: string; description: string; required?: boolean; enum?: string[] }>
  /** executor — receives parsed args, the request (for auth), and runs server-side */
  run: (args: Record<string, unknown>, req: NextRequest) => Promise<ToolResult>
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function detectLanguage(p: string): string {
  const ext = p.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'kt': case 'kts': return 'kotlin'
    case 'xml': return 'xml'
    case 'html': return 'html'
    case 'css': return 'css'
    case 'js': return 'javascript'
    case 'json': return 'json'
    case 'java': return 'java'
    default: return 'plaintext'
  }
}

function cleanPath(p: string): string {
  return p.replace(/^\/+/, '').slice(0, 200)
}

async function getUserOrThrow(req: NextRequest) {
  const user = await getUser(req)
  if (!user) throw new Error('Authentication required — please log in.')
  return user
}

/* ------------------------------------------------------------------ */
/* pre-built "recipes" — one-shot app generators                       */
/* ------------------------------------------------------------------ */

interface RecipeFile { path: string; content: string }
interface Recipe {
  name: string
  description: string
  buildFiles: (appName: string) => RecipeFile[]
}

const CALCULATOR_RECIPE: Recipe = {
  name: 'calculator',
  description: 'A clean, mobile-friendly calculator app (HTML/CSS/JS) with basic arithmetic, clear button, and a result history strip.',
  buildFiles: (appName) => [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${appName}</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="calc">
    <div class="history" id="history"></div>
    <div class="display" id="display">0</div>
    <div class="keys">
      <button class="key ac" data-act="clear">AC</button>
      <button class="key op" data-act="sign">+/-</button>
      <button class="key op" data-act="percent">%</button>
      <button class="key op accent" data-op="/">÷</button>

      <button class="key" data-num="7">7</button>
      <button class="key" data-num="8">8</button>
      <button class="key" data-num="9">9</button>
      <button class="key op accent" data-op="*">×</button>

      <button class="key" data-num="4">4</button>
      <button class="key" data-num="5">5</button>
      <button class="key" data-num="6">6</button>
      <button class="key op accent" data-op="-">−</button>

      <button class="key" data-num="1">1</button>
      <button class="key" data-num="2">2</button>
      <button class="key" data-num="3">3</button>
      <button class="key op accent" data-op="+">+</button>

      <button class="key zero" data-num="0">0</button>
      <button class="key" data-num=".">.</button>
      <button class="key op accent eq" data-act="equals">=</button>
    </div>
    <p class="foot">${appName} · built with ApkForge AI</p>
  </div>
  <script src="script.js"></script>
</body>
</html>
`,
    },
    {
      path: 'style.css',
      content: `* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  background: linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #312e81 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  user-select: none;
}
.calc {
  width: 100%;
  max-width: 380px;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 28px;
  padding: 22px 18px 18px;
  box-shadow: 0 30px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
}
.history {
  min-height: 22px;
  text-align: right;
  color: rgba(255,255,255,0.4);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  padding: 4px 10px;
  letter-spacing: 0.5px;
  word-wrap: break-word;
  white-space: pre-wrap;
}
.display {
  text-align: right;
  font-size: 52px;
  font-weight: 300;
  padding: 14px 12px 22px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -1px;
  word-break: break-all;
  min-height: 86px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}
.keys {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.key {
  border: none;
  border-radius: 18px;
  height: 64px;
  font-size: 22px;
  font-weight: 500;
  color: #fff;
  background: rgba(255,255,255,0.08);
  cursor: pointer;
  transition: transform 0.06s ease, background 0.15s ease, filter 0.15s ease;
}
.key:active { transform: scale(0.94); background: rgba(255,255,255,0.16); }
.key.zero { grid-column: span 1; }
.key.op { background: rgba(255,255,255,0.14); color: #cbd5e1; }
.key.accent { background: linear-gradient(135deg, #f59e0b, #f97316); color: #fff; }
.key.accent:active { filter: brightness(1.1); }
.key.eq { background: linear-gradient(135deg, #10b981, #059669); }
.key.ac { color: #fca5a5; }
.foot { text-align: center; font-size: 10px; color: rgba(255,255,255,0.25); margin-top: 14px; letter-spacing: 1px; text-transform: uppercase; }
@media (max-width: 360px) {
  .display { font-size: 42px; min-height: 70px; }
  .key { height: 56px; font-size: 20px; }
}
`,
    },
    {
      path: 'script.js',
      content: (() => {
        // Inline IIFE so the recipe source stays readable.
        const code = `(function () {
  const display = document.getElementById('display');
  const history = document.getElementById('history');
  let current = '0';
  let prev = null;
  let op = null;
  let justEvaluated = false;
  let historyText = '';

  function render() {
    // Strip trailing operator dot for cleanliness, show as-is otherwise.
    let s = current;
    // Limit display width
    if (s.replace('-', '').replace('.', '').length > 12) {
      s = parseFloat(s).toExponential(6);
    }
    display.textContent = s;
    history.textContent = historyText;
  }

  function inputNum(n) {
    if (justEvaluated) { current = '0'; justEvaluated = false; }
    if (n === '.') {
      if (current.includes('.')) return;
      if (current === '' || current === '-') current = '0';
      current += '.';
      render();
      return;
    }
    if (current === '0') current = n;
    else current += n;
    render();
  }

  function pickOp(nextOp) {
    if (op && !justEvaluated) evaluate();
    if (current === '' || current === '-') return;
    prev = parseFloat(current);
    op = nextOp;
    current = '0';
    historyText = prev + ' ' + pretty(op);
    justEvaluated = false;
    render();
  }

  function pretty(o) {
    return { '+': '+', '-': '−', '*': '×', '/': '÷' }[o] || o;
  }

  function evaluate() {
    if (op === null || prev === null) return;
    const cur = parseFloat(current);
    let result = 0;
    switch (op) {
      case '+': result = prev + cur; break;
      case '-': result = prev - cur; break;
      case '*': result = prev * cur; break;
      case '/': result = cur === 0 ? NaN : prev / cur; break;
    }
    historyText = prev + ' ' + pretty(op) + ' ' + cur + ' =';
    current = isNaN(result) ? 'Error' : String(round(result));
    op = null;
    prev = null;
    justEvaluated = true;
    render();
  }

  function round(n) {
    if (!isFinite(n)) return n;
    return Math.round((n + Number.EPSILON) * 1e10) / 1e10;
  }

  function clearAll() {
    current = '0';
    prev = null;
    op = null;
    historyText = '';
    justEvaluated = false;
    render();
  }

  function toggleSign() {
    if (current === '0' || current === 'Error') return;
    current = current.startsWith('-') ? current.slice(1) : '-' + current;
    render();
  }

  function percent() {
    const v = parseFloat(current);
    if (isNaN(v)) return;
    current = String(round(v / 100));
    render();
  }

  document.querySelectorAll('[data-num]').forEach((el) => {
    el.addEventListener('click', () => inputNum(el.dataset.num));
  });
  document.querySelectorAll('[data-op]').forEach((el) => {
    el.addEventListener('click', () => pickOp(el.dataset.op));
  });
  document.querySelector('[data-act="clear"]').addEventListener('click', clearAll);
  document.querySelector('[data-act="sign"]').addEventListener('click', toggleSign);
  document.querySelector('[data-act="percent"]').addEventListener('click', percent);
  document.querySelector('[data-act="equals"]').addEventListener('click', evaluate);

  // Keyboard support for desktop testing
  document.addEventListener('keydown', (e) => {
    const k = e.key;
    if (/[0-9]/.test(k)) inputNum(k);
    else if (k === '.') inputNum('.');
    else if (k === '+' || k === '-' || k === '*' || k === '/') pickOp(k);
    else if (k === 'Enter' || k === '=') evaluate();
    else if (k === 'Escape') clearAll();
    else if (k === 'Backspace') {
      if (justEvaluated) return;
      current = current.length > 1 ? current.slice(0, -1) : '0';
      render();
    }
  });

  render();
})();`
        return code
      })(),
    },
  ],
}

const TODO_RECIPE: Recipe = {
  name: 'todo',
  description: 'A simple to-do list app (HTML/CSS/JS) with add, complete, delete, and localStorage persistence.',
  buildFiles: (appName) => [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${appName}</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="app">
    <header>
      <h1>✓ ${appName}</h1>
      <p class="sub">Tap a task to mark it done. Saved on your device.</p>
    </header>
    <form id="form" class="add">
      <input id="input" type="text" placeholder="Add a task..." autocomplete="off" maxlength="120" />
      <button type="submit">Add</button>
    </form>
    <ul id="list" class="list"></ul>
    <footer id="footer" class="foot"></footer>
  </div>
  <script src="script.js"></script>
</body>
</html>
`,
    },
    {
      path: 'style.css',
      content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  background: linear-gradient(160deg, #ecfeff 0%, #f5f3ff 50%, #fff1f2 100%);
  min-height: 100vh;
  color: #0f172a;
  padding: 24px 16px 60px;
}
.app { max-width: 520px; margin: 0 auto; }
header { text-align: center; margin-bottom: 20px; }
header h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
.sub { color: #64748b; font-size: 13px; margin-top: 4px; }
.add { display: flex; gap: 8px; margin-bottom: 16px; }
.add input {
  flex: 1;
  padding: 14px 16px;
  font-size: 15px;
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 14px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.add input:focus { border-color: #818cf8; box-shadow: 0 0 0 4px rgba(129,140,248,0.18); }
.add button {
  padding: 0 22px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  border: none;
  border-radius: 14px;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  transition: transform 0.06s ease, filter 0.15s ease;
}
.add button:active { transform: scale(0.95); }
.list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.list li {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  transition: transform 0.08s ease, opacity 0.2s ease;
  animation: pop 0.18s ease;
}
@keyframes pop { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.list li.done { opacity: 0.55; }
.list li.done .text { text-decoration: line-through; color: #94a3b8; }
.list li .check {
  width: 24px; height: 24px; flex: 0 0 24px;
  border: 2px solid #cbd5e1; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}
.list li.done .check { background: #22c55e; border-color: #22c55e; color: #fff; }
.list li .check::after { content: "✓"; font-weight: 800; font-size: 14px; opacity: 0; transition: opacity 0.15s ease; }
.list li.done .check::after { opacity: 1; }
.list li .text { flex: 1; font-size: 15px; line-height: 1.4; }
.list li .del {
  background: transparent; border: none; cursor: pointer;
  color: #ef4444; font-size: 18px; padding: 4px 8px;
  border-radius: 8px; transition: background 0.15s ease;
}
.list li .del:hover { background: #fee2e2; }
.foot { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 18px; }
`,
    },
    {
      path: 'script.js',
      content: `(function () {
  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const list = document.getElementById('list');
  const footer = document.getElementById('footer');
  const KEY = 'apkforge_todo_v1';
  let tasks = [];
  try { tasks = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { tasks = []; }

  function save() { localStorage.setItem(KEY, JSON.stringify(tasks)); }

  function render() {
    list.innerHTML = '';
    if (tasks.length === 0) {
      const empty = document.createElement('li');
      empty.style.opacity = '0.7';
      empty.innerHTML = '<span class="text">No tasks yet. Add one above. ☝️</span>';
      list.appendChild(empty);
    } else {
      tasks.forEach((t, i) => {
        const li = document.createElement('li');
        if (t.done) li.classList.add('done');
        const check = document.createElement('div');
        check.className = 'check';
        check.addEventListener('click', () => { tasks[i].done = !tasks[i].done; save(); render(); });
        const text = document.createElement('span');
        text.className = 'text';
        text.textContent = t.text;
        const del = document.createElement('button');
        del.className = 'del';
        del.textContent = '✕';
        del.title = 'Delete';
        del.addEventListener('click', () => { tasks.splice(i, 1); save(); render(); });
        li.appendChild(check);
        li.appendChild(text);
        li.appendChild(del);
        list.appendChild(li);
      });
    }
    const done = tasks.filter((t) => t.done).length;
    footer.textContent = tasks.length + ' tasks · ' + done + ' done';
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    tasks.unshift({ text, done: false, created: Date.now() });
    input.value = '';
    save();
    render();
  });

  render();
})();`,
    },
  ],
}

const NOTES_RECIPE: Recipe = {
  name: 'notes',
  description: 'A simple notes app (HTML/CSS/JS) with create, edit, and localStorage persistence.',
  buildFiles: (appName) => [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${appName}</title>
<link rel="stylesheet" href="style.css" />
</head><body>
  <main class="wrap">
    <header><h1>📝 ${appName}</h1><button id="new" class="new">+ New</button></header>
    <div id="grid" class="grid"></div>
  </main>
  <div id="modal" class="modal hidden">
    <div class="card">
      <input id="title" type="text" placeholder="Title" maxlength="60" />
      <textarea id="body" placeholder="Write something..." rows="8"></textarea>
      <div class="actions">
        <button id="cancel">Cancel</button>
        <button id="save" class="primary">Save</button>
      </div>
    </div>
  </div>
  <script src="script.js"></script>
</body></html>
`,
    },
    {
      path: 'style.css',
      content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; background: #fef9c3; min-height: 100vh; color: #1f2937; padding: 18px; }
.wrap { max-width: 720px; margin: 0 auto; }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
header h1 { font-size: 26px; font-weight: 800; }
.new { background: #1f2937; color: #fff; border: none; padding: 10px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.note { background: #fff; padding: 14px; border-radius: 14px; box-shadow: 0 6px 18px -10px rgba(0,0,0,0.2); position: relative; cursor: pointer; transition: transform 0.1s; }
.note:hover { transform: translateY(-2px); }
.note h3 { font-size: 15px; margin-bottom: 6px; }
.note p { font-size: 13px; color: #4b5563; line-height: 1.4; max-height: 70px; overflow: hidden; }
.note .del { position: absolute; top: 8px; right: 8px; background: transparent; border: none; cursor: pointer; color: #ef4444; font-size: 14px; opacity: 0; transition: opacity 0.15s; }
.note:hover .del { opacity: 1; }
.modal { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 16px; }
.modal.hidden { display: none; }
.card { background: #fff; border-radius: 16px; padding: 18px; width: 100%; max-width: 480px; }
.card input, .card textarea { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; font-size: 14px; margin-bottom: 10px; outline: none; font-family: inherit; }
.card input:focus, .card textarea:focus { border-color: #6366f1; }
.actions { display: flex; gap: 8px; justify-content: flex-end; }
.actions button { padding: 8px 16px; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; background: #f3f4f6; }
.actions .primary { background: #4f46e5; color: #fff; }
`,
    },
    {
      path: 'script.js',
      content: `(function () {
  const KEY = 'apkforge_notes_v1';
  let notes = [];
  try { notes = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { notes = []; }
  let editingId = null;
  const grid = document.getElementById('grid');
  const modal = document.getElementById('modal');
  const titleEl = document.getElementById('title');
  const bodyEl = document.getElementById('body');

  function save() { localStorage.setItem(KEY, JSON.stringify(notes)); }
  function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

  function render() {
    grid.innerHTML = '';
    if (notes.length === 0) {
      grid.innerHTML = '<p style="color:#6b7280;text-align:center;padding:30px;">No notes yet. Click "+ New" to start.</p>';
      return;
    }
    notes.forEach((n) => {
      const div = document.createElement('div');
      div.className = 'note';
      div.innerHTML = '<h3>' + escapeHtml(n.title || 'Untitled') + '</h3><p>' + escapeHtml(n.body || '') + '</p><button class="del" title="Delete">✕</button>';
      div.addEventListener('click', (e) => {
        if (e.target.classList.contains('del')) { notes = notes.filter((x) => x.id !== n.id); save(); render(); return; }
        editingId = n.id; titleEl.value = n.title; bodyEl.value = n.body; modal.classList.remove('hidden'); titleEl.focus();
      });
      grid.appendChild(div);
    });
  }

  document.getElementById('new').addEventListener('click', () => {
    editingId = null; titleEl.value = ''; bodyEl.value = ''; modal.classList.remove('hidden'); titleEl.focus();
  });
  document.getElementById('cancel').addEventListener('click', () => modal.classList.add('hidden'));
  document.getElementById('save').addEventListener('click', () => {
    const title = titleEl.value.trim(); const body = bodyEl.value.trim();
    if (!title && !body) { modal.classList.add('hidden'); return; }
    if (editingId) { const n = notes.find((x) => x.id === editingId); if (n) { n.title = title; n.body = body; } }
    else { notes.unshift({ id: Date.now(), title, body, created: Date.now() }); }
    save(); render(); modal.classList.add('hidden');
  });
  render();
})();`,
    },
  ],
}

const WEATHER_UI_RECIPE: Recipe = {
  name: 'weather_ui',
  description: 'A weather UI mockup app (HTML/CSS/JS) showing a 5-day forecast with sample data — no API key required.',
  buildFiles: (appName) => [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${appName}</title>
<link rel="stylesheet" href="style.css" />
</head><body>
  <div class="card">
    <div class="top">
      <div>
        <h1>Dhaka</h1>
        <p class="now">Mostly Sunny · 31°</p>
      </div>
      <div class="icon">☀️</div>
    </div>
    <div class="forecast" id="forecast"></div>
  </div>
  <script src="script.js"></script>
</body></html>
`,
    },
    {
      path: 'style.css',
      content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, system-ui, sans-serif; background: linear-gradient(160deg, #38bdf8, #6366f1); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; color: #fff; }
.card { background: rgba(255,255,255,0.12); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.18); border-radius: 28px; padding: 24px; width: 100%; max-width: 380px; }
.top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
h1 { font-size: 28px; font-weight: 800; }
.now { font-size: 16px; opacity: 0.85; margin-top: 2px; }
.icon { font-size: 56px; }
.forecast { display: flex; flex-direction: column; gap: 8px; }
.day { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: rgba(255,255,255,0.08); border-radius: 14px; }
.day .name { font-weight: 600; }
.day .ic { font-size: 22px; }
.day .t { font-variant-numeric: tabular-nums; font-weight: 700; }
`,
    },
    {
      path: 'script.js',
      content: `(function () {
  const sample = [
    { day: 'Mon', ic: '⛅', lo: 25, hi: 32 },
    { day: 'Tue', ic: '🌧️', lo: 22, hi: 27 },
    { day: 'Wed', ic: '⛈️', lo: 21, hi: 25 },
    { day: 'Thu', ic: '🌤️', lo: 24, hi: 30 },
    { day: 'Fri', ic: '☀️', lo: 26, hi: 33 },
  ];
  const f = document.getElementById('forecast');
  sample.forEach((d) => {
    const el = document.createElement('div');
    el.className = 'day';
    el.innerHTML = '<span class="name">' + d.day + '</span><span class="ic">' + d.ic + '</span><span class="t">' + d.lo + '° / ' + d.hi + '°</span>';
    f.appendChild(el);
  });
})();`,
    },
  ],
}

const RECIPES: Record<string, Recipe> = {
  calculator: CALCULATOR_RECIPE,
  todo: TODO_RECIPE,
  notes: NOTES_RECIPE,
  weather_ui: WEATHER_UI_RECIPE,
}

/* ------------------------------------------------------------------ */
/* the tools                                                           */
/* ------------------------------------------------------------------ */

export const TOOLS: ToolDef[] = [
  /* ---------- read-only info tools ---------- */
  {
    name: 'get_account_summary',
    description: 'Get the current user\'s account summary: name, email, plan, wallet balance, role, publicId, and recent stats. Use this first to ground yourself in who you\'re helping.',
    parameters: {},
    run: async (_args, req) => {
      const user = await getUserOrThrow(req)
      const [projects, builds] = await Promise.all([
        db.project.count({ where: { userId: user.id } }),
        db.build.count({ where: { userId: user.id } }),
      ])
      return {
        ok: true,
        summary: 'Loaded account summary',
        data: {
          name: user.name,
          email: user.email,
          plan: user.plan,
          wallet: user.wallet,
          role: user.role,
          publicId: user.publicId,
          createdAt: user.createdAt,
          counts: { projects, builds },
        },
      }
    },
  },
  {
    name: 'list_projects',
    description: 'List all of the current user\'s projects (id, name, type, fileCount, updatedAt). Use this when the user asks about their projects or before doing something with a project.',
    parameters: {},
    run: async (_args, req) => {
      const user = await getUserOrThrow(req)
      const projects = await db.project.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        include: { files: { select: { id: true } } },
      })
      return {
        ok: true,
        summary: `Found ${projects.length} project(s)`,
        data: {
          projects: projects.map((p) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            fileCount: p.files.length,
            updatedAt: p.updatedAt,
          })),
        },
      }
    },
  },
  {
    name: 'list_builds',
    description: 'List the user\'s 20 most recent builds with status, app name, version, and progress. Useful when the user asks about build status.',
    parameters: {},
    run: async (_args, req) => {
      const user = await getUserOrThrow(req)
      const builds = await db.build.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      return {
        ok: true,
        summary: `Loaded ${builds.length} recent build(s)`,
        data: {
          builds: builds.map((b) => ({
            id: b.id,
            appName: b.appName,
            packageName: b.packageName,
            versionName: b.versionName,
            status: b.status,
            progress: b.progress,
            currentStep: b.currentStep,
            apkSize: b.apkSize,
            error: b.error,
            createdAt: b.createdAt,
            completedAt: b.completedAt,
          })),
        },
      }
    },
  },
  {
    name: 'get_build_status',
    description: 'Get the detailed status of a single build, including its latest logs.',
    parameters: { buildId: { type: 'string', description: 'Build ID', required: true } },
    run: async (args, req) => {
      const user = await getUserOrThrow(req)
      const buildId = String(args.buildId || '')
      const b = await db.build.findFirst({ where: { id: buildId, userId: user.id } })
      if (!b) return { ok: false, summary: 'Build not found', error: 'Build not found' }
      return {
        ok: true,
        summary: `Build ${b.status} (${b.appName})`,
        data: {
          id: b.id,
          appName: b.appName,
          packageName: b.packageName,
          versionName: b.versionName,
          versionCode: b.versionCode,
          status: b.status,
          progress: b.progress,
          currentStep: b.currentStep,
          logs: (b.logs || '').slice(-4000),
          apkSize: b.apkSize,
          error: b.error,
          runUrl: b.runUrl,
          startedAt: b.startedAt,
          completedAt: b.completedAt,
        },
        ui: b.status === 'success' ? [{ type: 'open_build', source: { type: b.sourceType === 'kotlin' ? 'kotlin' : 'html' } }] : [],
      }
    },
  },
  {
    name: 'list_templates',
    description: 'List available templates from the store.',
    parameters: {},
    run: async (_args, _req) => {
      const templates = await db.template.findMany({ orderBy: { createdAt: 'desc' }, take: 30 })
      return {
        ok: true,
        summary: `Loaded ${templates.length} templates`,
        data: {
          templates: templates.map((t) => ({
            id: t.id,
            title: t.title,
            category: t.category,
            price: t.price,
            featured: t.featured,
          })),
        },
      }
    },
  },
  {
    name: 'get_project_files',
    description: 'List all files in a project with their content. Use this before editing files so you know what already exists.',
    parameters: {
      projectId: { type: 'string', description: 'Project ID', required: true },
    },
    run: async (args, req) => {
      const user = await getUserOrThrow(req)
      const projectId = String(args.projectId || '')
      const project = await db.project.findFirst({ where: { id: projectId, userId: user.id } })
      if (!project) return { ok: false, summary: 'Project not found', error: 'Project not found' }
      const files = await db.projectFile.findMany({
        where: { projectId },
        orderBy: { path: 'asc' },
        select: { id: true, path: true, content: true, language: true, updatedAt: true },
      })
      return {
        ok: true,
        summary: `Project "${project.name}" has ${files.length} file(s)`,
        data: {
          project: { id: project.id, name: project.name, type: project.type },
          files: files.map((f) => ({ id: f.id, path: f.path, content: f.content, language: f.language })),
        },
      }
    },
  },

  /* ---------- mutation tools ---------- */
  {
    name: 'create_project',
    description: 'Create a new empty project for the user. Valid types: "blank", "html", "webview", "kotlin". Returns the new project with its default starter files. Use create_app_with_recipe instead when the user asks for a known app like a calculator or to-do list — it is much faster.',
    parameters: {
      name: { type: 'string', description: 'Project name (2-40 chars)', required: true },
      type: { type: 'string', description: 'Project type', enum: ['blank', 'html', 'webview', 'kotlin'], required: true },
    },
    run: async (args, req) => {
      const user = await getUserOrThrow(req)
      const name = String(args.name || '').trim()
      const type = String(args.type || 'blank')
      if (name.length < 2) return { ok: false, summary: 'Name too short', error: 'Project name must be at least 2 characters' }
      if (!['blank', 'html', 'webview', 'kotlin'].includes(type)) return { ok: false, summary: 'Invalid type', error: 'Invalid project type' }
      const cleanName = name.slice(0, 40)
      const project = await db.project.create({ data: { name: cleanName, type, userId: user.id } })
      const files = defaultFilesFor(type, cleanName)
      await db.projectFile.createMany({
        data: files.map((f) => ({ path: f.path, content: f.content, language: f.language, projectId: project.id })),
      })
      const full = await db.project.findUnique({ where: { id: project.id }, include: { files: true } })
      publish('projects', { action: 'create', id: project.id }, user.id)
      return {
        ok: true,
        summary: `Created project "${cleanName}" (${type})`,
        data: {
          project: {
            id: full!.id,
            name: full!.name,
            type: full!.type,
            files: full!.files.map((f) => ({ id: f.id, path: f.path, content: f.content, language: f.language })),
          },
        },
        ui: [
          { type: 'toast', message: `Project "${cleanName}" created` },
          { type: 'refresh_projects' },
          { type: 'open_editor', project: { id: full!.id, name: full!.name, type: full!.type } },
        ],
      }
    },
  },
  {
    name: 'create_app_with_recipe',
    description: 'Create a complete pre-built app in one shot. Use this whenever the user asks for an app by name (e.g. "calculator app", "to-do app", "notes app", "weather app"). Available recipes: "calculator", "todo", "notes", "weather_ui". The recipe creates an HTML project with all files filled in.',
    parameters: {
      appName: { type: 'string', description: 'Display name for the new app (e.g. "My Calculator")', required: true },
      recipe: { type: 'string', description: 'Which pre-built recipe to use', enum: ['calculator', 'todo', 'notes', 'weather_ui'], required: true },
    },
    run: async (args, req) => {
      const user = await getUserOrThrow(req)
      const appName = String(args.appName || '').trim()
      const recipeKey = String(args.recipe || '')
      const recipe = RECIPES[recipeKey]
      if (!appName || appName.length < 2) return { ok: false, summary: 'App name required', error: 'App name must be at least 2 characters' }
      if (!recipe) return { ok: false, summary: 'Unknown recipe', error: `Unknown recipe "${recipeKey}". Available: ${Object.keys(RECIPES).join(', ')}` }
      const cleanName = appName.slice(0, 40)
      const project = await db.project.create({ data: { name: cleanName, type: 'html', userId: user.id } })
      const recipeFiles = recipe.buildFiles(cleanName)
      await db.projectFile.createMany({
        data: recipeFiles.map((f) => ({ path: cleanPath(f.path), content: f.content, language: detectLanguage(f.path), projectId: project.id })),
      })
      const full = await db.project.findUnique({ where: { id: project.id }, include: { files: true } })
      publish('projects', { action: 'create', id: project.id }, user.id)
      return {
        ok: true,
        summary: `Built "${cleanName}" using the ${recipe.name} recipe — ${recipeFiles.length} files`,
        data: {
          project: {
            id: full!.id,
            name: full!.name,
            type: full!.type,
            files: full!.files.map((f) => ({ id: f.id, path: f.path })),
          },
          recipe: recipe.name,
          recipeDescription: recipe.description,
        },
        ui: [
          { type: 'toast', message: `🚀 "${cleanName}" ready — open the editor to preview` },
          { type: 'refresh_projects' },
          { type: 'open_editor', project: { id: full!.id, name: full!.name, type: full!.type } },
        ],
      }
    },
  },
  {
    name: 'add_file',
    description: 'Add a new file to an existing project. Fails if a file with that path already exists. Use update_file if the path exists.',
    parameters: {
      projectId: { type: 'string', description: 'Project ID', required: true },
      path: { type: 'string', description: 'File path, e.g. "index.html" or "css/main.css"', required: true },
      content: { type: 'string', description: 'Full file content', required: true },
    },
    run: async (args, req) => {
      const user = await getUserOrThrow(req)
      const projectId = String(args.projectId || '')
      const filePath = cleanPath(String(args.path || ''))
      const content = String(args.content || '')
      const project = await db.project.findFirst({ where: { id: projectId, userId: user.id } })
      if (!project) return { ok: false, summary: 'Project not found', error: 'Project not found' }
      const exists = await db.projectFile.findFirst({ where: { projectId, path: filePath } })
      if (exists) return { ok: false, summary: 'File already exists', error: `File "${filePath}" already exists — use update_file instead` }
      const file = await db.projectFile.create({ data: { path: filePath, content, language: detectLanguage(filePath), projectId } })
      await db.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } })
      publish('files', { action: 'create', projectId, fileId: file.id }, user.id)
      return {
        ok: true,
        summary: `Added file "${filePath}"`,
        data: { fileId: file.id, path: file.path },
        ui: [{ type: 'refresh_projects' }],
      }
    },
  },
  {
    name: 'update_file',
    description: 'Replace the content of an existing project file. Provide EITHER fileId OR (projectId + path). The path-based variant is convenient when you only know the file path.',
    parameters: {
      fileId: { type: 'string', description: 'File ID (preferred)' },
      projectId: { type: 'string', description: 'Project ID (used with path to locate file)' },
      path: { type: 'string', description: 'File path within the project (used with projectId)' },
      content: { type: 'string', description: 'New full file content', required: true },
    },
    run: async (args, req) => {
      const user = await getUserOrThrow(req)
      const content = String(args.content || '')
      let fileId = String(args.fileId || '')
      if (!fileId) {
        const projectId = String(args.projectId || '')
        const path = cleanPath(String(args.path || ''))
        if (!projectId || !path) return { ok: false, summary: 'Missing fileId or (projectId + path)', error: 'Provide either fileId or both projectId and path' }
        const f = await db.projectFile.findFirst({ where: { projectId, path }, include: { project: true } })
        if (!f || f.project.userId !== user.id) return { ok: false, summary: 'File not found', error: 'File not found' }
        fileId = f.id
      }
      const file = await db.projectFile.findUnique({ where: { id: fileId }, include: { project: true } })
      if (!file || file.project.userId !== user.id) return { ok: false, summary: 'File not found', error: 'File not found' }
      const updated = await db.projectFile.update({ where: { id: fileId }, data: { content } })
      await db.project.update({ where: { id: file.projectId }, data: { updatedAt: new Date() } })
      publish('files', { action: 'save', projectId: file.projectId, fileId }, user.id)
      return {
        ok: true,
        summary: `Updated "${updated.path}"`,
        data: { fileId: updated.id, path: updated.path },
      }
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a project file by ID.',
    parameters: {
      fileId: { type: 'string', description: 'File ID', required: true },
    },
    run: async (args, req) => {
      const user = await getUserOrThrow(req)
      const fileId = String(args.fileId || '')
      const file = await db.projectFile.findUnique({ where: { id: fileId }, include: { project: true } })
      if (!file || file.project.userId !== user.id) return { ok: false, summary: 'File not found', error: 'File not found' }
      await db.projectFile.delete({ where: { id: fileId } })
      publish('files', { action: 'delete', projectId: file.projectId, fileId }, user.id)
      return { ok: true, summary: `Deleted file "${file.path}"` }
    },
  },
  {
    name: 'delete_project',
    description: 'Permanently delete a project and all its files. Confirm with the user before deleting unless the request is explicit ("delete project X").',
    parameters: {
      projectId: { type: 'string', description: 'Project ID', required: true },
    },
    run: async (args, req) => {
      const user = await getUserOrThrow(req)
      const projectId = String(args.projectId || '')
      const project = await db.project.findFirst({ where: { id: projectId, userId: user.id } })
      if (!project) return { ok: false, summary: 'Project not found', error: 'Project not found' }
      await db.project.delete({ where: { id: projectId } })
      publish('projects', { action: 'delete', id: projectId }, user.id)
      return {
        ok: true,
        summary: `Deleted project "${project.name}"`,
        ui: [{ type: 'refresh_projects' }, { type: 'toast', message: `Deleted "${project.name}"` }],
      }
    },
  },

  /* ---------- build tools ---------- */
  {
    name: 'start_build',
    description: 'Start an APK build. For HTML projects you can build from a website URL or from an existing project (projectId). packageName must look like "com.example.app".',
    parameters: {
      appName: { type: 'string', description: 'App display name (2-40 chars)', required: true },
      packageName: { type: 'string', description: 'Android package name, e.g. "com.example.calculator"', required: true },
      projectId: { type: 'string', description: 'Project ID to build from (HTML or Kotlin)' },
      websiteUrl: { type: 'string', description: 'Website URL for HTML builds with sourceMode=url' },
      sourceType: { type: 'string', description: '"html" or "kotlin"', enum: ['html', 'kotlin'], required: true },
      sourceMode: { type: 'string', description: '"project" (default), "url", or "zip"', enum: ['project', 'url', 'zip'] },
      versionName: { type: 'string', description: 'Version name e.g. "1.0"' },
      versionCode: { type: 'number', description: 'Version code (integer >= 1)' },
    },
    run: async (args, req) => {
      const user = await getUserOrThrow(req)
      const appName = String(args.appName || '').trim()
      const packageName = String(args.packageName || '').trim()
      if (appName.length < 2) return { ok: false, summary: 'App name required', error: 'App name must be at least 2 characters' }
      if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)) {
        return { ok: false, summary: 'Invalid package name', error: 'Package name must look like com.myapp.main (lowercase, dotted)' }
      }
      const sourceType = args.sourceType === 'kotlin' ? 'kotlin' : 'html'
      const sourceMode = ['url', 'project', 'zip'].includes(String(args.sourceMode)) ? String(args.sourceMode) : 'project'
      if (sourceType === 'html' && sourceMode === 'url' && !/^https?:\/\/.+/.test(String(args.websiteUrl || ''))) {
        return { ok: false, summary: 'Invalid website URL', error: 'Website URL must start with http(s)://' }
      }
      if (sourceMode === 'project') {
        const projectId = String(args.projectId || '')
        if (!projectId) return { ok: false, summary: 'projectId required', error: 'projectId is required for sourceMode=project' }
        const proj = await db.project.findFirst({ where: { id: projectId, userId: user.id } })
        if (!proj) return { ok: false, summary: 'Project not found', error: 'Selected project not found' }
      }
      // Build config — sane defaults (the user can change them later in the Build page)
      const config: Record<string, unknown> = {
        loadingSpinner: true,
        exitConfirmation: true,
        pullToRefresh: false,
        pinchZoom: true,
      }
      const build = await db.build.create({
        data: {
          appName: appName.slice(0, 40),
          packageName,
          versionName: String(args.versionName || '1.0').slice(0, 20),
          versionCode: Math.max(1, Math.min(999999, parseInt(String(args.versionCode || 1)) || 1)),
          sourceType,
          sourceMode,
          websiteUrl: args.websiteUrl ? String(args.websiteUrl).slice(0, 500) : null,
          config: JSON.stringify(config),
          logs: '',
          userId: user.id,
          projectId: args.projectId ? String(args.projectId) : null,
          status: 'queued',
          provider: 'github',
        },
      })
      // Defer to the same build engine the user would use manually. If the
      // admin has not configured GitHub Actions yet, the build will simply
      // fail with a clear message — same as if the user clicked "Build" in
      // the UI themselves.
      try {
        const { startGithubBuild } = await import('@/lib/github-build')
        const { getGithubConfig, resolveSiteOrigin } = await import('@/lib/github-config')
        const gh = await getGithubConfig()
        if (!gh) {
          await db.build.update({
            where: { id: build.id },
            data: {
              status: 'failed',
              error: 'Build engine not configured. Ask the admin to connect GitHub Actions in Admin Panel → Engine.',
              completedAt: new Date(),
            },
          })
        } else {
          const origin = await resolveSiteOrigin(req)
          if (!origin) {
            await db.build.update({
              where: { id: build.id },
              data: {
                status: 'failed',
                error: 'Public site URL is missing. Set it in Admin Panel → Engine.',
                completedAt: new Date(),
              },
            })
          } else {
            startGithubBuild(build.id, origin).catch(() => {})
          }
        }
      } catch (e) {
        await db.build.update({
          where: { id: build.id },
          data: { status: 'failed', error: (e as Error).message || 'Failed to start build', completedAt: new Date() },
        }).catch(() => {})
      }
      publish('builds', { action: 'create', id: build.id, status: build.status }, user.id)
      return {
        ok: true,
        summary: `Build queued for "${appName}" (${packageName})`,
        data: {
          buildId: build.id,
          status: build.status,
          appName: build.appName,
          packageName: build.packageName,
        },
        ui: [
          { type: 'refresh_builds' },
          { type: 'toast', message: `Build queued — APK for "${appName}" is starting` },
        ],
      }
    },
  },

  /* ---------- UI navigation tools (do not change data, only the view) ---------- */
  {
    name: 'navigate_view',
    description: 'Switch the user\'s current view in the app UI. Use this to take the user somewhere relevant — e.g. navigate to "home" after creating a project, or "store" to browse templates, or "wallet" to top up. Valid views: home, store, build, console, ready, profile, wallet, payments, subscription, referrals, notifications, push, appDownload, adminPanel, seller, purchases.',
    parameters: {
      view: { type: 'string', description: 'Target view name', required: true },
    },
    run: async (args, _req) => {
      const view = String(args.view || '')
      const valid = ['home', 'store', 'build', 'console', 'ready', 'profile', 'wallet', 'payments', 'subscription', 'referrals', 'notifications', 'push', 'appDownload', 'adminPanel', 'seller', 'purchases']
      if (!valid.includes(view)) return { ok: false, summary: 'Invalid view', error: `Invalid view "${view}". Valid: ${valid.join(', ')}` }
      return {
        ok: true,
        summary: `Navigated to "${view}" view`,
        data: { view },
        ui: [{ type: 'navigate', view }],
      }
    },
  },
  {
    name: 'open_editor',
    description: 'Open the code editor for an existing project. Use after creating or modifying files so the user can immediately see the result.',
    parameters: {
      projectId: { type: 'string', description: 'Project ID to open in the editor', required: true },
    },
    run: async (args, req) => {
      const user = await getUserOrThrow(req)
      const projectId = String(args.projectId || '')
      const project = await db.project.findFirst({ where: { id: projectId, userId: user.id }, select: { id: true, name: true, type: true } })
      if (!project) return { ok: false, summary: 'Project not found', error: 'Project not found' }
      return {
        ok: true,
        summary: `Opened editor for "${project.name}"`,
        data: { project },
        ui: [{ type: 'open_editor', project: { id: project.id, name: project.name, type: project.type } }],
      }
    },
  },
  {
    name: 'show_toast',
    description: 'Show a brief toast message at the bottom of the screen. Use sparingly — only for things the user really needs to see.',
    parameters: {
      message: { type: 'string', description: 'Toast text (max ~80 chars)', required: true },
    },
    run: async (args, _req) => {
      const message = String(args.message || '').slice(0, 120)
      return {
        ok: true,
        summary: `Toast: ${message}`,
        data: { message },
        ui: [{ type: 'toast', message }],
      }
    },
  },
]

/* ------------------------------------------------------------------ */
/* Public surface used by the chat endpoint                            */
/* ------------------------------------------------------------------ */

export const TOOL_NAMES = TOOLS.map((t) => t.name)

export function getTool(name: string): ToolDef | undefined {
  return TOOLS.find((t) => t.name === name)
}

/**
 * Render a compact tool catalogue the LLM can read in its system prompt.
 * Format is intentionally terse to save tokens.
 */
export function toolCatalogue(): string {
  return TOOLS.map((t) => {
    const params = Object.entries(t.parameters).map(([k, v]) => {
      const req = v.required ? ' (required)' : ''
      const en = v.enum ? ` one of [${v.enum.join(',')}]` : ''
      return `    - ${k}: ${v.type}${req}${en} — ${v.description}`
    }).join('\n')
    return `• ${t.name} — ${t.description}${params ? '\n' + params : ''}`
  }).join('\n\n')
}
