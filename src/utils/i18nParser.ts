import { set } from 'lodash-es';

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

// Keep unflattenObject just in case, though might not be needed for Excel export
export function unflattenObject(data: Record<string, string>): any {
  const result = {};
  for (const key in data) {
    set(result, key, data[key]);
  }
  return result;
}
