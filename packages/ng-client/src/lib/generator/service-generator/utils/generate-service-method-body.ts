import {PathInfo} from "../../interfaces/pathInfo";
import {getFormDataFields, isBlobResponse, isMultipartFormData} from "./generate-service-method";

export function generateMethodBody(operation: PathInfo): string {
    const pathParams = operation.parameters?.filter(p => p.in === 'path') || [];
    const queryParams = operation.parameters?.filter(p => p.in === 'query') || [];
    const hasBody = !!operation.requestBody;
    const isMultipart = isMultipartFormData(operation);
    const formDataFields = getFormDataFields(operation);
    const isBlob = isBlobResponse(operation);

    let body = '';

    // Build URL
    let urlExpression = `\`\${this.basePath}${operation.path}\``;
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
${queryParams.map(param =>
            `if (${param.name} !== undefined) {
  params = params.set('${param.name}', String(${param.name}));
}`).join('\n')}`;
    }

    // Handle multipart form data
    if (isMultipart && formDataFields.length > 0) {
        body += `
const formData = new FormData();
${formDataFields.map(field => {
            const fieldSchema = operation.requestBody?.content?.["multipart/form-data"]?.schema?.properties?.[field];
            const isFile = fieldSchema?.type === 'string' && fieldSchema?.format === 'binary';

            if (isFile) {
                return `if (${field} !== undefined) {
  formData.append('${field}', ${field});
}`;
            } else {
                return `if (${field} !== undefined) {
  formData.append('${field}', String(${field}));
}`;
            }
        }).join('\n')}`;
    }

    // Build request options
    if (hasBody) {
        if (isMultipart) {
            body += `
const requestOptions = {
  ...options,${queryParams.length > 0 ? '\n  params,' : ''}
  body: formData,${isBlob ? '\n  responseType: "blob" as "json",' : ''}
};
`;
        } else {
            body += `
const requestOptions = {
  ...options,${queryParams.length > 0 ? '\n  params,' : ''}
  body: body,${isBlob ? '\n  responseType: "blob" as "json",' : ''}
};
`;
        }
    } else {
        body += `
const requestOptions = {
  ...options,${queryParams.length > 0 ? '\n  params,' : ''}${isBlob ? '\n  responseType: "blob" as "json",' : ''}
};
`;
    }

    // Make HTTP request
    const httpMethod = operation.method.toLowerCase();

    body += `
return this.httpClient.${httpMethod}(url, requestOptions);`;

    return body;
}