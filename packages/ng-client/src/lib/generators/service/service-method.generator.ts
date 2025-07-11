import {ClassDeclaration} from "ts-morph";
import {GENERATOR_CONFIG} from "../../config";
import {generateMethodBody, generateMethodOverloads, generateMethodParameters} from "./service-method";
import {GeneratorConfig, PathInfo, RequestBody, SwaggerResponse} from "../../types";
import {camelCase, getTypeScriptType, pascalCase} from "../../utils";

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
    if (GENERATOR_CONFIG.options.customizeMethodName){
        if (operation.operationId == null) {
            throw new Error(`Operation ID is required for method name customization of operation: (${operation.method}) ${operation.path}`);
        }
        return GENERATOR_CONFIG.options.customizeMethodName(operation.operationId);
    } else {
        return defaultNameGenerator(operation);
    }
}

export function generateReturnType(): string {
    return 'Observable<any>';
}

export function defaultNameGenerator(operation: PathInfo): string {
    if (operation.operationId) {
        return camelCase(operation.operationId);
    }

    const method = operation.method.toLowerCase();
    const pathParts = operation.path.split('/').filter(p => p && !p.startsWith('{'));
    const resource = pathParts[pathParts.length - 1] || 'resource';

    return `${method}${pascalCase(resource)}`;
}

export function getRequestBodyType(requestBody: RequestBody): string {
    const content = requestBody.content || {};
    const jsonContent = content['application/json'];

    if (jsonContent?.schema) {
        return getTypeScriptType(jsonContent.schema, jsonContent.schema.nullable);
    }

    return 'any';
}

export function isBlobResponse(operation: PathInfo): boolean {
    const successResponses = ['200', '201', '202', '204'];

    for (const statusCode of successResponses) {
        const response = operation.responses?.[statusCode];
        if (!response?.content) {
            continue;
        }

        for (const contentType of Object.keys(response.content)) {
            const responseType = getResponseTypeFromContentType(contentType, GENERATOR_CONFIG);
            if (responseType === 'blob') {
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

export function getResponseTypeFromResponse(response: SwaggerResponse, config?: GeneratorConfig): 'json' | 'blob' | 'arraybuffer' | 'text' {
    const content = response.content || {};

    // Check each content type and its schema
    for (const [contentType, mediaType] of Object.entries(content)) {
        const schema = mediaType?.schema;

        // Check custom mappings first
        const mapping = config?.options?.responseTypeMapping || {};
        if (mapping[contentType]) {
            return mapping[contentType];
        }

        // Check schema format for binary indication
        if (schema?.format === 'binary' || schema?.format === 'byte') {
            return 'blob';
        }

        // Check if schema type indicates binary
        if (schema?.type === 'string' && schema?.format === 'binary') {
            return 'blob';
        }

        // Generic content type detection
        return inferResponseTypeFromContentType(contentType);
    }

    return 'json'; // default
}

export function inferResponseTypeFromContentType(contentType: string): 'json' | 'blob' | 'arraybuffer' | 'text' {
    // Normalize content type (remove parameters like charset)
    const normalizedType = contentType.split(';')[0].trim().toLowerCase();

    // JSON types
    if (normalizedType.includes('json') || normalizedType === 'application/ld+json') {
        return 'json';
    }

    // Text types (but not text/plain with binary format - handled above)
    if (normalizedType.startsWith('text/') &&
        !normalizedType.includes('text/rtf') && // RTF is often better as blob
        !normalizedType.includes('text/cache-manifest')) { // Some text/* are binary
        return 'text';
    }

    // XML can be text or json depending on use case
    if (normalizedType.includes('xml')) {
        return 'text';
    }

    // Everything else is likely binary and should be blob
    // This includes:
    // - application/* (except json/xml)
    // - image/*
    // - audio/*
    // - video/*
    // - font/*
    // - model/*
    // - multipart/* (except multipart/form-data which is handled separately)
    return 'blob';
}

export function getResponseType(response: SwaggerResponse, config?: GeneratorConfig): string {
    const responseType = getResponseTypeFromResponse(response, config);

    // Map response types to TypeScript types
    switch (responseType) {
        case 'blob':
            return 'Blob';
        case 'arraybuffer':
            return 'ArrayBuffer';
        case 'text':
            return 'string';
        case 'json':
            // For JSON, check if we have a schema to get specific type
            const content = response.content || {};
            for (const [contentType, mediaType] of Object.entries(content)) {
                if (inferResponseTypeFromContentType(contentType) === 'json' && mediaType?.schema) {
                    return getTypeScriptType(mediaType.schema, mediaType.schema.nullable);
                }
            }
            return 'any';
        default:
            return 'any';
    }
}

// Update the old function to use the new logic
export function getResponseTypeFromContentType(contentType: string, config?: GeneratorConfig): 'json' | 'blob' | 'arraybuffer' | 'text' {
    // This function is kept for backward compatibility but now uses the new logic
    const mapping = config?.options?.responseTypeMapping || {};
    if (mapping[contentType]) {
        return mapping[contentType];
    }
    return inferResponseTypeFromContentType(contentType);
}