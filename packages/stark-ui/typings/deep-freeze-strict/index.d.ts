declare module "deep-freeze-strict" {
	function deepFreeze<T>(value: T): T;
	export = deepFreeze;
}
