import {ModuleKind, ScriptTarget} from "ts-morph";

export interface GeneratorConfig {
    input: string;
    output: {
        types: string;
        services: string;
    };
    options: {
        enumStyle: 'enum' | 'union'; //TODO: add implementation
        generateEnumBasedOnDescription?: boolean;
        dateType: 'string' | 'Date';
        customHeaders?: Record<string, string>; // New option
        responseTypeMapping?: { // New option
            [contentType: string]: 'json' | 'blob' | 'arraybuffer' | 'text';
        };
        customizeMethodName?: (operationId: string) => string;
    };
    compilerOptions?: {
        declaration?: boolean;
        target?: ScriptTarget;
        module?: ModuleKind;
        strict?: boolean;
    }
}