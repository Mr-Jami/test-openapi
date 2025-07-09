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
        nullableStyle: 'undefined' | 'null' | 'both';
        generateComments: boolean;
        fileHeader?: string;
        baseUrl?: string;
        includeHttpOptions?: boolean;
    };
    compilerOptions?: {
        declaration?: boolean;
        target?: ScriptTarget;
        module?: ModuleKind;
        strict?: boolean;
    }
}