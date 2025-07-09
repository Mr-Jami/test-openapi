import {TypeGenerator} from './type-generator';
import {ServiceGenerator} from './service-generator/service-generator';
import {ModuleKind, Project, ScriptTarget} from 'ts-morph';
import {ServiceIndexGenerator} from "./service-generator/service-index-generator";
import {TokenGenerator} from "./token-generator";
import {GENERATOR_CONFIG} from "./GENERATOR_CONFIG";

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
        const project = new Project({
            compilerOptions: {
                declaration: true,
                target: ScriptTarget.ES2022, // default angular target
                module: ModuleKind.Preserve, // default angular module
                strict: true,
                ...GENERATOR_CONFIG.compilerOptions
            },
        });

        if (generateTypes) {
            const typeGenerator = new TypeGenerator(swaggerPath, typesOutput);
            typeGenerator.generate();
            console.log(`✅ TypeScript interfaces generated at: ${typesOutput}`);
        }

        if (generateServices) {
            // Generate tokens first
            const tokenGenerator = new TokenGenerator(project);
            tokenGenerator.generate(servicesOutput);

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