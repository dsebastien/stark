import { StarkXSRFService } from "@nationalbankbelgium/stark-core";
import { vi } from "vitest";

/**
 * Mock class of the {@link StarkXSRFService} interface.
 */
export class MockStarkXsrfService {
	/**
	 * See [StarkXSRFService configureHttpRequest()]{@link StarkXSRFService#configureHttpRequest} method
	 */
	public configureHttpRequest = vi.fn<StarkXSRFService["configureHttpRequest"]>();

	/**
	 * See [StarkXSRFService configureXHR()]{@link StarkXSRFService#configureXHR} method
	 */
	public configureXHR = vi.fn<StarkXSRFService["configureXHR"]>();

	/**
	 * See [StarkXSRFService getXSRFToken(]{@link StarkXSRFService#getXSRFToken} method
	 */
	public getXSRFToken = vi.fn<StarkXSRFService["getXSRFToken"]>();

	/**
	 * See [StarkXSRFService pingBackends()]{@link StarkXSRFService#pingBackends} method
	 */
	public pingBackends = vi.fn<StarkXSRFService["pingBackends"]>();

	/**
	 * See [StarkXSRFService storeXSRFToken()]{@link StarkXSRFService#storeXSRFToken} method
	 */
	public storeXSRFToken = vi.fn<StarkXSRFService["storeXSRFToken"]>();
}
