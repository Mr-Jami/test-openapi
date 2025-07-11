import {ModuleKind, Project, ScriptTarget} from "ts-morph";
import {GENERATOR_CONFIG} from "../config";
import {TypeGenerator} from "../generators";
import {DateTransformerGenerator, FileDownloadGenerator, TokenGenerator} from "../generators/utility";
import {ServiceGenerator, ServiceIndexGenerator} from "../generators/service";

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
                target: ScriptTarget.ES2022,
                module: ModuleKind.Preserve,
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

            // Generate date transformer if enabled
            if (GENERATOR_CONFIG.options.dateType === 'Date') {
                const dateTransformer = new DateTransformerGenerator(project);
                dateTransformer.generate(servicesOutput);
                console.log(`✅ Date transformer generated`);
            }

            // Generate file download helper
            const fileDownloadHelper = new FileDownloadGenerator(project);
            fileDownloadHelper.generate(servicesOutput);
            console.log(`✅ File download helper generated`);

            const serviceGenerator = new ServiceGenerator(swaggerPath, project);
            serviceGenerator.generate(servicesOutput);

            // Generate index file
            const indexGenerator = new ServiceIndexGenerator(project);
            indexGenerator.generateIndex(servicesOutput);

            console.log(`✅ Angular services generated at: ${servicesOutput}`);
        }

        console.log('🎉 Generation completed successfully!');
    } catch (error) {
        if (error instanceof Error) {
            console.error('❌ Error during generation:', error.message);
        } else {
            console.error('❌ Unknown error during generation:', error);
        }
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