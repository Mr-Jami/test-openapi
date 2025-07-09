import {Project} from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import {SERVICE_INDEX_GENERATOR_HEADER_COMMENT} from "../constants";

export class ServiceIndexGenerator {
    private project: Project;

    constructor(project: Project) {
        this.project = project;
    }

    generateIndex(servicesDir: string): void {
        const indexPath = path.join(servicesDir, 'index.ts');
        const sourceFile = this.project.createSourceFile(indexPath, '', {overwrite: true});

        sourceFile.insertText(0, SERVICE_INDEX_GENERATOR_HEADER_COMMENT);

        // get all service files
        const serviceFiles = fs.readdirSync(servicesDir)
            .filter(file => file.endsWith('.service.ts'))
            .map(file => file.replace('.service.ts', ''));

        // Add exports
        serviceFiles.forEach(serviceName => {
            const className = this.pascalCase(serviceName) + 'Service';
            sourceFile.addExportDeclaration({
                namedExports: [className],
                moduleSpecifier: `./${serviceName}.service`,
            });
        });

        sourceFile.saveSync();
    }

    private pascalCase(str: string): string {
        return str.replace(/(?:^|[-_])([a-z])/g, (_, char) => char.toUpperCase());
    }
}