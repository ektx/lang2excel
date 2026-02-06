import ExcelJS from 'exceljs';

export interface ExcelDataRow {
  key: string;
  isNew?: boolean;
  [lang: string]: any;
}

export async function generateExcel(
  dataByFile: Record<string, ExcelDataRow[]>, 
  languages: string[], 
  outputPath: string,
  fileName: string = 'i18n_translations.xlsx'
) {
  const workbook = new ExcelJS.Workbook();
  const headerNames = ['key', ...languages];

  // 1. 先创建汇总统计表
  const summarySheet = workbook.addWorksheet('汇总统计');
  const summaryColumns = [
    { header: '工作表名', key: 'name', width: 30 },
    ...languages.map(lang => ({ header: `${lang} 数量`, key: lang, width: 15 }))
  ];
  summarySheet.columns = summaryColumns;
  
  // 冻结汇总表首行
  summarySheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // 2. 准备各语言翻译表
  const sheetsInfo: { name: string, langCounts: Record<string, number> }[] = [];
  
  for (const [sheetName, rows] of Object.entries(dataByFile)) {
    // 使用稳定的名称进行公式引用
    const safeSheetName = sheetName.substring(0, 31).replace(/[\\*?:/\[\]]/g, '_');
    const ws = workbook.addWorksheet(safeSheetName);
    
    // 计算该表每种语言的数量
    const langCounts: Record<string, number> = {};
    languages.forEach(lang => {
      langCounts[lang] = rows.filter(r => r[lang] && String(r[lang]).trim() !== '').length;
    });

    // 设置列，包含自动宽度逻辑
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

    // 添加行数据
    rows.forEach(rowData => {
      const row = ws.addRow(rowData);
      if (rowData.isNew) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFC6EFCE' } // 浅绿色背景
          };
          cell.font = {
            color: { argb: 'FF006100' } // 深绿色文字
          };
        });
      }
    });

    // 冻结首行
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    sheetsInfo.push({ name: safeSheetName, langCounts });
  }

  // 3. 在汇总表中填充数据和公式
  sheetsInfo.forEach((info) => {
    const rowData: any = { name: info.name };
    languages.forEach(lang => {
      rowData[lang] = info.langCounts[lang];
    });

    const row = summarySheet.addRow(rowData);

    // 检查所有语言的数量是否一致
    const counts = languages.map(lang => info.langCounts[lang]);
    const allSame = counts.every(c => c === counts[0]);

    // 设置公式和样式
    languages.forEach((lang, index) => {
      const colIdx = index + 2; // +1 因为是 1-based, +1 因为第一列是名称
      const cell = row.getCell(colIdx);
      
      // 获取该语言在明细表中的列字母
      // 'key' 是 A, 第一个语言是 B, 依此类推
      const detailColLetter = String.fromCharCode(66 + index); 
      
      cell.value = {
        formula: `COUNTA('${info.name}'!${detailColLetter}:${detailColLetter})-1`,
        result: info.langCounts[lang]
      };
    });
  });

  // 4. 为汇总表添加动态条件格式
  // 监控数量并在不一致时标记为红色
  if (sheetsInfo.length > 0 && languages.length > 1) {
    const startRow = 2;
    const endRow = sheetsInfo.length + 1;
    const startColLetter = 'B';
    const endColLetter = String.fromCharCode(65 + languages.length + 1);
    
    // 检查行内最大值和最小值是否不等的公式
    // 例如：MAX($B2:$C2)<>MIN($B2:$C2)
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
              color: { argb: 'FF9C0006' } // 深红色文字
            }
          }
        }
      ]
    });
  }

  // 写入文件
  await workbook.xlsx.writeFile(outputPath);
}
