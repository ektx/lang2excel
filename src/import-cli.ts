import fs from 'fs';
import path from 'path';
import { parseExcel } from './utils/excelParser.js';

async function run() {
  const importDir = path.join(process.cwd(), 'importExcel');
  const i18nDir = path.join(process.cwd(), 'exportLang');

  if (!fs.existsSync(importDir)) {
    fs.mkdirSync(importDir, { recursive: true });
    console.log('Created import/ directory. Please put your .xlsx files there.');
    return;
  }

  const files = fs.readdirSync(importDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  if (files.length === 0) {
    console.log('No Excel files found in import/ directory.');
    return;
  }

  // Ensure i18n directory exists
  if (!fs.existsSync(i18nDir)) {
    fs.mkdirSync(i18nDir, { recursive: true });
  }

  for (const file of files) {
    const filePath = path.join(importDir, file);
    console.log(`Processing ${file}...`);

    try {
      const { result, languages } = await parseExcel(filePath);

      for (const lang of languages) {
        const langPath = path.join(i18nDir, lang);
        if (!fs.existsSync(langPath)) {
          fs.mkdirSync(langPath, { recursive: true });
        }

        const langData = result[lang] || {};
        const topLevelKeys = Object.keys(langData);
        
        // 1. Generate individual TS files for each top-level key
        topLevelKeys.forEach(key => {
          const content = `export default ${JSON.stringify(langData[key], null, 2)};\n`;
          fs.writeFileSync(path.join(langPath, `${key}.ts`), content);
        });

        // 2. Generate index.ts that imports all these files
        const imports = topLevelKeys
          .map(key => `import ${key} from './${key}.js';`)
          .join('\n');
        
        const exportDefault = `export default {\n  ${topLevelKeys.join(',\n  ')}\n};\n`;
        
        const indexContent = `${imports}\n\n${exportDefault}`;
        
        fs.writeFileSync(path.join(langPath, 'index.ts'), indexContent);
        console.log(`  - Generated ${lang} structure (${topLevelKeys.length} files)`);
      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }

  console.log('\nDone! Reverted i18n files saved in i18n directory.');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
