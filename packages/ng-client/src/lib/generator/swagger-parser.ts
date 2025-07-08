import * as fs from 'fs';
import * as path from 'path';

export interface SwaggerDefinition {
    type: string;
    properties?: Record<string, SwaggerProperty>;
    required?: string[];
    enum?: string[];
    items?: SwaggerProperty;
    allOf?: SwaggerDefinition[];
    oneOf?: SwaggerDefinition[];
    anyOf?: SwaggerDefinition[];
    $ref?: string;
}

export interface SwaggerProperty {
    type?: string;
    format?: string;
    $ref?: string;
    items?: SwaggerProperty;
    properties?: Record<string, SwaggerProperty>;
    required?: string[];
    enum?: string[];
    description?: string;
    example?: any;
    allOf?: SwaggerDefinition[];
    oneOf?: SwaggerDefinition[];
    anyOf?: SwaggerDefinition[];
}

export interface SwaggerSpec {
    definitions?: Record<string, SwaggerDefinition>;
    components?: {
        schemas?: Record<string, SwaggerDefinition>;
    };
    info?: {
        title?: string;
        version?: string;
    };
}

export class SwaggerParser {
    private spec: SwaggerSpec;

    constructor(swaggerPath: string) {
        const swaggerContent = fs.readFileSync(swaggerPath, 'utf8');
        this.spec = JSON.parse(swaggerContent);
    }

    getDefinitions(): Record<string, SwaggerDefinition> {
        // Support both Swagger 2.0 (definitions) and OpenAPI 3.0 (components.schemas)
        return this.spec.definitions || this.spec.components?.schemas || {};
    }

    getDefinition(name: string): SwaggerDefinition | undefined {
        const definitions = this.getDefinitions();
        return definitions[name];
    }

    resolveReference(ref: string): SwaggerDefinition | undefined {
        // Handle $ref like "#/definitions/User" or "#/components/schemas/User"
        const parts = ref.split('/');
        const definitionName = parts[parts.length - 1];
        return this.getDefinition(definitionName);
    }

    getAllDefinitionNames(): string[] {
        return Object.keys(this.getDefinitions());
    }
}