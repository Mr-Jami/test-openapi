import * as path from 'path';
import { TypeGenerator } from './type-generator';

export function generateTypesFromSwagger(
    swaggerPath: string,
    outputPath: string = './src/generated/models/index.ts'
): void {
    try {
        console.log('Starting TypeScript generation from Swagger spec...');

        const generator = new TypeGenerator(swaggerPath, outputPath);
        generator.generate();

        console.log(`✅ TypeScript interfaces generated successfully at: ${outputPath}`);
    } catch (error) {
        console.error('❌ Error generating TypeScript interfaces:', error);
        process.exit(1);
    }
}

// If running directly
if (require.main === module) {
    const swaggerPath = process.argv[2] || './swagger.json';
    const outputPath = process.argv[3] || './src/generated/models/index.ts';

    generateTypesFromSwagger(swaggerPath, outputPath);
}