declare const ENV: string;
declare module "zone.js/plugins/long-stack-trace-zone";

interface ErrorConstructor {
	stackTraceLimit: number;
}
