import { StarkRBACAuthorizationService } from "@nationalbankbelgium/stark-rbac";
import { vi } from "vitest";

/**
 * Mock class of the {@link StarkRBACAuthorizationService} interface.
 */
export class MockStarkRBACAuthorizationService {
	/**
	 * See [StarkRBACAuthorizationService initializeService()]{@link StarkRBACAuthorizationService#initializeService} method
	 */
	public initializeService = vi.fn<StarkRBACAuthorizationService["initializeService"]>();

	/**
	 * See [StarkRBACAuthorizationService hasRole()]{@link StarkRBACAuthorizationService#hasRole} method
	 */
	public hasRole = vi.fn<StarkRBACAuthorizationService["hasRole"]>();

	/**
	 * See [StarkRBACAuthorizationService hasAnyRole()]{@link StarkRBACAuthorizationService#hasAnyRole} method
	 */
	public hasAnyRole = vi.fn<StarkRBACAuthorizationService["hasAnyRole"]>();

	/**
	 * See [StarkRBACAuthorizationService isAnonymous()]{@link StarkRBACAuthorizationService#isAnonymous} method
	 */
	public isAnonymous = vi.fn<StarkRBACAuthorizationService["isAnonymous"]>();
}
