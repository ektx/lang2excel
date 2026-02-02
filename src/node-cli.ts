import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { flattenObject } from './utils/i18nParser.js';
import { generateExcel, ExcelDataRow } from './utils/excelGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const langDir = path.join(process.cwd(), 'lang');
  const dataDir = path.join(process.cwd(), 'data');

  if (!fs.existsSync(langDir)) {
    console.error(`Error: 'lang' directory not found at ${langDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 1. Scan directory for languages
  const languages = fs.readdirSync(langDir).filter(f => {
    const fullPath = path.join(langDir, f);
    return fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'index.ts'));
  });

  if (languages.length === 0) {
    console.error('Error: No language directories with index.ts found in lang/');
    process.exit(1);
  }

  console.log(`Found languages: ${languages.join(', ')}`);

  // 2. Import index.ts for each language
  const langContents: Record<string, any> = {};
  for (const lang of languages) {
    const indexPath = path.join(langDir, lang, 'index.ts');
    try {
      // Use pathToFileURL to ensure correct path format for import() on Windows
      const module = await import(pathToFileURL(indexPath).href);
      langContents[lang] = module.default || module;
      console.log(`Successfully loaded ${lang}/index.ts`);
    } catch (err) {
      console.error(`Error loading ${lang}/index.ts:`, err);
    }
  }

  // 3. Group translations by top-level key (which will be the sheet name)
  // Structure: groupedMap[sheetName][fullKey][lang] = value
  const groupedMap: Record<string, Record<string, Record<string, string>>> = {};

  for (const lang of languages) {
    const content = langContents[lang];
    if (!content) continue;

    // For each top-level key in index.ts
    for (const [topLevelKey, subObj] of Object.entries(content)) {
      const sheetName = topLevelKey;
      if (!groupedMap[sheetName]) {
        groupedMap[sheetName] = {};
      }

      // Flatten the sub-object (e.g., normal.ts content)
      // Prefix with topLevelKey as requested
      const flattened = flattenObject(subObj, topLevelKey);

      for (const [fullKey, value] of Object.entries(flattened)) {
        if (!groupedMap[sheetName][fullKey]) {
          groupedMap[sheetName][fullKey] = {};
        }
        groupedMap[sheetName][fullKey][lang] = value;
      }
    }
  }

  // 4. Convert to Excel format
  const dataByFile: Record<string, ExcelDataRow[]> = {};
  for (const [sheetName, keysMap] of Object.entries(groupedMap)) {
    dataByFile[sheetName] = Object.entries(keysMap).map(([key, translations]) => ({
      key,
      ...translations
    }));
  }

  // 5. Generate Excel
  const outputFileName = `i18n_export_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
  const outputPath = path.join(dataDir, outputFileName);
  
  console.log(`Generating Excel: ${outputPath}`);
  await generateExcel(dataByFile, languages, outputPath, outputFileName);
  
  console.log('Done! Excel file saved in data directory.');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
