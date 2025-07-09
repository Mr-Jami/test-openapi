import {ModuleKind, ScriptTarget} from "ts-morph";

export interface GeneratorConfig {
    input: string;
    output: {
        types: string;
        services: string;
    };
    options: {
        enumStyle: 'enum' | 'union';
        generateEnumBasedOnDescription?: boolean;
        dateType: 'string' | 'Date';
        dateTransformer?: boolean; // New option
        nullableStyle: 'undefined' | 'null' | 'both';
        generateComments: boolean;
        fileHeader?: string;
        baseUrl?: string;
        includeHttpOptions?: boolean;
        operationIdSeparator?: string;
        customHeaders?: Record<string, string>; // New option
        responseTypeMapping?: { // New option
            [contentType: string]: 'json' | 'blob' | 'arraybuffer' | 'text';
        };
    };
    compilerOptions?: {
        declaration?: boolean;
        target?: ScriptTarget;
        module?: ModuleKind;
        strict?: boolean;
    }
}