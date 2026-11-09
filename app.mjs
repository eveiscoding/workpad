import { copyLeetCodeList, parseImport } from './lists.mjs';

const get = (id) => document.getElementById(id);
const lists = get('lists');
const dialog = get('dialog');
const form = get('import-form');
const previous = get('previous');
const next = get('next');
const statement = get('statement');
const draft = get('draft');
const run = get('run');
const output = get('output');
const error = get('error');
const storageKey = 'workpad.library.v1';
const lockKey = 'workpad.collapsed.v1';
const state = load();
let worker;
let deadline;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? localStorage.getItem('leetcode-focus.v1'));
    if (saved && Array.isArray(saved.lists)) return saved;
  } catch { /* Start with an empty library if saved data cannot be read. */ }
  return { lists: [], selected: '' };
}

function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function currentList() {
  return state?.lists.find((list) => list.id === state.selected);
}

function currentProblem() {
  const list = currentList();
  return list?.problems[list.position];
}

function resetRun() {
  worker?.terminate();
  worker = undefined;
  clearTimeout(deadline);
  run.disabled = false;
  output.textContent = '';
  output.hidden = true;
}

function render() {
  resetRun();
  const list = currentList();
  const problem = currentProblem();
  lists.hidden = !state.lists.length;
  lists.replaceChildren(...state.lists.map((item) => new Option(item.name, item.id)));
  lists.value = state.selected;
  get('empty').hidden = Boolean(problem);
  get('entry').hidden = !problem;
  get('title').textContent = problem?.title ?? '';
  get('number').textContent = problem?.number ? '#' + problem.number : '';
  get('count').textContent = problem ? (list.position + 1) + ' / ' + list.problems.length : '';
  get('source-link').href = problem?.url ?? '#';
  statement.value = problem?.statement ?? '';
  draft.value = problem?.draft ?? '';
  previous.disabled = !problem || list.position === 0;
  next.disabled = !problem || list.position + 1 === list.problems.length;
}

function setLocked(locked) {
  if (locked) {
    if (dialog.open) dialog.close();
    resetRun();
  }
  get('workspace').hidden = locked;
  get('gate').hidden = !locked;
  get('lock').hidden = locked;
  try { sessionStorage.setItem(lockKey, locked ? '1' : '0'); } catch { /* Collapse still works in this tab. */ }
}

function saveField(key, element) {
  const problem = currentProblem();
  if (!problem) return;
  problem[key] = element.value;
  try {
    save();
    element.setCustomValidity('');
  } catch {
    element.setCustomValidity('浏览器存储已满，当前修改尚未保存。');
    element.reportValidity();
  }
}

function move(offset) {
  const list = currentList();
  const target = list.position + offset;
  if (target < 0 || target >= list.problems.length) return;
  list.position = target;
  try { save(); } finally { render(); }
}

function openImport() {
  form.reset();
  error.hidden = true;
  dialog.showModal();
}

function finishRun(message) {
  resetRun();
  output.hidden = false;
  output.textContent = message;
}

run.addEventListener('click', () => {
  if (!draft.value.trim() || run.disabled) return;
  run.disabled = true;
  output.hidden = false;
  output.textContent = '正在启动…';
  worker ??= new Worker(new URL('./python-worker.js', import.meta.url));
  deadline = setTimeout(() => finishRun('运行环境加载超时。'), 45000);
  worker.onmessage = ({ data }) => {
    if (data.ready) {
      clearTimeout(deadline);
      output.textContent = '正在运行…';
      deadline = setTimeout(() => finishRun('运行超时。'), 5000);
    } else {
      clearTimeout(deadline);
      run.disabled = false;
      output.textContent = data.output;
      // Keep the downloaded runtime only for the current entry.
    }
  };
  worker.onerror = () => finishRun('无法加载运行环境。');
  worker.postMessage(draft.value);
});

get('lock').addEventListener('click', () => { setLocked(true); get('unlock').focus(); });
get('unlock').addEventListener('click', () => { setLocked(false); get('lock').focus(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !dialog.open && !get('workspace').hidden) {
    setLocked(true);
    get('unlock').focus();
  }
});
get('add').addEventListener('click', openImport);
get('empty-add').addEventListener('click', openImport);
get('close').addEventListener('click', () => dialog.close());
get('exporter').href = 'javascript:void(' + encodeURIComponent('(' + copyLeetCodeList.toString() + ')()') + ')';
get('exporter').addEventListener('click', (event) => event.preventDefault());
previous.addEventListener('click', () => move(-1));
next.addEventListener('click', () => move(1));
statement.addEventListener('input', () => saveField('statement', statement));
draft.addEventListener('input', () => saveField('draft', draft));
lists.addEventListener('change', () => {
  state.selected = lists.value;
  try { save(); } finally { render(); }
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const imported = parseImport(get('source').value, get('name').value);
    const id = crypto.randomUUID();
    const previousSelection = state.selected;
    state.lists.push({ ...imported, id, position: 0 });
    state.selected = id;
    try { save(); } catch {
      state.lists.pop();
      state.selected = previousSelection;
      throw new Error('浏览器无法保存清单，请检查存储设置。');
    }
    dialog.close();
    render();
  } catch (cause) {
    error.textContent = cause.message;
    error.hidden = false;
  }
});
let collapsed = false;
try { collapsed = sessionStorage.getItem(lockKey) === '1'; } catch { /* Open normally. */ }
render();
setLocked(collapsed);
