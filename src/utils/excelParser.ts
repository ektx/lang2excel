import ExcelJS from 'exceljs';
import { set } from 'lodash-es';

export async function parseExcel(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const languages: string[] = [];
  // Key structure: result[lang][topLevelKey][...restKeys] = value
  const result: Record<string, any> = {};

  workbook.eachSheet((worksheet) => {
    // Skip the summary sheet
    if (worksheet.name === '汇总统计') return;

    const sheetName = worksheet.name;
    let headerRow: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // Parse header to get languages
        headerRow = (row.values as any[]).slice(1); // Row values are 1-indexed, slice(1) gets actual values
        // Filter out empty headers and 'key'
        headerRow.forEach((h, index) => {
          if (h && h !== 'key') {
            if (!languages.includes(h)) {
              languages.push(h);
            }
          }
        });
        return;
      }

      const rowValues = row.values as any[];
      const fullKey = rowValues[1]; // First column is 'key'
      if (!fullKey) return;

      languages.forEach((lang) => {
        const langColIndex = headerRow.indexOf(lang) + 1; // +1 because row.values is 1-indexed
        const value = rowValues[langColIndex];

        if (value !== undefined && value !== null && value !== '') {
          if (!result[lang]) result[lang] = {};
          
          // Use lodash set to recreate the nested structure
          // fullKey is like "normal.title"
          set(result[lang], fullKey, String(value));
        }
      });
    });
  });

  return { result, languages };
}
