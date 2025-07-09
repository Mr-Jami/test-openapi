#!/usr/bin/env node;

import {Command} from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import {generateFromSwagger} from "./core";

const program = new Command();

program
    .name('my-ng-client-generator')
    .description('Generate Angular services and types from Swagger/OpenAPI spec')
    .version('1.0.0');

program
    .command('generate')
    .alias('gen')
    .description('Generate code from Swagger specification')
    .requiredOption('-i, --input <path>', 'Path to Swagger/OpenAPI specification file')
    .option('-o, --output <path>', 'Output directory', './src/generated')
    .option('--types-only', 'Generate only TypeScript interfaces')
    .option('--services-only', 'Generate only Angular services')
    .option('--config <path>', 'Path to configuration file')
    .action((options) => {
        try {
            const inputPath = path.resolve(options.input);

            if (!fs.existsSync(inputPath)) {
                console.error(`Error: Input file not found: ${inputPath}`);
                process.exit(1);
            }

            let config = {};
            if (options.config) {
                const configPath = path.resolve(options.config);
                if (fs.existsSync(configPath)) {
                    config = require(configPath);
                }
            }

            const generatorOptions = {
                generateTypes: !options.servicesOnly,
                generateServices: !options.typesOnly,
                config: {
                    ...config,
                    output: {
                        types: path.join(options.output, 'models/index.ts'),
                        services: path.join(options.output, 'services'),
                    },
                },
            };

            generateFromSwagger(inputPath, generatorOptions);
        } catch (error) {
            console.error('Generation failed:', error);
            process.exit(1);
        }
    });

program.parse();