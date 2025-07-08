import * as path from 'path';
import { TypeGenerator } from './type-generator';
import { ServiceGenerator } from './service-generator';
import { Project } from 'ts-morph';
import {ServiceIndexGenerator} from "./service-indes-generator";

export interface GeneratorOptions {
    generateTypes?: boolean;
    generateServices?: boolean;
    typesOutput?: string;
    servicesOutput?: string;
}

export function generateFromSwagger(
    swaggerPath: string,
    options: GeneratorOptions = {}
): void {
    const {
        generateTypes = true,
        generateServices = true,
        typesOutput = './src/generated/models/index.ts',
        servicesOutput = './src/generated/services',
    } = options;

    try {
        console.log('Starting generation from Swagger spec...');

        const project = new Project({
            compilerOptions: {
                declaration: true,
                target: 2, // ES2015
                module: 1, // CommonJS
                strict: true,
            },
        });

        if (generateTypes) {
            console.log('Generating TypeScript interfaces...');
            const typeGenerator = new TypeGenerator(swaggerPath, typesOutput);
            typeGenerator.generate();
            console.log(`✅ TypeScript interfaces generated at: ${typesOutput}`);
        }

        if (generateServices) {
            console.log('Generating Angular services...');
            const serviceGenerator = new ServiceGenerator(swaggerPath, project);
            serviceGenerator.generate(servicesOutput);
            console.log(`✅ Angular services generated at: ${servicesOutput}`);
        }

        if (generateServices) {
            console.log('Generating Angular services...');
            const serviceGenerator = new ServiceGenerator(swaggerPath, project);
            serviceGenerator.generate(servicesOutput);

            // Generate index file
            const indexGenerator = new ServiceIndexGenerator(project);
            indexGenerator.generateIndex(servicesOutput);

            console.log(`✅ Angular services generated at: ${servicesOutput}`);
        }


        console.log('🎉 Generation completed successfully!');
    } catch (error) {
        console.error('❌ Error during generation:', error);
        process.exit(1);
    }
}

// If running directly
if (require.main === module) {
    const swaggerPath = process.argv[2] || './swagger.json';

    generateFromSwagger(swaggerPath, {
        generateTypes: true,
        generateServices: true,
        typesOutput: './src/generated/models/index.ts',
        servicesOutput: './src/generated/services',
    });
}