# Lang2Excel

这是一个功能强大的 i18n 资源文件转 Excel 工具，旨在帮助开发人员和翻译人员更高效地管理多语言翻译。它支持从 TypeScript 格式的 i18n 文件中提取数据，并生成带有统计信息和差异标记的 Excel 表格。

## 🌟 主要功能

- **多语言整合**：自动扫描 `importLang` 目录，支持 `cn`, `en`, `fr` 等多种语言目录。
- **差异对比 (New vs Old)**：支持将 `new` 文件夹中的最新翻译与 `old` 文件夹中的旧版本进行对比。
- **视觉标记**：
  - **新增项高亮**：
    - 在工作表中，相对于旧版本新增的翻译 Key 会以 **绿色背景** 标记。
    - 包含新增翻译的 **工作表标签 (Tab)** 也会被标记为绿色，方便快速定位。
  - **缺失项警告**：在“汇总统计”页中，如果各语言的翻译数量不一致，该行会自动以 **红色背景** 警告。
- **自动汇总**：自动生成一个“汇总统计”工作表，展示每个模块（Sheet）在各语言下的翻译数量，并包含动态公式。
- **智能格式化**：生成的 Excel 具有冻结首行、自动调整列宽等人性化设置。

## 📁 目录结构

```text
lang2excel/
├── importExcel/             # 输入表格内容 将表格内容转为 i18n 文件
├── importLang/              # 输入目录
│   ├── new/                 # 存放最新的 i18n 源码（用于生成 Excel）
│   │   ├── cn/              # 中文语言包（包含 normal.ts, login.ts 等模块）
│   │   ├── en/              # 英文语言包
│   │   ├── fr/              # 法文语言包
│   │   └── index.ts         # 语言包入口，定义导出的模块结构
│   └── old/                 # 存放旧版本的 i18n 源码（仅用于差异对比）
│       ├── cn/
│       ├── en/
│       ├── fr/
│       └── index.ts
├── exportExcel/             # 导出的 Excel 文件存放处
├── exportLang/              # Excel 导出的 i18n 文件存放处
├── src/                     # 源码目录
│   ├── utils/               # 工具类
│   ├── import-cli.ts        # Excel 转 i18n 脚本入口
│   └── node-cli.ts          # i18n 转 Excel 脚本入口（主逻辑）
```

## 🚀 快速开始

### 1. 安装依赖

确保你已安装 Node.js 环境，然后在项目根目录运行：

```bash
pnpm install
# 或者使用 npm/yarn
npm install
```

### 2. 准备数据

将你的 i18n 文件夹分别放入 `importLang/new`（当前版本）和 `importLang/old`（对比版本）。

每个语言目录下应包含一个 `index.ts` 作为入口。

### 3. 执行转换

运行以下命令开始转换：

```bash
npm run convert
```

执行完成后，生成的 Excel 文件将保存在 `exportExcel` 目录下，文件名格式为 `i18n_export_YYYY-MM-DD...xlsx`。

### 4. 合并翻译

运行以下命令执行智能合并（将 `exportLang` 的翻译增量合并到 `importLang/new` 中，并输出到 `importLang/merge`）：

```bash
npm run merge
```

执行完成后：
- 合并后的文件输出到 `importLang/merge/<lang>/`
- 冲突日志输出到 `importLang/merge/merge-conflicts.log`

## 📊 输出说明

### 汇总统计页 (Summary)
- 展示所有 Sheet 的名称。
- 统计各语言下的 Key 数量。
- **红色背景**：当某一行的语言数量不一致时（例如中文有 100 条，英文只有 98 条），该行会显示为红色，提醒有漏译。

### 模块明细页 (Detail Sheets)
- 每行代表一个翻译项。
- **绿色背景**：如果该 Key 在 `old` 文件夹中不存在，则该行会标记为绿色。

## 🧩 合并规则与说明

- 输入目录
  - 源数据：`exportLang/<lang>/index.ts`
  - 目标数据：`importLang/new/<lang>/index.ts`
- 输出目录
  - 合并结果：`importLang/merge/<lang>/`
  - 冲突日志：`importLang/merge/merge-conflicts.log`
- 语言与模块匹配
  - 以 `importLang/new/<lang>/index.ts` 中存在的语言与顶层模块为准（如 `normal`, `login`）
  - 仅对这些同名模块进行合并，保持模块边界稳定，不会新增额外模块
- 字段级增量更新
  - 保留 `new` 的原有结构与已有字段
  - 若同一完整 key 在两侧均存在但值不同：优先采用 `exportLang` 的值，并记录到冲突日志
  - 若 key 仅存在于 `exportLang`：将该字段新增到结果
  - 若 key 仅存在于 `new`：保持不变
- 结构保持
  - 合并后会还原为嵌套对象结构，输出同名 `*.ts` 模块文件，并生成 `index.ts`（使用 `./<module>.js` 的导入约定以与项目现有脚本保持一致）
- 使用建议
  - 请确保 `importLang/new/<lang>/index.ts` 存在且声明了顶层模块
  - 若某语言在 `exportLang` 中不存在，对应语言的合并结果将与 `new` 保持一致，不会产生新增字段
  - 冲突日志包含语言、模块、完整 key、原值与采用值，便于审计与回溯

## 🛠️ 技术栈

- **TypeScript**：类型安全的开发体验。
- **ExcelJS**：强大的 Excel 文件处理库。
- **lodash-es**：对象处理辅助。
- **tsx**：直接运行 TypeScript 脚本。

