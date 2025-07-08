import {ClassDeclaration, Project, Scope, SourceFile} from 'ts-morph';
import {SwaggerParser, SwaggerSpec} from './swagger-parser';
import * as path from 'path';

export interface PathInfo {
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
    description?: string;
    tags?: string[];
    parameters?: Parameter[];
    requestBody?: RequestBody;
    responses?: Record<string, Response>;
}

export interface Parameter {
    name: string;
    in: 'query' | 'path' | 'header' | 'cookie';
    required?: boolean;
    schema?: any;
    type?: string;
    format?: string;
    description?: string;
}

export interface RequestBody {
    required?: boolean;
    content?: Record<string, { schema?: any }>;
}

export interface Response {
    description?: string;
    content?: Record<string, { schema?: any }>;
}

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
                const match = path.operationId.match(/^(\w+)Controller_/);
                if (match) {
                    controllerName = match[1];
                }
            } else {
                // Extract from path (e.g., "/api/users/{id}" -> "Users")
                const pathParts = path.path.split('/').filter(p => p && !p.startsWith('{'));
                if (pathParts.length > 1) {
                    controllerName = this.pascalCase(pathParts[1]);
                }
            }

            controllerName = this.pascalCase(controllerName);

            if (!groups[controllerName]) {
                groups[controllerName] = [];
            }
            groups[controllerName].push(path);
        });

        return groups;
    }

    private generateServiceFile(controllerName: string, operations: PathInfo[], outputDir: string): void {
        const fileName = `${this.kebabCase(controllerName)}.service.ts`;
        const filePath = path.join(outputDir, fileName);

        const sourceFile = this.project.createSourceFile(filePath, '', { overwrite: true });

        this.addImports(sourceFile);
        this.addServiceClass(sourceFile, controllerName, operations);

        sourceFile.saveSync();
    }

    private addImports(sourceFile: SourceFile): void {
        sourceFile.addImportDeclarations([
            {
                namedImports: ['Injectable'],
                moduleSpecifier: '@angular/core',
            },
            {
                namedImports: ['HttpClient', 'HttpParams', 'HttpHeaders'],
                moduleSpecifier: '@angular/common/http',
            },
            {
                namedImports: ['Observable'],
                moduleSpecifier: 'rxjs',
            },
            {
                namespaceImport: 'Models',
                moduleSpecifier: '../models',
            },
        ]);
    }

    private addServiceClass(sourceFile: SourceFile, controllerName: string, operations: PathInfo[]): void {
        const className = `${controllerName}Service`;

/*        sourceFile.addText(`
/!**
 * Generated Angular service for ${controllerName} controller
 * Do not edit this file manually
 *!/

`);*/

        const serviceClass = sourceFile.addClass({
            name: className,
            isExported: true,
            decorators: [{ name: 'Injectable', arguments: ['{ providedIn: "root" }'] }],
        });

        // Add constructor
        serviceClass.addConstructor({
            parameters: [
                {
                    name: 'http',
                    type: 'HttpClient',
                    scope: Scope.Private,
                    isReadonly: true,
                },
            ],
        });

        // Add base URL property
        serviceClass.addProperty({
            name: 'baseUrl',
            type: 'string',
            scope: Scope.Private,
            initializer: "'/api'", // Default base URL, can be configured
        });

        // Generate methods for each operation
        operations.forEach(operation => {
            this.addServiceMethod(serviceClass, operation);
        });
    }

    private addServiceMethod(serviceClass: ClassDeclaration, operation: PathInfo): void {
        const methodName = this.generateMethodName(operation);
        const parameters = this.generateMethodParameters(operation);
        const returnType = this.generateReturnType(operation);
        const methodBody = this.generateMethodBody(operation);

        serviceClass.addMethod({
            name: methodName,
            parameters,
            returnType,
            statements: methodBody,
            docs: this.generateMethodDocs(operation),
        });
    }

    private generateMethodName(operation: PathInfo): string {
        if (operation.operationId) {
            // Remove controller prefix if present
            const name = operation.operationId.replace(/^\w+Controller_/, '');
            return this.camelCase(name);
        }

        const method = operation.method.toLowerCase();
        const pathParts = operation.path.split('/').filter(p => p && !p.startsWith('{'));
        const resource = pathParts[pathParts.length - 1] || 'resource';

        return `${method}${this.pascalCase(resource)}`;
    }

    private generateMethodParameters(operation: PathInfo): any[] {
        const params: any[] = [];

        // Path parameters
        const pathParams = operation.parameters?.filter(p => p.in === 'path') || [];
        pathParams.forEach(param => {
            params.push({
                name: param.name,
                type: this.getTypeScriptType(param.schema || param),
                hasQuestionToken: !param.required,
            });
        });

        // Request body
        if (operation.requestBody) {
            const bodyType = this.getRequestBodyType(operation.requestBody);
            params.push({
                name: 'body',
                type: bodyType,
                hasQuestionToken: !operation.requestBody.required,
            });
        }

        // Query parameters
        const queryParams = operation.parameters?.filter(p => p.in === 'query') || [];
        if (queryParams.length > 0) {
            const queryType = this.generateQueryParamsInterface(queryParams);
            params.push({
                name: 'queryParams',
                type: queryType,
                hasQuestionToken: true,
            });
        }

        // Options parameter
        params.push({
            name: 'options',
            type: '{ headers?: HttpHeaders; observe?: "body"; responseType?: "json" }',
            hasQuestionToken: true,
        });

        return params;
    }

    private generateQueryParamsInterface(queryParams: Parameter[]): string {
        const properties = queryParams.map(param => {
            const optional = param.required ? '' : '?';
            const type = this.getTypeScriptType(param.schema || param);
            return `${param.name}${optional}: ${type}`;
        }).join('; ');

        return `{ ${properties} }`;
    }

    private generateReturnType(operation: PathInfo): string {
        const response = operation.responses?.['200'] || operation.responses?.['201'] || operation.responses?.['204'];

        if (!response) {
            return 'Observable<any>';
        }

        const responseType = this.getResponseType(response);
        return `Observable<${responseType}>`;
    }

    private generateMethodBody(operation: PathInfo): string {
        const pathParams = operation.parameters?.filter(p => p.in === 'path') || [];
        const queryParams = operation.parameters?.filter(p => p.in === 'query') || [];
        const hasBody = !!operation.requestBody;

        let body = '';

        // Build URL
        let urlExpression = `\`\${this.baseUrl}${operation.path}\``;
        if (pathParams.length > 0) {
            pathParams.forEach(param => {
                urlExpression = urlExpression.replace(`{${param.name}}`, `\${${param.name}}`);
            });
        }

        body += `const url = ${urlExpression};\n`;

        // Build query params
        if (queryParams.length > 0) {
            body += `
let params = new HttpParams();
if (queryParams) {
${queryParams.map(param =>
                `  if (queryParams.${param.name} !== undefined) {
    params = params.set('${param.name}', String(queryParams.${param.name}));
  }`
            ).join('\n')}
}
`;
        }

        // Build request options
        body += `
const requestOptions = {
  ...options,${queryParams.length > 0 ? '\n  params,' : ''}
};
`;

        // Make HTTP request
        const httpMethod = operation.method.toLowerCase();
        if (hasBody) {
            body += `
return this.http.${httpMethod}<${this.generateReturnType(operation).replace('Observable<', '').replace('>', '')}>(url, body, requestOptions);`;
        } else {
            body += `
return this.http.${httpMethod}<${this.generateReturnType(operation).replace('Observable<', '').replace('>', '')}>(url, requestOptions);`;
        }

        return body;
    }

    private generateMethodDocs(operation: PathInfo): string[] {
        const docs: string[] = [];

        if (operation.summary) {
            docs.push(operation.summary);
        }

        if (operation.description) {
            docs.push(operation.description);
        }

        if (operation.parameters) {
            operation.parameters.forEach(param => {
                docs.push(`@param ${param.name} ${param.description || ''}`);
            });
        }

        return docs;
    }

    private getRequestBodyType(requestBody: RequestBody): string {
        const content = requestBody.content || {};
        const jsonContent = content['application/json'];

        if (jsonContent?.schema) {
            return this.getTypeScriptType(jsonContent.schema);
        }

        return 'any';
    }

    private getResponseType(response: Response): string {
        const content = response.content || {};
        const jsonContent = content['application/json'];

        if (jsonContent?.schema) {
            return this.getTypeScriptType(jsonContent.schema);
        }

        return 'any';
    }

    private getTypeScriptType(schema: any): string {
        if (!schema) return 'any';

        if (schema.$ref) {
            const refName = schema.$ref.split('/').pop();
            return `Models.${this.pascalCase(refName)}`;
        }

        if (schema.type === 'array') {
            const itemType = this.getTypeScriptType(schema.items);
            return `${itemType}[]`;
        }

        switch (schema.type) {
            case 'string':
                return 'string';
            case 'number':
            case 'integer':
                return 'number';
            case 'boolean':
                return 'boolean';
            case 'object':
                return 'any';
            default:
                return 'any';
        }
    }

    private pascalCase(str: string): string {
        return str.replace(/(?:^|[-_])([a-z])/g, (_, char) => char.toUpperCase());
    }

    private camelCase(str: string): string {
        return str.replace(/[-_]([a-z])/g, (_, char) => char.toUpperCase());
    }

    private kebabCase(str: string): string {
        return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    }
}