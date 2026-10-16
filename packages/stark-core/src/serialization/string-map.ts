import { Deserialize, ISerializable, Serialize } from "cerialize";

type StringMapSerializerFactory = (targetType?: any) => ISerializable;

/**
 * Solution proposed by `@weichx` for Maps having string keys
 * in this way the custom behavior for handling ES6 Maps is defined once instead of doing it every time a Map is used.
 *
 * See:
 * - {@link https://github.com/weichx/cerialize/issues/32}
 * - {@link https://github.com/weichx/cerialize/issues/33}
 * @param targetType - Optional type used to deserialize each value.
 */
export const stringMap: StringMapSerializerFactory = (targetType?: any): ISerializable => ({
	Serialize: (map: Map<string, any>): Record<string, unknown> => {
		const obj: Record<string, unknown> = {};
		map.forEach((value: any, key: string) => {
			obj[key] = Serialize(value);
		});
		return obj;
	},

	Deserialize: (json: any): Map<string, any> => {
		const map: Map<string, any> = new Map<string, unknown>();
		for (const key of Object.keys(json)) {
			map.set(key, Deserialize(json[key], targetType));
		}
		return map;
	}
});
