export interface RequestBody {
    required?: boolean;
    content?: Record<string, { schema?: any }>;
}