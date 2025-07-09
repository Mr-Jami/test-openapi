export function camelCase(str: string): string {
    const cleaned = str.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
    return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}