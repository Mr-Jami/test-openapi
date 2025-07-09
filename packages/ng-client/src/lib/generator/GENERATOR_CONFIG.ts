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
        dateType: 'string',
        nullableStyle: 'undefined',
        generateComments: true,
        baseUrl: '/api',
        includeHttpOptions: true,
    },
    compilerOptions: {
        declaration: true,
        target: ScriptTarget.ES2015,
        module: ModuleKind.CommonJS,
        strict: true,
    }
};