import {PathInfo} from "../../interfaces/pathInfo";
import {getTypeScriptType} from "../../utils/getTypeScriptType";
import {getRequestBodyType, getResponseType} from "./generate-service-method";
import {OptionalKind, ParameterDeclarationStructure} from "ts-morph";
import {camelCase} from "../../utils/camelCase";

export function generateMethodParameters(operation: PathInfo): OptionalKind<ParameterDeclarationStructure>[] {
    const params = generateApiParameters(operation);
    const optionsParam = addOptionsParameter(); //TODO: support other than json response type

    // Combine all parameters
    return [...params, ...optionsParam];
}

export function generateApiParameters(operation: PathInfo): OptionalKind<ParameterDeclarationStructure>[] {
    const params: any[] = [];

    // Path parameters
    const pathParams = operation.parameters?.filter(p => p.in === 'path') || [];
    pathParams.forEach(param => {
        params.push({
            name: param.name,
            type: getTypeScriptType(param.schema || param),
            hasQuestionToken: !param.required,
        });
    });

    // form parameters
    if (operation.requestBody && operation.requestBody?.content?.["multipart/form-data"]) {
        // For multipart/form-data, add individual parameters for each field
        Object.entries(operation.requestBody?.content?.["multipart/form-data"].schema?.properties ?? {}).forEach(([key, value]) => {
            params.push({
                name: key,
                type: getTypeScriptType(value, value.nullable),
                hasQuestionToken: !value.required,
            });
        })
    }

    // body parameters
    if (operation.requestBody && operation.requestBody?.content?.["application/json"]) {
        const bodyType = getRequestBodyType(operation.requestBody);
        params.push({
            name: camelCase(bodyType),
            type: bodyType,
            hasQuestionToken: !operation.requestBody.required,
        });
    }

    // Query parameters
    const queryParams = operation.parameters?.filter(p => p.in === 'query') || [];
    queryParams.forEach(param => {
        params.push({
            name: param.name,
            type: getTypeScriptType(param.schema || param),
            hasQuestionToken: !param.required,
        });
    });

    return params;
}

export function addOptionsParameter(responseType: 'json' | 'arraybuffer' | 'blob' | 'text' = 'json'): OptionalKind<ParameterDeclarationStructure>[] {
    return [{
        name: 'observe',
        type: `any`,
        initializer: "'body'"
    }, {
        name: 'options',
        type: `{ headers?: HttpHeaders | { [header: string]: string | string[] }; params?: HttpParams | { [param: string]: string | string[] }; reportProgress?: boolean; responseType?: \'${responseType}\'; withCredentials?: boolean; context?: HttpContext; }`,
        hasQuestionToken: true,
    }];
}

export function generateOverloadReturnType(operation: PathInfo): string {
    const response = operation.responses?.['200'] || operation.responses?.['201'] || operation.responses?.['204'];

    if (!response) {
        return 'Observable<any>';
    }

    const responseType = getResponseType(response);
    return `Observable<${responseType}>`;
}