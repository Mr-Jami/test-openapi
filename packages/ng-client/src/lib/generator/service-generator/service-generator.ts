import {MethodDeclarationOverloadStructure, OptionalKind, Project, Scope, SourceFile, StructureKind} from 'ts-morph';
import {SwaggerParser} from '../swagger-parser';
import * as path from 'path';
import {SERVICE_GENERATOR_HEADER_COMMENT} from "../constants";
import {PathInfo} from '../interfaces/pathInfo';
import {Parameter} from "../interfaces/parameter";
import {RequestBody} from "../interfaces/requestBody";
import {Response} from "../interfaces/response";
import {SwaggerSpec} from "../interfaces/swaggerSpec";
import {GENERATOR_CONFIG} from "../GENERATOR_CONFIG";
import {nullableType} from "../utils/nullableType";
import {pascalCase} from "../utils/pascalCase";
import {kebabCase} from "../utils/kebabCase";
import {addServiceMethod} from "./utils/generate-service-method";
import {getTypeScriptType} from "../utils/getTypeScriptType";

export class ServiceGenerator {
    private project: Project;
    private parser: SwaggerParser;
    private spec: SwaggerSpec;

    constructor(swaggerPath: string, project: Project) {
        this.project = project;
        this.parser = new SwaggerParser(swaggerPath);
        this.spec = JSON.parse(require('fs').readFileSync(swaggerPath, 'utf8'));
    }

    generate(outputDir: string): void {
        const paths = this.extractPaths();
        const controllerGroups = this.groupPathsByController(paths);

        Object.entries(controllerGroups).forEach(([controllerName, operations]) => {
            this.generateServiceFile(controllerName, operations, outputDir);
        });
    }

    private extractPaths(): PathInfo[] {
        const paths: PathInfo[] = [];
        const swaggerPaths = this.spec.paths || {};

        Object.entries(swaggerPaths).forEach(([path, pathItem]: [string, any]) => {
            const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

            methods.forEach(method => {
                if (pathItem[method]) {
                    const operation = pathItem[method];
                    paths.push({
                        path,
                        method: method.toUpperCase(),
                        operationId: operation.operationId,
                        summary: operation.summary,
                        description: operation.description,
                        tags: operation.tags || [],
                        parameters: this.parseParameters(operation.parameters || [], pathItem.parameters || []),
                        requestBody: operation.requestBody,
                        responses: operation.responses || {},
                    });
                }
            });
        });

        return paths;
    }

    private parseParameters(operationParams: any[], pathParams: any[]): Parameter[] {
        const allParams = [...pathParams, ...operationParams];
        return allParams.map(param => ({
            name: param.name,
            in: param.in,
            required: param.required || param.in === 'path',
            schema: param.schema,
            type: param.type,
            format: param.format,
            description: param.description,
        }));
    }

    private groupPathsByController(paths: PathInfo[]): Record<string, PathInfo[]> {
        const groups: Record<string, PathInfo[]> = {};

        paths.forEach(path => {
            let controllerName = 'Default';

            if (path.tags && path.tags.length > 0) {
                controllerName = path.tags[0];
            } else if (path.operationId) {
                // Extract controller from operationId (e.g., "UserController_getUser" -> "User")
                const regex = new RegExp(`^(\\w+)${GENERATOR_CONFIG.options.operationIdSeparator}`);
                const match = path.operationId.match(regex);
                if (match) {
                    controllerName = match[1];
                }
            } else {
                // Extract from path (e.g., "/api/users/{id}" -> "Users")
                const pathParts = path.path.split('/').filter(p => p && !p.startsWith('{'));
                if (pathParts.length > 1) {
                    controllerName = pascalCase(pathParts[1]);
                }
            }

            controllerName = pascalCase(controllerName);

            if (!groups[controllerName]) {
                groups[controllerName] = [];
            }
            groups[controllerName].push(path);
        });

        return groups;
    }

    private generateServiceFile(controllerName: string, operations: PathInfo[], outputDir: string): void {
        const fileName = `${kebabCase(controllerName)}.service.ts`;
        const filePath = path.join(outputDir, fileName);

        const sourceFile = this.project.createSourceFile(filePath, '', {overwrite: true});

        // Collect all used model types first
        const usedTypes = this.collectUsedTypes(operations);

        this.addImports(sourceFile, usedTypes);
        this.addServiceClass(sourceFile, controllerName, operations);

        sourceFile.saveSync();
    }

    private collectUsedTypes(operations: PathInfo[]): Set<string> {
        const usedTypes = new Set<string>();

        operations.forEach(operation => {
            // Check parameters
            operation.parameters?.forEach(param => {
                this.collectTypesFromSchema(param.schema || param, usedTypes);
            });

            // Check request body
            if (operation.requestBody) {
                this.collectTypesFromRequestBody(operation.requestBody, usedTypes);
            }

            // Check responses
            if (operation.responses) {
                Object.values(operation.responses).forEach(response => {
                    this.collectTypesFromResponse(response, usedTypes);
                });
            }
        });

        return usedTypes;
    }

    private collectTypesFromSchema(schema: any, usedTypes: Set<string>): void {
        if (!schema) return;

        if (schema.$ref) {
            const refName = schema.$ref.split('/').pop();
            if (refName) {
                usedTypes.add(pascalCase(refName));
            }
        }

        if (schema.type === 'array' && schema.items) {
            this.collectTypesFromSchema(schema.items, usedTypes);
        }

        if (schema.type === 'object' && schema.properties) {
            Object.values(schema.properties).forEach(prop => {
                this.collectTypesFromSchema(prop, usedTypes);
            });
        }

        if (schema.allOf) {
            schema.allOf.forEach((subSchema: any) => {
                this.collectTypesFromSchema(subSchema, usedTypes);
            });
        }

        if (schema.oneOf) {
            schema.oneOf.forEach((subSchema: any) => {
                this.collectTypesFromSchema(subSchema, usedTypes);
            });
        }

        if (schema.anyOf) {
            schema.anyOf.forEach((subSchema: any) => {
                this.collectTypesFromSchema(subSchema, usedTypes);
            });
        }
    }

    private collectTypesFromRequestBody(requestBody: RequestBody, usedTypes: Set<string>): void {
        const content = requestBody.content || {};
        Object.values(content).forEach(mediaType => {
            if (mediaType.schema) {
                this.collectTypesFromSchema(mediaType.schema, usedTypes);
            }
        });
    }

    private collectTypesFromResponse(response: Response, usedTypes: Set<string>): void {
        const content = response.content || {};
        Object.values(content).forEach(mediaType => {
            if (mediaType.schema) {
                this.collectTypesFromSchema(mediaType.schema, usedTypes);
            }
        });
    }

    private addImports(sourceFile: SourceFile, usedTypes: Set<string>): void {
        sourceFile.addImportDeclarations([
            {
                namedImports: ['Injectable', "inject"],
                moduleSpecifier: '@angular/core',
            },
            {
                namedImports: ['HttpClient', 'HttpParams', 'HttpHeaders', 'HttpContext', 'HttpResponse', 'HttpEvent'],
                moduleSpecifier: '@angular/common/http',
            },
            {
                namedImports: ['Observable'],
                moduleSpecifier: 'rxjs',
            },
            {
                namedImports: ['BASE_PATH'],
                moduleSpecifier: '../tokens',
            },
        ]);

        // Add specific model imports only if types are used
        if (usedTypes.size > 0) {
            sourceFile.addImportDeclaration({
                namedImports: Array.from(usedTypes).sort(),
                moduleSpecifier: '../models',
            });
        }
    }

    private addServiceClass(sourceFile: SourceFile, controllerName: string, operations: PathInfo[]): void {
        const className = `${controllerName}Service`;

        sourceFile.insertText(0, SERVICE_GENERATOR_HEADER_COMMENT(controllerName));

        const serviceClass = sourceFile.addClass({
            name: className,
            isExported: true,
            decorators: [{name: 'Injectable', arguments: ['{ providedIn: "root" }']}],
        });

        serviceClass.addMember({
            name: "httpClient",
            type: "HttpClient",
            scope: Scope.Private,
            isReadonly: true,
            initializer: "inject(HttpClient)",
            kind: StructureKind.Property
        })

        serviceClass.addMember({
            name: "basePath",
            type: "string",
            scope: Scope.Private,
            isReadonly: true,
            initializer: "inject(BASE_PATH)",
            kind: StructureKind.Property
        })

        // Generate methods for each operation
        operations.forEach(operation => {
            addServiceMethod(serviceClass, operation);
        });
    }
}