import { StarkHttpService, StarkResource } from "@nationalbankbelgium/stark-core";
import { vi } from "vitest";

/**
 * Mock class of the {@link StarkHttpService} interface.
 */
export class MockStarkHttpService<T extends StarkResource> {
	/**
	 * See [StarkHttpService rawHttpClient]{@link StarkHttpService#rawHttpClient} property
	 */
	public readonly rawHttpClient = {
		request: vi.fn(),
		delete: vi.fn(),
		get: vi.fn(),
		head: vi.fn(),
		jsonp: vi.fn(),
		options: vi.fn(),
		patch: vi.fn(),
		post: vi.fn(),
		put: vi.fn()
	} as unknown as StarkHttpService<T>["rawHttpClient"];

	/**
	 * See [StarkHttpService executeSingleItemRequest()]{@link StarkHttpService#executeSingleItemRequest} method
	 */
	public executeSingleItemRequest = vi.fn<StarkHttpService<T>["executeSingleItemRequest"]>();

	/**
	 * See [StarkHttpService executeCollectionRequest()]{@link StarkHttpService#executeCollectionRequest} method
	 */
	public executeCollectionRequest = vi.fn<StarkHttpService<T>["executeCollectionRequest"]>();
}
