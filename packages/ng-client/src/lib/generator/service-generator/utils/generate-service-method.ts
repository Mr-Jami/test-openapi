import {ClassDeclaration} from "ts-morph";
import {PathInfo} from "../../interfaces/pathInfo";
import {GENERATOR_CONFIG} from "../../GENERATOR_CONFIG";
import {camelCase} from "../../utils/camelCase";
import {pascalCase} from "../../utils/pascalCase";
import {getTypeScriptType} from "../../utils/getTypeScriptType";
import {RequestBody} from "../../interfaces/requestBody";
import {Response} from "../../interfaces/response";
import {generateMethodBody} from "./generate-service-method-body";
import {generateMethodOverloads} from "./generate-service-method-overloads";
import {generateMethodParameters} from "./generate-service-method-params";

export function addServiceMethod(serviceClass: ClassDeclaration, operation: PathInfo): void {
    const methodName = generateMethodName(operation);
    const parameters = generateMethodParameters(operation);
    const returnType = generateReturnType();
    const methodBody = generateMethodBody(operation, parameters);
    const methodOverLoads = generateMethodOverloads(parameters, operation);

    serviceClass.addMethod({
        name: methodName,
        parameters: parameters,
        returnType: returnType,
        statements: methodBody,
        overloads: methodOverLoads,
    });
}

export function generateMethodName(operation: PathInfo): string {
    if (operation.operationId) {
        const regex = new RegExp(`^(\\w+)${GENERATOR_CONFIG.options.operationIdSeparator}`);
        const name = operation.operationId.replace(regex, '');
        return camelCase(name);
    }

    const method = operation.method.toLowerCase();
    const pathParts = operation.path.split('/').filter(p => p && !p.startsWith('{'));
    const resource = pathParts[pathParts.length - 1] || 'resource';

    return `${method}${pascalCase(resource)}`;
}

export function generateReturnType(): string {
    return 'Observable<any>';
}

export function getRequestBodyType(requestBody: RequestBody): string {
    const content = requestBody.content || {};
    const jsonContent = content['application/json'];

    if (jsonContent?.schema) {
        return getTypeScriptType(jsonContent.schema, jsonContent.schema.nullable);
    }

    return 'any';
}

export function getResponseType(response: Response): string {
    const content = response.content || {};

    // Check all content types for binary format
    for (const [contentType, mediaType] of Object.entries(content)) {
        if (mediaType?.schema?.format === 'binary') {
            return 'Blob';
        }
    }

    // Check for JSON content (non-binary)
    const jsonContent = content['application/json'] || content['text/json'];
    if (jsonContent?.schema) {
        return getTypeScriptType(jsonContent.schema, jsonContent.schema.nullable);
    }

    return 'any';
}

export function isBlobResponse(operation: PathInfo): boolean {
    // Check all success response codes
    const successResponses = ['200', '201', '202', '204'];

    for (const statusCode of successResponses) {
        const response = operation.responses?.[statusCode];
        if (!response?.content) {
            continue;
        }

        const content = response.content;

        // Check all content types for binary format
        for (const [contentType, mediaType] of Object.entries(content)) {
            if (mediaType?.schema?.format === 'binary') {
                return true;
            }
        }
    }

    return false;
}

export function getFormDataFields(operation: PathInfo): string[] {
    if (!isMultipartFormData(operation)) {
        return [];
    }

    const properties = operation.requestBody?.content?.["multipart/form-data"]?.schema?.properties || {};
    return Object.keys(properties);
}

export function isMultipartFormData(operation: PathInfo): boolean {
    return !!(operation.requestBody?.content?.["multipart/form-data"]);
}