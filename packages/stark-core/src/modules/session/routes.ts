import { Location } from "@angular/common";
import { LazyLoadResult, RawParams, StateDeclaration, StateObject, Transition } from "@uirouter/core";
import { loadNgModule, Ng2StateDeclaration, ModuleTypeCallback } from "@uirouter/angular";
import { firstValueFrom, from, Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { STARK_ROUTING_SERVICE, StarkRoutingService, StarkStateConfigWithParams } from "../routing/services";
import { starkAppExitStateName, starkAppInitStateName } from "./constants";

type StarkLazyStateDeclaration = StateDeclaration & { loadChildren: ModuleTypeCallback };

/**
 * Returns the internal UI-Router state object when the state is already registered.
 *
 * @param state - The state declaration to inspect.
 */
function getRegisteredStateObject(state: StateDeclaration): StateObject | undefined {
	return state.$$state?.();
}

/**
 * Checks whether the state declaration still exposes a lazy `loadChildren` callback.
 *
 * @param state - The state declaration to inspect.
 */
function hasLoadChildren(state: StateDeclaration): state is StarkLazyStateDeclaration {
	return typeof Reflect.get(state, "loadChildren") === "function";
}

/**
 * Configuration of the route state of the application
 *
 * @param $location - Service to interact with the browser's URL
 * @param $transition$ - Transition between two states
 * @param routingService - Stark Routing Service
 */
export function resolveTargetRoute(
	$location: Location,
	$transition$: Transition,
	routingService: StarkRoutingService
): Promise<StarkStateConfigWithParams | undefined> {
	/**
	 * Get the corresponding registered state that matches with the given URL.
	 * If the state is part of a lazy loaded module, then such module is loaded first and then the URL is searched again to get the correct state
	 * @param targetUrl - The URL of the target state being searched
	 */
	function getTargetStateByUrl(targetUrl: string): StarkStateConfigWithParams | undefined {
		let targetState: StarkStateConfigWithParams | undefined = routingService.getStateConfigByUrlPath(targetUrl);

		// skip any init/exit state
		const initOrExitStateRegex = new RegExp("(" + starkAppInitStateName + "|" + starkAppExitStateName + ")");
		const targetStateObject = targetState ? getRegisteredStateObject(targetState.state) : undefined;

		if (targetState && targetStateObject?.parent && targetStateObject.parent.name.match(initOrExitStateRegex)) {
			targetState = undefined;
		}

		return targetState;
	}

	// get the path of the current URL in the browser's navigation bar
	const targetUrlPath: string = $location.path(true);
	const targetRoute: StarkStateConfigWithParams | undefined = getTargetStateByUrl(targetUrlPath);
	let finalTargetRoute$: Observable<StarkStateConfigWithParams | undefined> = of(targetRoute);

	// in case the state is part of a module to load lazily, we need to load it and search the url again
	if (targetRoute && hasLoadChildren(targetRoute.state)) {
		// so we call the needed function to lazy load the module
		const moduleToLoad: ModuleTypeCallback = targetRoute.state.loadChildren;
		const lazyLoadNgModule: (transition: Transition, stateObject: StateDeclaration) => Promise<LazyLoadResult> =
			loadNgModule(moduleToLoad);

		// once the module is loaded lazily, we search again for the right state and return the result
		finalTargetRoute$ = from(lazyLoadNgModule($transition$, targetRoute.state)).pipe(
			map((_lazyLoadResult: LazyLoadResult) => getTargetStateByUrl(targetUrlPath))
		);
	}

	return firstValueFrom(finalTargetRoute$);
}

/**
 * Check if targetRoute is defined and returns the name of the state OR `undefined`.
 * @param targetRoute - Returned value of `resolveTargetRoute` method
 */
export function resolveTargetState(targetRoute?: StarkStateConfigWithParams): Promise<string | undefined> {
	return Promise.resolve(typeof targetRoute !== "undefined" ? targetRoute.state.name : undefined);
}

/**
 * Check if targetRoute is defined and returns the params of the state OR `undefined`.
 * @param targetRoute - Returned value of `resolveTargetRoute` method
 */
export function resolveTargetStateParams(targetRoute?: StarkStateConfigWithParams): Promise<RawParams | undefined> {
	return Promise.resolve(typeof targetRoute !== "undefined" ? targetRoute.paramValues : undefined);
}

/**
 * States defined by {@link StarkSessionModule}
 */
export const SESSION_STATES: Ng2StateDeclaration[] = [
	{
		name: starkAppInitStateName, // parent state for any initialization state (used to show/hide the main app component)
		abstract: true,

		resolve: [
			{
				token: "targetRoute",
				deps: [Location, Transition, STARK_ROUTING_SERVICE],
				resolveFn: resolveTargetRoute
			},
			{
				token: "targetState",
				deps: ["targetRoute"],
				resolveFn: resolveTargetState
			},
			{
				token: "targetStateParams",
				deps: ["targetRoute"],
				resolveFn: resolveTargetStateParams
			}
		]
	},
	{
		name: starkAppExitStateName, // parent state for any exit state (used to show/hide the main app component)
		abstract: true
	}
];
