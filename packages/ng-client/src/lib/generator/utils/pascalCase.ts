export function pascalCase(str: string): string {
    return str.replace(/(?:^|[-_])([a-z])/g, (_, char) => char.toUpperCase());
}