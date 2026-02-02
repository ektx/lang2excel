import ExcelJS from 'exceljs';

export interface ExcelDataRow {
  key: string;
  [lang: string]: string;
}

export async function generateExcel(
  dataByFile: Record<string, ExcelDataRow[]>, 
  languages: string[], 
  outputPath: string,
  fileName: string = 'i18n_translations.xlsx'
) {
  const workbook = new ExcelJS.Workbook();
  const headerNames = ['key', ...languages];

  // 1. Create Summary Sheet first
  const summarySheet = workbook.addWorksheet('汇总统计');
  const summaryColumns = [
    { header: '工作表名', key: 'name', width: 30 },
    ...languages.map(lang => ({ header: `${lang} 数量`, key: lang, width: 15 }))
  ];
  summarySheet.columns = summaryColumns;
  
  // Freeze first row of summary
  summarySheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // 2. Prepare Translation Sheets
  const sheetsInfo: { name: string, langCounts: Record<string, number> }[] = [];
  
  for (const [sheetName, rows] of Object.entries(dataByFile)) {
    // We use a stable name for formula referencing
    const safeSheetName = sheetName.substring(0, 31).replace(/[\\*?:/\[\]]/g, '_');
    const ws = workbook.addWorksheet(safeSheetName);
    
    // Calculate counts per language for this sheet
    const langCounts: Record<string, number> = {};
    languages.forEach(lang => {
      langCounts[lang] = rows.filter(r => r[lang] && String(r[lang]).trim() !== '').length;
    });

    // Set columns with auto-width logic
    ws.columns = headerNames.map((h, colIdx) => {
      let maxLen = h.length;
      rows.forEach(row => {
        const val = String(row[h] || '');
        if (val.length > maxLen) maxLen = val.length;
      });
      return { 
        header: h, 
        key: h, 
        width: Math.min(maxLen + 2, 50) 
      };
    });

    // Add rows
    ws.addRows(rows);

    // Freeze first row
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    sheetsInfo.push({ name: safeSheetName, langCounts });
  }

  // 3. Fill Summary Sheet with data and formulas
  sheetsInfo.forEach((info) => {
    const rowData: any = { name: info.name };
    languages.forEach(lang => {
      rowData[lang] = info.langCounts[lang];
    });

    const row = summarySheet.addRow(rowData);

    // Check if all language counts are the same
    const counts = languages.map(lang => info.langCounts[lang]);
    const allSame = counts.every(c => c === counts[0]);

    // Set formulas and styling
    languages.forEach((lang, index) => {
      const colIdx = index + 2; // +1 for 1-based, +1 for name column
      const cell = row.getCell(colIdx);
      
      // Get the column letter for this language in the detail sheet
      // 'key' is A, first lang is B, etc.
      const detailColLetter = String.fromCharCode(66 + index); 
      
      cell.value = {
        formula: `COUNTA('${info.name}'!${detailColLetter}:${detailColLetter})-1`,
        result: info.langCounts[lang]
      };
    });
  });

  // 4. Add Dynamic Conditional Formatting to Summary Sheet
  // This will monitor the counts and highlight in red if they differ
  if (sheetsInfo.length > 0 && languages.length > 1) {
    const startRow = 2;
    const endRow = sheetsInfo.length + 1;
    const startColLetter = 'B';
    const endColLetter = String.fromCharCode(65 + languages.length + 1);
    
    // Formula to check if MAX count in row is not equal to MIN count in row
    // e.g., MAX($B2:$C2)<>MIN($B2:$C2)
    const rangeRef = `${startColLetter}${startRow}:${endColLetter}${endRow}`;
    const formulaRange = `$${startColLetter}2:$${endColLetter}2`;

    (summarySheet as any).addConditionalFormatting({
      ref: rangeRef,
      rules: [
        {
          type: 'expression',
          formulae: [`MAX(${formulaRange})<>MIN(${formulaRange})`],
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              bgColor: { argb: 'FFFFC7CE' } 
            },
            font: {
              color: { argb: 'FF9C0006' } // Dark red text
            }
          }
        }
      ]
    });
  }

  // Write file
  await workbook.xlsx.writeFile(outputPath);
}
