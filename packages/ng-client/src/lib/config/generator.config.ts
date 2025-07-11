import {GeneratorConfig} from "../types";

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
        customHeaders: { // Add default custom headers
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
        },
        responseTypeMapping: { // Add response type mappings
            'application/pdf': 'blob',
            'application/zip': 'blob',
            'text/csv': 'text',
            'application/vnd.ms-excel': 'blob'
        },
        customizeMethodName: (operationId) => {
            return operationId;
        }
    }
};