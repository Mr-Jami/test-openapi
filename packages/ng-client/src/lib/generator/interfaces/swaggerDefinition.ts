import {ExternalDocs, ParameterType, XML} from "swagger-schema-official";

export interface SwaggerDefinition {
    type?: ParameterType | undefined;
    format?: string | undefined;
    title?: string | undefined;
    description?: string | undefined;
    default?: any;
    multipleOf?: number | undefined;
    maximum?: number | undefined;
    exclusiveMaximum?: boolean | undefined;
    minimum?: number | undefined;
    exclusiveMinimum?: boolean | undefined;
    maxLength?: number | undefined;
    minLength?: number | undefined;
    pattern?: string | undefined;
    maxItems?: number | undefined;
    minItems?: number | undefined;
    uniqueItems?: boolean | undefined;
    maxProperties?: number | undefined;
    minProperties?: number | undefined;
    enum?: any[] | undefined;
    items?: SwaggerDefinition | SwaggerDefinition[] | undefined;
    $ref?: string | undefined;
    allOf?: SwaggerDefinition[] | undefined;
    additionalProperties?: SwaggerDefinition | boolean | undefined;
    properties?: { [propertyName: string]: SwaggerDefinition } | undefined;
    discriminator?: string | undefined;
    readOnly?: boolean | undefined;
    nullable?: boolean | undefined;
    xml?: XML | undefined;
    externalDocs?: ExternalDocs | undefined;
    example?: any;
    required?: string[] | undefined;
    oneOf?: SwaggerDefinition[];
    anyOf?: SwaggerDefinition[];
}