import {ModuleKind, ScriptTarget} from "ts-morph";
import {GeneratorConfig} from "./interfaces/generatorConfig";

export const GENERATOR_CONFIG: GeneratorConfig = {
    input: './packages/ng-client/src/lib/swagger.json',
    output: {
        types: './packages/ng-client/src/lib/generated/models/index.ts',
        services: './packages/ng-client/src/lib/generated/services',
    },
    options: {
        enumStyle: 'enum',
        generateEnumBasedOnDescription: true,
        dateType: 'Date', // Changed to Date
        dateTransformer: true, // Enable date transformer
        nullableStyle: 'undefined',
        generateComments: true,
        baseUrl: '/api',
        includeHttpOptions: true,
        operationIdSeparator: "_",
        customHeaders: { // Add default custom headers
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
        },
        responseTypeMapping: { // Add response type mappings
            'application/pdf': 'blob',
            'application/zip': 'blob',
            'text/csv': 'text',
            'application/vnd.ms-excel': 'blob'
        }
    },
    compilerOptions: {
        declaration: true,
        target: ScriptTarget.ES2015,
        module: ModuleKind.CommonJS,
        strict: true,
    }
};