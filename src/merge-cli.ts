import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { flattenObject, unflattenObject } from './utils/i18nParser.js';

type LangMap = Record<string, any>;

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readLanguagesFrom(dir: string) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => {
      const full = path.join(dir, f);
      return fs.existsSync(path.join(full, 'index.ts')) && fs.statSync(full).isDirectory();
    });
}

async function loadIndex(dir: string, lang: string) {
  const p = path.join(dir, lang, 'index.ts');
  if (!fs.existsSync(p)) return undefined;
  const mod = await import(pathToFileURL(p).href);
  return (mod.default || mod) as LangMap;
}

function formatTsObject(varName: string, obj: any) {
  const json = JSON.stringify(obj, null, 2);
  const formatted = json.replace(/^(\s*)"(\w+)":/gm, '$1$2:');
  return `export const ${varName} = ${formatted};\n`;
}

function writeIndexTs(dir: string, keys: string[]) {
  const imports = keys.map(k => `import { ${k} } from './${k}.js';`).join('\n');
  const exportDefault = `export default {\n  ${keys.join(',\n  ')}\n};\n`;
  fs.writeFileSync(path.join(dir, 'index.ts'), `${imports}\n\n${exportDefault}`);
}

async function run() {
  const root = process.cwd();
  const exportRoot = path.join(root, 'exportLang');
  const newRoot = path.join(root, 'importLang', 'new');
  const mergeRoot = path.join(root, 'importLang', 'merge');
  if (!fs.existsSync(newRoot)) {
    console.error(`未找到目录: ${newRoot}`);
    process.exit(1);
  }
  ensureDir(mergeRoot);
  const langs = readLanguagesFrom(newRoot);
  const conflictLogs: string[] = [];
  const time = new Date().toISOString();
  conflictLogs.push(`[merge] ${time}`);
  for (const lang of langs) {
    const newMap = await loadIndex(newRoot, lang);
    if (!newMap) continue;
    const exportMap = await loadIndex(exportRoot, lang);
    const langMergeDir = path.join(mergeRoot, lang);
    ensureDir(langMergeDir);
    const topLevelKeys = Object.keys(newMap);
    for (const topKey of topLevelKeys) {
      const baseObj = newMap[topKey] || {};
      const expObj = exportMap ? exportMap[topKey] || {} : {};
      const baseFlat = flattenObject(baseObj, '');
      const expFlat = flattenObject(expObj, '');
      const merged: Record<string, string> = { ...baseFlat };
      for (const k of Object.keys(expFlat)) {
        const v = String(expFlat[k]);
        if (k in merged) {
          const old = String(merged[k] ?? '');
          if (old !== v) {
            conflictLogs.push(`[${lang}] ${topKey}.${k} | new="${old}" -> export="${v}"`);
          }
        }
        merged[k] = v;
      }
      const nested = unflattenObject(merged);
      fs.writeFileSync(path.join(langMergeDir, `${topKey}.ts`), formatTsObject(topKey, nested));
    }
    writeIndexTs(langMergeDir, topLevelKeys);
  }
  const logPath = path.join(mergeRoot, 'merge-conflicts.log');
  fs.writeFileSync(logPath, conflictLogs.join('\n') + '\n');
  console.log(`合并完成，输出目录: ${mergeRoot}`);
  console.log(`冲突日志: ${logPath}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

