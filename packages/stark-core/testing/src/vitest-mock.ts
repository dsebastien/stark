import { vi, type MockInstance } from "vitest";

type Procedure = (...args: never[]) => unknown;
type MockedMethod<T> = T extends Procedure ? MockInstance<T> & T : T;

export type VitestMock<T extends Procedure = Procedure> = MockInstance<T> & T;
export type VitestMockObject<T extends object> = { [K in keyof T]: MockedMethod<T[K]> };

/**
 * Create a typed Vitest function mock.
 * @param implementation - Optional implementation invoked by the mock.
 */
export function createMockFn<T extends Procedure>(implementation?: T): VitestMock<T> {
	return implementation ? vi.fn<T>(implementation) : vi.fn<T>();
}

/**
 * Create an object whose named methods are typed Vitest function mocks.
 * @param methodNames - Names of the methods to mock.
 */
export function createMockObject<T extends object>(methodNames: Array<keyof T & string>): VitestMockObject<T> {
	const mockObject: Record<string, MockInstance<Procedure>> = {};

	for (const methodName of methodNames) {
		mockObject[methodName] = vi.fn();
	}

	return <VitestMockObject<T>>(<unknown>mockObject);
}
