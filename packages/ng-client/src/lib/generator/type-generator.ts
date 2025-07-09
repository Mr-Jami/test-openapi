import {InterfaceDeclaration, ModuleKind, Project, ScriptTarget, SourceFile} from "ts-morph";
import {SwaggerParser} from "./swagger-parser";
import {GENERATOR_CONFIG} from "./GENERATOR_CONFIG";
import {TYPE_GENERATOR_HEADER_COMMENT} from "./constants";
import {SwaggerDefinition} from "./interfaces/swaggerDefinition";
import {EnumValueObject} from "./interfaces/enumValueObject";

export class TypeGenerator {
    private readonly project: Project;
    private readonly parser: SwaggerParser;
    private readonly sourceFile: SourceFile;
    private readonly generatedTypes = new Set<string>();

    constructor(swaggerPath: string, outputPath: string) {
        this.project = new Project({
            compilerOptions: {
                declaration: true,
                target: ScriptTarget.ES2022,
                module: ModuleKind.Preserve,
                strict: true,
                ...GENERATOR_CONFIG.compilerOptions
            },
        });

        try {
            this.parser = new SwaggerParser(swaggerPath);
            this.sourceFile = this.project.createSourceFile(outputPath, '', {overwrite: true});
        } catch (error) {
            console.error('Error initializing TypeGenerator:', error);
            throw error;
        }
    }

    generate(): void {
        try {
            const definitions = this.parser.getDefinitions();
            if (!definitions || Object.keys(definitions).length === 0) {
                console.warn('No definitions found in swagger file');
                return;
            }

            // Add file header comment
            this.sourceFile.insertText(0, TYPE_GENERATOR_HEADER_COMMENT);

            // Generate interfaces for each definition
            Object.entries(definitions).forEach(([name, definition]) => {
                this.generateInterface(name, definition);
            });

            // Save the file
            this.sourceFile.saveSync();
        } catch (error) {
            console.error('Error in generate():', error);
            throw new Error(`Failed to generate types: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private generateInterface(name: string, definition: SwaggerDefinition): void {
        const interfaceName = this.pascalCase(name);

        // Prevent duplicate type generation
        if (this.generatedTypes.has(interfaceName)) {
            return;
        }
        this.generatedTypes.add(interfaceName);

        if (definition.enum) {
            this.generateEnum(interfaceName, definition);
            return;
        }

        if (definition.allOf) {
            this.generateCompositeType(interfaceName, definition);
            return;
        }

        const interfaceDeclaration = this.sourceFile.addInterface({
            name: interfaceName,
            isExported: true,
            docs: definition.description ? [definition.description] : undefined,
        });

        this.addInterfaceProperties(interfaceDeclaration, definition);
    }

    private generateEnum(name: string, definition: SwaggerDefinition): void {
        if (!definition.enum?.length) return;

        // Check if it's a string enum or numeric enum
        const isStringEnum = definition.enum.some(value => typeof value === 'string');

        if (isStringEnum) {
            // Generate union type for string enums for better type safety
            const unionType = definition.enum
                .map(value => typeof value === 'string' ? `'${this.escapeString(value)}'` : String(value))
                .join(' | ');

            this.sourceFile.addTypeAlias({
                name,
                type: unionType,
                isExported: true,
                docs: definition.description ? [definition.description] : undefined,
            });
        } else if (definition.description && GENERATOR_CONFIG.options.generateEnumBasedOnDescription) {
            const enumDeclaration = this.sourceFile.addEnum({
                name,
                isExported: true,
            });

            try {
                const enumValueObjects = JSON.parse(definition.description) as EnumValueObject[];
                enumValueObjects.forEach(enumValueObject => {
                    enumDeclaration.addMember({
                        name: enumValueObject.Name,
                        value: enumValueObject.Value,
                    })
                })
            } catch (e) {
                console.error(`Failed to parse enum description for ${name}`);
            }
        } else {
            const enumDeclaration = this.sourceFile.addEnum({
                name,
                isExported: true,
                docs: definition.description ? [definition.description] : undefined,
            });

            definition.enum.forEach((value) => {
                const enumKey = this.toEnumKey(value);
                enumDeclaration.addMember({
                    name: enumKey,
                    value: value,
                });
            });
        }
    }

    private generateCompositeType(name: string, definition: SwaggerDefinition): void {
        let typeExpression = '';

        if (definition.allOf) {
            const types = definition.allOf
                .map(def => this.getTypeFromDefinition(def))
                .filter(type => type !== 'any' && type !== 'unknown'); // Filter out 'any' and 'unknown' types
            typeExpression = types.length > 0 ? types.join(' & ') : 'Record<string, unknown>';
        }

        this.sourceFile.addTypeAlias({
            name,
            type: typeExpression,
            isExported: true,
            docs: definition.description ? [definition.description] : undefined,
        });
    }

    private addInterfaceProperties(interfaceDeclaration: InterfaceDeclaration, definition: SwaggerDefinition): void {
        // Handle explicitly empty object: no properties and no additionalProperties
        if (!definition.properties && definition.additionalProperties === false) {
            interfaceDeclaration.addIndexSignature({
                keyName: 'key',
                keyType: 'string',
                returnType: 'never',
            });
            return;
        }

        // Optional: Handle object with dynamic additional properties
        if (!definition.properties && definition.additionalProperties === true) {
            interfaceDeclaration.addIndexSignature({
                keyName: 'key',
                keyType: 'string',
                returnType: 'any',
            });
            return;
        }

        // Skip if no declared properties and no additionalProperties info
        if (!definition.properties) {
            console.warn(`No properties found for interface ${interfaceDeclaration.getName()}`);
            return;
        }


        Object.entries(definition.properties).forEach(([propertyName, property]) => {
            const isRequired = definition.required?.includes(propertyName) ?? false;
            const isReadOnly = property.readOnly;
            const propertyType = this.getTypeFromProperty(property);

            // Sanitize property name for TypeScript compatibility
            const sanitizedName = this.sanitizePropertyName(propertyName);

            interfaceDeclaration.addProperty({
                name: sanitizedName,
                type: propertyType,
                isReadonly: isReadOnly,
                hasQuestionToken: !isRequired,
                docs: property.description ? [property.description] : undefined,
            });
        });
    }

    private getTypeFromProperty(property: SwaggerDefinition): string {
        if (property.$ref) {
            return this.resolveReference(property.$ref);
        }

        if (property.enum) {
            return this.getEnumType(property.enum);
        }

        if (property.allOf) {
            return this.composeTypeUnion(property.allOf, "&");
        }

        if (property.oneOf) {
            return this.composeTypeUnion(property.oneOf, "|");
        }

        if (property.anyOf) {
            return this.composeTypeUnion(property.anyOf, "|");
        }

        if (property.type === 'array') {
            const itemType = property.items ? this.getArrayItemType(property.items) : 'unknown';
            return `${itemType}[]`;
        }

        if (property.type === 'object') {
            if (property.properties) {
                return this.generateInlineObjectType(property);
            }
            if (property.additionalProperties) {
                const additionalType = typeof property.additionalProperties === 'object'
                    ? this.getTypeFromProperty(property.additionalProperties)
                    : 'unknown';
                return `Record<string, ${additionalType}>`;
            }
            return 'Record<string, unknown>';
        }

        return this.mapSwaggerTypeToTypeScript(property.type, property.format, property.nullable);
    }

    private composeTypeUnion(defs: SwaggerDefinition[], joiner: '|' | '&'): string {
        const types = defs
            .map(def => this.getTypeFromDefinition(def))
            .filter(type => type !== 'any' && type !== 'unknown');
        return types.length > 0 ? types.join(` ${joiner} `) : 'unknown';
    }

    private getEnumType(values: any[]): string {
        return values
            .map(value => typeof value === 'string' ? `'${this.escapeString(value)}'` : String(value))
            .join(' | ');
    }

    private getTypeFromDefinition(definition: SwaggerDefinition): string {
        if (definition.$ref) {
            return this.resolveReference(definition.$ref);
        }

        if (definition.type === 'object' && definition.properties) {
            return this.generateInlineObjectType(definition);
        }

        if (definition.enum) {
            return definition.enum
                .map(value => typeof value === 'string' ? `'${this.escapeString(value)}'` : String(value))
                .join(' | ');
        }

        if (definition.allOf) {
            const types = definition.allOf
                .map(def => this.getTypeFromDefinition(def))
                .filter(type => type !== 'any' && type !== 'unknown');
            return types.length > 0 ? types.join(' & ') : 'Record<string, unknown>';
        }

        if (definition.oneOf) {
            const types = definition.oneOf
                .map(def => this.getTypeFromDefinition(def))
                .filter(type => type !== 'any' && type !== 'unknown');
            return types.length > 0 ? types.join(' | ') : 'unknown';
        }

        if (definition.anyOf) {
            const types = definition.anyOf
                .map(def => this.getTypeFromDefinition(def))
                .filter(type => type !== 'any' && type !== 'unknown');
            return types.length > 0 ? types.join(' | ') : 'unknown';
        }

        return this.mapSwaggerTypeToTypeScript(definition.type, definition.format, definition.nullable);
    }

    private generateInlineObjectType(definition: SwaggerDefinition): string {
        if (!definition.properties) {
            // Handle additionalProperties for objects without defined properties
            if (definition.additionalProperties) {
                const additionalType = typeof definition.additionalProperties === 'object'
                    ? this.getTypeFromProperty(definition.additionalProperties)
                    : 'unknown';
                return `Record<string, ${additionalType}>`;
            }
            return 'Record<string, unknown>';
        }

        const properties = Object.entries(definition.properties)
            .map(([key, prop]) => {
                const isRequired = definition.required?.includes(key) ?? false;
                const questionMark = isRequired ? '' : '?';
                const sanitizedKey = this.sanitizePropertyName(key);
                return `${sanitizedKey}${questionMark}: ${this.getTypeFromProperty(prop)}`;
            })
            .join('; ');

        return `{ ${properties} }`;
    }

    private resolveReference(ref: string): string {
        try {
            const refDefinition = this.parser.resolveReference(ref);
            const refName = ref.split('/').pop();

            if (!refName) {
                console.warn(`Invalid reference format: ${ref}`);
                return 'unknown';
            }

            const typeName = this.pascalCase(refName);

            // Ensure referenced type is generated
            if (refDefinition && !this.generatedTypes.has(typeName)) {
                this.generateInterface(refName, refDefinition);
            }

            return typeName;
        } catch (error) {
            console.warn(`Failed to resolve reference ${ref}:`, error);
            return 'unknown';
        }
    }

    private mapSwaggerTypeToTypeScript(type?: string, format?: string, isNullable?: boolean): string {
        if (!type) return 'unknown';

        switch (type) {
            case 'string':
                if (format === 'date' || format === 'date-time') {
                    return this.nullableType('string', isNullable); // Consider using Date if you prefer
                }
                if (format === 'binary') return 'Blob';
                if (format === 'uuid') return 'string';
                if (format === 'email') return 'string';
                if (format === 'uri') return 'string';
                return this.nullableType('string', isNullable);
            case 'number':
            case 'integer':
                return this.nullableType('number', isNullable);
            case 'boolean':
                return this.nullableType('boolean', isNullable);
            case 'array':
                return this.nullableType('unknown[]', isNullable);
            case 'object':
                return this.nullableType('Record<string, unknown>', isNullable);
            case 'null':
                return this.nullableType('null', isNullable);
            default:
                console.warn(`Unknown swagger type: ${type}`);
                return this.nullableType('unknown', isNullable);
        }
    }

    private nullableType(type: string, isNullable?: boolean): string {
        return type + (isNullable ? ' | null' : '');
    }

    private pascalCase(str: string): string {
        return str
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/(?:^|_)([a-z])/g, (_, char) => char.toUpperCase())
            .replace(/^([0-9])/, '_$1'); // Handle names starting with numbers
    }

    private sanitizePropertyName(name: string): string {
        // If property name contains special characters, wrap in quotes
        if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
            return `"${name}"`;
        }
        return name;
    }

    private toEnumKey(value: string | number): string {
        return value.toString()
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/^([0-9])/, '_$1')
            .toUpperCase();
    }

    private getArrayItemType(items: SwaggerDefinition | SwaggerDefinition[]): string {
        if (Array.isArray(items)) {
            // Handle tuple types - items is an array of schemas
            const types = items.map(item => this.getTypeFromProperty(item));
            return `[${types.join(', ')}]`;
        } else {
            // Handle single item type
            return this.getTypeFromProperty(items);
        }
    }

    private escapeString(str: string): string {
        return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }
}