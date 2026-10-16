import { StarkRoutingService } from "@nationalbankbelgium/stark-core";
import { vi } from "vitest";

/**
 * Mock class of the {@link StarkRoutingService} interface.
 */
export class MockStarkRoutingService {
	/**
	 * See [StarkRoutingService navigateTo()]{@link StarkRoutingService#navigateTo} method
	 */
	public navigateTo = vi.fn<StarkRoutingService["navigateTo"]>();

	/**
	 * See [StarkRoutingService navigateToHome()]{@link StarkRoutingService#navigateToHome} method
	 */
	public navigateToHome = vi.fn<StarkRoutingService["navigateToHome"]>();

	/**
	 * See [StarkRoutingService navigateToPrevious()]{@link StarkRoutingService#navigateToPrevious} method
	 */
	public navigateToPrevious = vi.fn<StarkRoutingService["navigateToPrevious"]>();

	/**
	 * See [StarkRoutingService reload()]{@link StarkRoutingService#reload} method
	 */
	public reload = vi.fn<StarkRoutingService["reload"]>();

	/**
	 * See [StarkRoutingService getCurrentStateName()]{@link StarkRoutingService#getCurrentStateName} method
	 */
	public getCurrentStateName = vi.fn<StarkRoutingService["getCurrentStateName"]>();

	/**
	 * See [StarkRoutingService getCurrentState()]{@link StarkRoutingService#getCurrentState} method
	 */
	public getCurrentState = vi.fn<StarkRoutingService["getCurrentState"]>();

	/**
	 * See [StarkRoutingService getCurrentStateConfig()]{@link StarkRoutingService#getCurrentStateConfig} method
	 */
	public getCurrentStateConfig = vi.fn<StarkRoutingService["getCurrentStateConfig"]>();

	/**
	 * See [StarkRoutingService getStatesConfig()]{@link StarkRoutingService#getStatesConfig} method
	 */
	public getStatesConfig = vi.fn<StarkRoutingService["getStatesConfig"]>();

	/**
	 * See [StarkRoutingService getStateConfigByUrlPath()]{@link StarkRoutingService#getStateConfigByUrlPath} method
	 */
	public getStateConfigByUrlPath = vi.fn<StarkRoutingService["getStateConfigByUrlPath"]>();

	/**
	 * See [StarkRoutingService getStateDeclarationByStateName()]{@link StarkRoutingService#getStateDeclarationByStateName} method
	 */
	public getStateDeclarationByStateName = vi.fn<StarkRoutingService["getStateDeclarationByStateName"]>();

	/**
	 * See [StarkRoutingService getCurrentStateParams()]{@link StarkRoutingService#getCurrentStateParams} method
	 */
	public getCurrentStateParams = vi.fn<StarkRoutingService["getCurrentStateParams"]>();

	/**
	 * See [StarkRoutingService getStateTreeParams()]{@link StarkRoutingService#getStateTreeParams} method
	 */
	public getStateTreeParams = vi.fn<StarkRoutingService["getStateTreeParams"]>();

	/**
	 * See [StarkRoutingService getStateTreeResolves()]{@link StarkRoutingService#getStateTreeResolves} method
	 */
	public getStateTreeResolves = vi.fn<StarkRoutingService["getStateTreeResolves"]>();

	/**
	 * See [StarkRoutingService getStateTreeData()]{@link StarkRoutingService#getStateTreeData} method
	 */
	public getStateTreeData = vi.fn<StarkRoutingService["getStateTreeData"]>();

	/**
	 * See [StarkRoutingService isCurrentUiState()]{@link StarkRoutingService#isCurrentUiState} method
	 */
	public isCurrentUiState = vi.fn<StarkRoutingService["isCurrentUiState"]>();

	/**
	 * See [StarkRoutingService isCurrentUiStateIncludedIn()]{@link StarkRoutingService#isCurrentUiStateIncludedIn} method
	 */
	public isCurrentUiStateIncludedIn = vi.fn<StarkRoutingService["isCurrentUiStateIncludedIn"]>();

	/**
	 * See [StarkRoutingService addKnownNavigationRejectionCause()]{@link StarkRoutingService#addKnownNavigationRejectionCause} method
	 */
	public addKnownNavigationRejectionCause = vi.fn<StarkRoutingService["addKnownNavigationRejectionCause"]>();

	/**
	 * See [StarkRoutingService addTransitionHook()]{@link StarkRoutingService#addTransitionHook} method
	 */
	public addTransitionHook = vi.fn<StarkRoutingService["addTransitionHook"]>();

	/**
	 * See [StarkRoutingService getTranslationKeyFromState()]{@link StarkRoutingService#getTranslationKeyFromState} method
	 */
	public getTranslationKeyFromState = vi.fn<StarkRoutingService["getTranslationKeyFromState"]>();
}
