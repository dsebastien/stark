import { StarkSessionService } from "@nationalbankbelgium/stark-core";
import { vi } from "vitest";

/**
 * Mock class of the {@link StarkSessionService} interface.
 */
export class MockStarkSessionService {
	/**
	 * See [StarkSessionService devAuthenticationHeaders]{@link StarkSessionService#devAuthenticationHeaders} property
	 */
	public devAuthenticationHeaders: StarkSessionService["devAuthenticationHeaders"];

	/**
	 * See [StarkSessionService getCurrentUser()]{@link StarkSessionService#getCurrentUser} method
	 */
	public getCurrentUser = vi.fn<StarkSessionService["getCurrentUser"]>();

	/**
	 * See [StarkSessionService getCurrentLanguage()]{@link StarkSessionService#getCurrentLanguage} method
	 */
	public getCurrentLanguage = vi.fn<StarkSessionService["getCurrentLanguage"]>();

	/**
	 * See [StarkSessionService setCurrentLanguage()]{@link StarkSessionService#setCurrentLanguage} method
	 */
	public setCurrentLanguage = vi.fn<StarkSessionService["setCurrentLanguage"]>();

	/**
	 * See [StarkSessionService login()]{@link StarkSessionService#login} method
	 */
	public login = vi.fn<StarkSessionService["login"]>();

	/**
	 * See [StarkSessionService logout()]{@link StarkSessionService#logout} method
	 */
	public logout = vi.fn<StarkSessionService["logout"]>();

	/**
	 * See [StarkSessionService pauseUserActivityTracking()]{@link StarkSessionService#pauseUserActivityTracking} method
	 */
	public pauseUserActivityTracking = vi.fn<StarkSessionService["pauseUserActivityTracking"]>();

	/**
	 * See [StarkSessionService resumeUserActivityTracking()]{@link StarkSessionService#resumeUserActivityTracking} method
	 */
	public resumeUserActivityTracking = vi.fn<StarkSessionService["resumeUserActivityTracking"]>();

	/**
	 * See [StarkSessionService setDevAuthenticationHeaders()]{@link StarkSessionService#setDevAuthenticationHeaders} method
	 */
	public setDevAuthenticationHeaders = vi.fn<StarkSessionService["setDevAuthenticationHeaders"]>();

	/**
	 * Creates a new mock instance.
	 * @param devAuthenticationHeaders - Development authentication headers to set to this instance
	 */
	public constructor(devAuthenticationHeaders?: Map<string, string | string[]>) {
		if (!devAuthenticationHeaders) {
			this.devAuthenticationHeaders = new Map<string, string>();
		} else {
			this.devAuthenticationHeaders = devAuthenticationHeaders;
		}
	}
}
