import { StarkMessagePaneService } from "@nationalbankbelgium/stark-ui";
import { vi } from "vitest";

/**
 * Mock class of the {@link StarkMessagePaneService} interface.
 */
export class MockStarkMessagePaneService {
	/**
	 * See [StarkMessagePaneService clearOnNavigation]{@link StarkMessagePaneService#clearOnNavigation} property
	 *
	 * Default: `false`.
	 */
	public clearOnNavigation = false;

	/**
	 * See [StarkMessagePaneService add()]{@link StarkMessagePaneService#add} method
	 */
	public add = vi.fn<StarkMessagePaneService["add"]>();

	/**
	 * See [StarkMessagePaneService addOne()]{@link StarkMessagePaneService#addOne} method
	 */
	public addOne = vi.fn<StarkMessagePaneService["addOne"]>();

	/**
	 * See [StarkMessagePaneService getAll()]{@link StarkMessagePaneService#getAll} method
	 */
	public getAll = vi.fn<StarkMessagePaneService["getAll"]>();

	/**
	 * See [StarkMessagePaneService remove()]{@link StarkMessagePaneService#remove} method
	 */
	public remove = vi.fn<StarkMessagePaneService["remove"]>();

	/**
	 * See [StarkMessagePaneService clearAll()]{@link StarkMessagePaneService#clearAll} method
	 */
	public clearAll = vi.fn<StarkMessagePaneService["clearAll"]>();
}
