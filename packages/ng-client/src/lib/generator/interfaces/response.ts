export interface Response {
    description?: string;
    content?: Record<string, { schema?: any }>;
}