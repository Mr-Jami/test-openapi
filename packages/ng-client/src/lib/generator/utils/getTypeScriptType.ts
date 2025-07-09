import {nullableType} from "./nullableType";
import {pascalCase} from "./pascalCase";

export function getTypeScriptType(schema: any, nullable?: boolean): string {
    if (!schema) return 'any';

    if (schema.$ref) {
        const refName = schema.$ref.split('/').pop();
        return nullableType(pascalCase(refName), nullable);
    }

    if (schema.type === 'array') {
        const itemType = getTypeScriptType(schema.items);
        return `${itemType}[]`;
    }

    switch (schema.type) {
        case 'string':
            if (schema.format === 'binary') {
                return nullableType('File', nullable);
            }
            return nullableType('string', nullable);
        case 'number':
        case 'integer':
            return nullableType('number', nullable);
        case 'boolean':
            return nullableType('boolean', nullable);
        case 'object':
            return nullableType('any', nullable);
        default:
            return nullableType('any', nullable);
    }
}