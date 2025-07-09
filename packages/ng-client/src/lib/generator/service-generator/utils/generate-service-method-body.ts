import { PathInfo } from "../../interfaces/pathInfo";
import { getFormDataFields, isBlobResponse, isMultipartFormData } from "./generate-service-method";

interface MethodGenerationContext {
    pathParams: Array<{ name: string; in: string }>;
    queryParams: Array<{ name: string; in: string }>;
    hasBody: boolean;
    isMultipart: boolean;
    formDataFields: string[];
    isBlob: boolean;
}

export function generateMethodBody(operation: PathInfo): string {
    const context = createGenerationContext(operation);

    const bodyParts = [
        generateUrlConstruction(operation, context),
        generateQueryParams(context),
        generateMultipartFormData(operation, context),
        generateRequestOptions(context),
        generateHttpRequest(operation)
    ];

    return bodyParts.filter(Boolean).join('\n');
}

function createGenerationContext(operation: PathInfo): MethodGenerationContext {
    return {
        pathParams: operation.parameters?.filter(p => p.in === 'path') || [],
        queryParams: operation.parameters?.filter(p => p.in === 'query') || [],
        hasBody: !!operation.requestBody,
        isMultipart: isMultipartFormData(operation),
        formDataFields: getFormDataFields(operation),
        isBlob: isBlobResponse(operation)
    };
}

function generateUrlConstruction(operation: PathInfo, context: MethodGenerationContext): string {
    let urlExpression = `\`\${this.basePath}${operation.path}\``;

    if (context.pathParams.length > 0) {
        context.pathParams.forEach(param => {
            urlExpression = urlExpression.replace(`{${param.name}}`, `\${${param.name}}`);
        });
    }

    return `const url = ${urlExpression};`;
}

function generateQueryParams(context: MethodGenerationContext): string {
    if (context.queryParams.length === 0) {
        return '';
    }

    const paramMappings = context.queryParams.map(param =>
        `if (${param.name} !== undefined) {
  params = params.set('${param.name}', String(${param.name}));
}`
    ).join('\n');

    return `
let params = new HttpParams();
${paramMappings}`;
}

function generateMultipartFormData(operation: PathInfo, context: MethodGenerationContext): string {
    if (!context.isMultipart || context.formDataFields.length === 0) {
        return '';
    }

    const formDataAppends = context.formDataFields.map(field => {
        const fieldSchema = operation.requestBody?.content?.["multipart/form-data"]?.schema?.properties?.[field];
        const isFile = fieldSchema?.type === 'string' && fieldSchema?.format === 'binary';

        const valueExpression = isFile ? field : `String(${field})`;

        return `if (${field} !== undefined) {
  formData.append('${field}', ${valueExpression});
}`;
    }).join('\n');

    return `
const formData = new FormData();
${formDataAppends}`;
}

function generateRequestOptions(context: MethodGenerationContext): string {
    const options = ['...options', 'observe: observe || "body"'];

    if (context.queryParams.length > 0) {
        options.push('params');
    }

    if (context.hasBody) {
        const bodyValue = context.isMultipart ? 'formData' : 'body';
        options.push(`body: ${bodyValue}`);
    }

    if (context.isBlob) {
        options.push('responseType: "blob" as "json"');
    }

    const formattedOptions = options.join(',\n  ');

    return `
const requestOptions = {
  ${formattedOptions}
};`;
}

function generateHttpRequest(operation: PathInfo): string {
    const httpMethod = operation.method.toLowerCase();
    return `
return this.httpClient.${httpMethod}(url, requestOptions);`;
}