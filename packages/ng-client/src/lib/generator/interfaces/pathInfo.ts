import {Parameter} from "./parameter";
import {RequestBody} from "./requestBody";
import {Response} from "./response";

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