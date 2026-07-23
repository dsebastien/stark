declare module "deep-freeze-strict" {
	function deepFreeze<T>(value: T): T;
	// eslint-disable-next-line import/no-default-export -- Model the CommonJS package's default-import interop.
	export default deepFreeze;
}
