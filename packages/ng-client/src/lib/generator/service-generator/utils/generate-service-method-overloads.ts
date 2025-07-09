import {getResponseType} from "./generate-service-method";
import {PathInfo} from "../../interfaces/pathInfo";
import {MethodDeclarationOverloadStructure, OptionalKind, ParameterDeclarationStructure} from "ts-morph";
import {generateApiParameters} from "./generate-service-method-params";

export function generateMethodOverloads(parameters: any[], operation: PathInfo): OptionalKind<MethodDeclarationOverloadStructure>[] {
    const observeTypes: ("body" | "response" | "events")[] = ['body', 'response', 'events'];
    const overloads: OptionalKind<MethodDeclarationOverloadStructure>[] = [];
    observeTypes.forEach(observe => {
        const overload = generateMethodOverload(operation, observe);
        if (overload) {
            overloads.push(overload);
        }
    });
    return overloads;
}

export function generateMethodOverload(operation: PathInfo, observe: "body" | "response" | "events"): OptionalKind<MethodDeclarationOverloadStructure> {
    const responseType = generateOverloadResponseType(operation);
    const params = generateOverloadParameters(operation, observe, responseType === "Blob" ? 'blob' : 'json'); //TODO: support other response types
    const returnType = generateOverloadReturnType(responseType, observe);
    return {
        parameters: params,
        returnType: returnType,
    }
}

export function generateOverloadParameters(operation: PathInfo, observe: "body" | "response" | "events", responseType: 'json' | 'arraybuffer' | 'blob' | 'text'): OptionalKind<ParameterDeclarationStructure>[] {
    const params = generateApiParameters(operation);
    const optionsParam = addOverloadOptionsParameter(observe, responseType);
    // Combine all parameters
    const combined = [...params, ...optionsParam];

    const seen = new Set<string>();
    const uniqueParams: OptionalKind<ParameterDeclarationStructure>[] = [];

    for (const param of combined) {
        if (!seen.has(param.name)) {
            seen.add(param.name);
            uniqueParams.push(param);
        }
    }

    return uniqueParams;
}

export function addOverloadOptionsParameter(observe: "body" | "response" | "events", responseType: 'json' | 'arraybuffer' | 'blob' | 'text'): OptionalKind<ParameterDeclarationStructure>[] {
    return [{
        name: 'observe',
        type: `'${observe}'`,
        hasQuestionToken: true
    }, {
        name: 'options',
        type: `{ headers?: HttpHeaders | { [header: string]: string | string[] }; params?: HttpParams | { [param: string]: string | string[] }; reportProgress?: boolean; responseType?: \'${responseType}\'; withCredentials?: boolean; context?: HttpContext; }`,
        hasQuestionToken: true,
    }];
}

export function generateOverloadResponseType(operation: PathInfo): string {
    const response = operation.responses?.['200'] || operation.responses?.['201'] || operation.responses?.['204'];

    if (!response) {
        return 'any';
    }

    return getResponseType(response);
}

export function generateOverloadReturnType(responseType: string, observe: "body" | "response" | "events"): string {
    switch (observe) {
        case 'body':
            return 'Observable<' + responseType + '>';
        case 'response':
            return 'Observable<HttpResponse<' + responseType + '>>';
        case 'events':
            return 'Observable<HttpEvent<' + responseType + '>>';
        default:
            throw new Error(`Unsupported observe type: ${observe}`);
    }
}