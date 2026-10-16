import { StarkToastNotificationService } from "@nationalbankbelgium/stark-ui";
import { vi } from "vitest";

/**
 * Mock class of the {@link StarkToastNotificationService} interface.
 */
export class MockStarkToastNotificationService {
	/**
	 * See [StarkToastNotificationService show()]{@link StarkToastNotificationService#show} method
	 */
	public show = vi.fn<StarkToastNotificationService["show"]>();

	/**
	 * See [StarkToastNotificationService hide()]{@link StarkToastNotificationService#hide} method
	 */
	public hide = vi.fn<StarkToastNotificationService["hide"]>();
}
