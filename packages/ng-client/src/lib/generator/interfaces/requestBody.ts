import {SwaggerDefinition} from "./swaggerDefinition";

export interface RequestBody {
    required?: boolean;
    content?: Record<string, { schema?: SwaggerDefinition }>;
}