import { StarkUserService } from "@nationalbankbelgium/stark-core";
import { vi } from "vitest";

/**
 * Mock class of the {@link StarkUserService} interface.
 */
export class MockStarkUserService {
	/**
	 * See [StarkUserService fetchUserProfile()]{@link StarkUserService#fetchUserProfile} method
	 */
	public fetchUserProfile = vi.fn<StarkUserService["fetchUserProfile"]>();

	/**
	 * See [StarkUserService getAllUsers()]{@link StarkUserService#getAllUsers} method
	 */
	public getAllUsers = vi.fn<StarkUserService["getAllUsers"]>();
}
