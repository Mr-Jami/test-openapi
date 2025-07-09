export function nullableType(type: string, isNullable?: boolean): string {
    return type + (isNullable ? ' | null' : '');
}