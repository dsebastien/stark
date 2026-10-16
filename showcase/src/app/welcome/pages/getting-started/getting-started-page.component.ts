import { Component } from "@angular/core";
import {
	polyfillsAngularJsonAdaptation,
	polyfillsBrowsersContent,
	starkStylesCss,
	starterStructure,
	stylesCss,
	stylesheetImport
} from "./starter-structure";

@Component({
	standalone: false,
	// eslint-disable-next-line @angular-eslint/component-selector
	selector: "getting-started",
	templateUrl: "./getting-started-page.component.html"
})
export class GettingStartedPageComponent {
	public stylesheetImport: string = stylesheetImport;
	public structure: string = starterStructure;
	public stylesCSS: string = stylesCss;
	public starkStylesCSS: string = starkStylesCss;
	public polyfillsBrowsersContent: string = polyfillsBrowsersContent;
	public polyfillsAngularJsonAdaptation: string = polyfillsAngularJsonAdaptation;

	public installingProject =
		"# --depth 1 removes all but one .git commit history\ngit clone --depth 1 https://github.com/NationalBankBelgium/stark.git";
	public runningHMR = "npm run server:dev:hmr";
	public runningProject = "npm run server:prod";
	public buildFiles = "# development\nnpm run build:dev\n\n# production\nnpm run build:prod";
	public watchMode = "npm run watch";
	public unitTestRunning = "npm run test-fast";
	public watchAndRunTests = "npm run watch:test";
	public continuousIntegrationTests = "# this runs linting, Vitest unit tests, and the production build\nnpm run ci";
	public installType = "npm install @types/node\nnpm install @types/lodash";
	public moduleDeclaration = 'declare module "my-module" {\n\texport function doesSomething(value: string): string;\n}';
	public prototyping = "declare var assert: any;\ndeclare var _: any;\ndeclare var $: any;";
	public moduleImport = 'import * as _ from "lodash";';
}
