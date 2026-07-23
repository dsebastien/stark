import { vi, type MockInstance } from "vitest";

type Procedure = (...args: any[]) => any;
type MockedMethod<T> = T extends Procedure ? MockInstance<T> & T : T;

export type VitestMock<T extends Procedure = Procedure> = MockInstance<T> & T;
export type VitestMockObject<T extends object> = { [K in keyof T]: MockedMethod<T[K]> };

export function createMockFn<T extends Procedure>(implementation?: T): VitestMock<T> {
	return (implementation ? vi.fn<T>(implementation) : vi.fn<T>()) as VitestMock<T>;
}

export function createMockObject<T extends object>(methodNames: Array<keyof T & string>): VitestMockObject<T> {
	const mockObject: Record<string, MockInstance<Procedure>> = {};

	for (const methodName of methodNames) {
		mockObject[methodName] = vi.fn();
	}

	return mockObject as unknown as VitestMockObject<T>;
}
