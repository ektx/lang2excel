export interface I18nFile {
  name: string;
  path: string;
  lang: string;
  file: File;
}

export interface I18nStructure {
  rootPath: string;
  languages: string[];
  files: I18nFile[];
  indexFile?: File;
}

export function scanFiles(files: FileList | File[]): I18nStructure {
  const i18nFiles: I18nFile[] = [];
  const languages = new Set<string>();
  let indexFile: File | undefined;
  let rootPath = '';

  const fileArray = Array.from(files);

  for (const file of fileArray) {
    const fullPath = (file as any).webkitRelativePath || file.name;
    const pathParts = fullPath.split('/');

    // Look for 'i18n' in the path
    const i18nIndex = pathParts.indexOf('i18n');
    if (i18nIndex !== -1) {
      if (!rootPath) {
        rootPath = pathParts.slice(0, i18nIndex + 1).join('/');
      }

      const subPath = pathParts.slice(i18nIndex + 1);
      
      // Check for index file
      if (subPath.length === 1 && (subPath[0].startsWith('index.') || subPath[0].startsWith('i18n.'))) {
        indexFile = file;
        continue;
      }

      // Check for language folders (e.g., i18n/zh-CN/common.json)
      if (subPath.length >= 2) {
        const lang = subPath[0];
        languages.add(lang);
        i18nFiles.push({
          name: subPath.slice(1).join('/'),
          path: fullPath,
          lang: lang,
          file: file
        });
      }
    }
  }

  return {
    rootPath,
    languages: Array.from(languages),
    files: i18nFiles,
    indexFile
  };
}
