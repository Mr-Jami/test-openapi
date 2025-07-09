export interface Parameter {
    name: string;
    in: 'query' | 'path' | 'header' | 'cookie';
    required?: boolean;
    schema?: any;
    type?: string;
    format?: string;
    description?: string;
}