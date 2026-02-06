import { set } from 'lodash-es';

/**
 * 扁平化对象，将嵌套结构转换为点连接的 key 结构
 * @param obj 要扁平化的对象
 * @param prefix key 前缀
 * @returns 扁平化后的对象
 */
export function flattenObject(obj: any, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(result, flattenObject(obj[key], newKey));
      } else {
        result[newKey] = String(obj[key]);
      }
    }
  }

  return result;
}

/**
 * 将扁平化的对象还原为嵌套结构
 * 虽然 Excel 导出可能不需要，但保留此功能以备后用
 * @param data 扁平化的对象
 * @returns 嵌套结构的对象
 */
export function unflattenObject(data: Record<string, string>): any {
  const result = {};
  for (const key in data) {
    set(result, key, data[key]);
  }
  return result;
}
