declare const ENV: string;
declare const HMR: boolean;

declare let module: {
	hot?: {
		accept: () => void;
		dispose: (callback: () => void) => void;
	};
};

declare function require(moduleName: string): any;

declare module "zone.js/plugins/long-stack-trace-zone";

interface ErrorConstructor {
	stackTraceLimit: number;
}
