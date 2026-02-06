import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { flattenObject } from './utils/i18nParser.js';
import { generateExcel, ExcelDataRow } from './utils/excelGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const importLangRoot = path.join(process.cwd(), 'importLang');
  const newDir = path.join(importLangRoot, 'new');
  const oldDir = path.join(importLangRoot, 'old');
  const dataDir = path.join(process.cwd(), 'exportExcel');

  if (!fs.existsSync(newDir)) {
    console.error(`错误: 在 ${newDir} 未找到 'new' 目录`);
    process.exit(1);
  }

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 1. 扫描 'new' 文件夹中的语言目录
  const languages = fs.readdirSync(newDir).filter(f => {
    const fullPath = path.join(newDir, f);
    return fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'index.ts'));
  });

  if (languages.length === 0) {
    console.error('错误: 在 importLang/new/ 中未找到包含 index.ts 的语言目录');
    process.exit(1);
  }

  console.log(`在 new/ 中发现语言: ${languages.join(', ')}`);

  // 2. 分别从 'new' 和 'old' 导入每种语言的 index.ts
  const newLangContents: Record<string, any> = {};
  const oldLangContents: Record<string, any> = {};

  for (const lang of languages) {
    const newIndexPath = path.join(newDir, lang, 'index.ts');
    const oldIndexPath = path.join(oldDir, lang, 'index.ts');

    try {
      // 使用 pathToFileURL 确保 Windows 上的导入路径格式正确
      const module = await import(pathToFileURL(newIndexPath).href);
      newLangContents[lang] = module.default || module;
      console.log(`成功加载 new/${lang}/index.ts`);
    } catch (err) {
      console.error(`加载 new/${lang}/index.ts 失败:`, err);
    }

    if (fs.existsSync(oldIndexPath)) {
      try {
        const module = await import(pathToFileURL(oldIndexPath).href);
        oldLangContents[lang] = module.default || module;
        console.log(`成功加载 old/${lang}/index.ts`);
      } catch (err) {
        console.warn(`警告: 无法加载 old/${lang}/index.ts:`, err);
      }
    }
  }

  // 3. 预先扁平化旧内容以便于比较
  // 结构: oldFlattenedMap[sheetName] = Set of fullKeys
  const oldFlattenedMap: Record<string, Set<string>> = {};
  for (const lang of Object.keys(oldLangContents)) {
    const content = oldLangContents[lang];
    if (!content) continue;
    for (const [topLevelKey, subObj] of Object.entries(content)) {
      const flattened = flattenObject(subObj, topLevelKey);
      if (!oldFlattenedMap[topLevelKey]) {
        oldFlattenedMap[topLevelKey] = new Set();
      }
      Object.keys(flattened).forEach(k => oldFlattenedMap[topLevelKey].add(k));
    }
  }

  // 4. 按顶层 key 分组翻译内容（顶层 key 将作为工作表名称）
  // 结构: groupedMap[sheetName][fullKey] = { translations: { [lang]: string }, isNew: boolean }
  const groupedMap: Record<string, Record<string, { translations: Record<string, string>, isNew: boolean }>> = {};

  for (const lang of languages) {
    const content = newLangContents[lang];
    if (!content) continue;

    // 遍历 index.ts 中的每个顶层 key
    for (const [topLevelKey, subObj] of Object.entries(content)) {
      const sheetName = topLevelKey;
      if (!groupedMap[sheetName]) {
        groupedMap[sheetName] = {};
      }

      // 扁平化子对象
      const flattened = flattenObject(subObj, topLevelKey);

      for (const [fullKey, value] of Object.entries(flattened)) {
        if (!groupedMap[sheetName][fullKey]) {
          const isNew = !oldFlattenedMap[sheetName]?.has(fullKey);
          groupedMap[sheetName][fullKey] = {
            translations: {},
            isNew
          };
        }
        groupedMap[sheetName][fullKey].translations[lang] = value;
      }
    }
  }

  // 5. 转换为 Excel 格式数据
  const dataByFile: Record<string, ExcelDataRow[]> = {};
  for (const [sheetName, keysMap] of Object.entries(groupedMap)) {
    dataByFile[sheetName] = Object.entries(keysMap).map(([key, info]) => ({
      key,
      isNew: info.isNew,
      ...info.translations
    }));
  }

  // 6. 生成 Excel 文件
  const outputFileName = `i18n_export_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
  const outputPath = path.join(dataDir, outputFileName);
  
  console.log(`正在生成 Excel: ${outputPath}`);
  await generateExcel(dataByFile, languages, outputPath, outputFileName);
  
  console.log('完成！Excel 文件已保存到 exportExcel 目录。');
}

run().catch(err => {
  console.error('致命错误:', err);
  process.exit(1);
});
