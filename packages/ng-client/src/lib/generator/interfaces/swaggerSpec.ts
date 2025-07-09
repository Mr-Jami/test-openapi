import {SwaggerDefinition} from "./swaggerDefinition";
import {BodyParameter, ExternalDocs, Info, Path, QueryParameter, Security, Tag} from "swagger-schema-official";

export interface SwaggerSpec {
    swagger: string;
    info: Info;
    externalDocs?: ExternalDocs | undefined;
    host?: string | undefined;
    basePath?: string | undefined;
    schemes?: string[] | undefined;
    consumes?: string[] | undefined;
    produces?: string[] | undefined;
    paths: { [pathName: string]: Path };
    definitions?: { [definitionsName: string]: SwaggerDefinition } | undefined;
    parameters?: { [parameterName: string]: BodyParameter | QueryParameter } | undefined;
    responses?: { [responseName: string]: Response } | undefined;
    security?: Array<{ [securityDefinitionName: string]: string[] }> | undefined;
    securityDefinitions?: { [securityDefinitionName: string]: Security } | undefined;
    tags?: Tag[] | undefined;
    components?: {
        schemas?: Record<string, SwaggerDefinition>;
    }
}