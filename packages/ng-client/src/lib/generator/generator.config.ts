export interface GeneratorConfig {
    input: string;
    output: {
        types: string;
        services: string;
    };
    options: {
        enumStyle: 'enum' | 'union';
        dateType: 'string' | 'Date';
        nullableStyle: 'undefined' | 'null' | 'both';
        generateComments: boolean;
        fileHeader?: string;
        baseUrl?: string;
        includeHttpOptions?: boolean;
    };
}

export const defaultConfig: GeneratorConfig = {
    input: './packages/ng-client/src/lib/swagger.json',
    output: {
        types: './packages/ng-client/src/lib/generated/models/index.ts',
        services: './packages/ng-client/src/lib/generated/services',
    },
    options: {
        enumStyle: 'enum',
        dateType: 'string',
        nullableStyle: 'undefined',
        generateComments: true,
        baseUrl: '/api',
        includeHttpOptions: true,
    },
};