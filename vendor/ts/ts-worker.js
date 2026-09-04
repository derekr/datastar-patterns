// In-worker TypeScript LanguageService (single-file snippets).
// Classic worker: loaded via `new Worker('./ts-worker.js')`.
// Protocol (both directions are plain JSON):
//   in:  {id, type:'diagnose', code}  — replace /main.ts, return diagnostics
//   out: {id, type:'ready'} | {id, type:'diagnostics', diagnostics:[...], ms}
// Diagnostic shape: {start, length, line, character, code, message, category}
// where category is 'error' | 'warning' | 'suggestion' | 'message'.
importScripts('./lib/typescript.js');

const FILES = {
  '/main.ts': '',
  '/lib.d.ts': null,
  '/lib.dom.d.ts': null,
  '/lib.es5.d.ts': null,
};
let version = 0;
let svc = null;

const host = {
  getScriptFileNames: () => Object.keys(FILES).filter((f) => f.endsWith('.ts') && FILES[f] !== null),
  getScriptVersion: () => String(version),
  getScriptSnapshot: (f) =>
    FILES[f] !== undefined && FILES[f] !== null ? ts.ScriptSnapshot.fromString(FILES[f]) : undefined,
  getCurrentDirectory: () => '/',
  getCompilationSettings: () => ({ strict: true, target: ts.ScriptTarget.ES2020 }),
  getDefaultLibFileName: () => '/lib.d.ts',
  fileExists: (f) => FILES[f] !== undefined && FILES[f] !== null,
  readFile: (f) => (FILES[f] ?? undefined),
  readDirectory: () => [],
  directoryExists: () => true,
  getDirectories: () => [],
};

const CATS = ['warning', 'error', 'suggestion', 'message'];
function flat(d) {
  const { line, character } = ts.getLineAndCharacterOfPosition(d.file, d.start);
  return {
    start: d.start,
    length: d.length,
    line,
    character,
    code: d.code,
    category: CATS[d.category] || 'error',
    message: ts.flattenDiagnosticMessageText(d.messageText, ' '),
  };
}

async function boot(id) {
  // lib files ride alongside this worker; fetch once at startup.
  for (const name of ['lib.d.ts', 'lib.dom.d.ts', 'lib.es5.d.ts']) {
    const res = await fetch('./lib/' + name);
    if (!res.ok) throw new Error('lib fetch failed: ' + name + ' ' + res.status);
    FILES['/' + name] = await res.text();
  }
  svc = ts.createLanguageService(host);
  postMessage({ id, type: 'ready' });
}

onmessage = async (e) => {
  const msg = e.data || {};
  if (msg.type === 'init') {
    try {
      await boot(msg.id);
    } catch (err) {
      postMessage({ id: msg.id, type: 'error', message: String((err && err.message) || err) });
    }
    return;
  }
  if (msg.type === 'diagnose') {
    if (!svc) {
      postMessage({ id: msg.id, type: 'diagnostics', diagnostics: [], ms: 0 });
      return;
    }
    const t0 = performance.now();
    FILES['/main.ts'] = String(msg.code ?? '');
    version++;
    const file = '/main.ts';
    const diagnostics = [
      ...svc.getSyntacticDiagnostics(file),
      ...svc.getSemanticDiagnostics(file),
    ].map(flat);
    postMessage({
      id: msg.id,
      type: 'diagnostics',
      diagnostics,
      ms: Math.round(performance.now() - t0),
    });
  }
};
