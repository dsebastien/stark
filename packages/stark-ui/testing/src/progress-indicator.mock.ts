import { StarkProgressIndicatorService } from "@nationalbankbelgium/stark-ui";
import { vi } from "vitest";

/**
 * Mock class of the {@link StarkProgressIndicatorService} interface.
 */
export class MockStarkProgressIndicatorService {
	/**
	 * See [StarkProgressIndicatorService register()]{@link StarkProgressIndicatorService#register} method
	 */
	public register = vi.fn<StarkProgressIndicatorService["register"]>();

	/**
	 * See [StarkProgressIndicatorService deregister()]{@link StarkProgressIndicatorService#deregister} method
	 */
	public deregister = vi.fn<StarkProgressIndicatorService["deregister"]>();

	/**
	 * See [StarkProgressIndicatorService show()]{@link StarkProgressIndicatorService#show} method
	 */
	public show = vi.fn<StarkProgressIndicatorService["show"]>();

	/**
	 * See [StarkProgressIndicatorService hide()]{@link StarkProgressIndicatorService#hide} method
	 */
	public hide = vi.fn<StarkProgressIndicatorService["hide"]>();

	/**
	 * See [StarkProgressIndicatorService isVisible()]{@link StarkProgressIndicatorService#isVisible} method
	 */
	public isVisible = vi.fn<StarkProgressIndicatorService["isVisible"]>();
}
