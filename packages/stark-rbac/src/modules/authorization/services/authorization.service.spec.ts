import { config, of, throwError } from "rxjs";
import { Store } from "@ngrx/store";
import { HookMatchCriteria, Predicate, RawParams, StateDeclaration, StateOrName, TargetState, Transition } from "@uirouter/core";
import { StarkRoutingTransitionHook, StarkUser } from "@nationalbankbelgium/stark-core";
import {
	MockStarkLoggingService,
	MockStarkRoutingService,
	MockStarkSessionService,
	createMockFn,
	createMockObject,
	type VitestMockObject
} from "@nationalbankbelgium/stark-core/testing";
import { vi } from "vitest";

import { StarkRBACStatePermissions, StarkStateRedirection, StarkStateRedirectionFn } from "../entities";
import { StarkRBACAuthorizationServiceImpl, starkUnauthorizedUserError } from "./authorization.service";
import { StarkRBACAuthorizationActions } from "../actions";

type AuthorizationOnStartHookCallback = (transition: Transition) => boolean | TargetState;

function isAuthorizationOnStartHookCallback(callback: unknown): callback is AuthorizationOnStartHookCallback {
	return typeof callback === "function";
}

function getOnStartHookCallback(routingService: MockStarkRoutingService): AuthorizationOnStartHookCallback {
	const callback = routingService.addTransitionHook.mock.calls[0]?.[2];

	if (!isAuthorizationOnStartHookCallback(callback)) {
		throw new Error("Expected addTransitionHook to register a callable onStart hook");
	}

	return callback;
}

describe("StarkRBACAuthorizationService", () => {
	let mockStore: VitestMockObject<Store<any>>;
	let mockLogger: MockStarkLoggingService;
	let mockSessionService: MockStarkSessionService;
	let mockRoutingService: MockStarkRoutingService;
	let authorizationService: AuthorizationServiceHelper;
	const dummyRole = "super user";
	const dummyUnauthorizedStateName = "unauthorized state";

	function getMockTransitionTargetStateWithPermissions(mockPermissions: StarkRBACStatePermissions): StateDeclaration {
		return {
			data: {
				permissions: mockPermissions
			}
		};
	}

	beforeEach(() => {
		mockStore = createMockObject<Store<any>>(["dispatch", "select"]);
		mockLogger = new MockStarkLoggingService();
		mockSessionService = new MockStarkSessionService();
		mockRoutingService = new MockStarkRoutingService();
		authorizationService = new AuthorizationServiceHelper(
			mockLogger,
			mockSessionService,
			mockRoutingService,
			mockStore as unknown as Store<any>
		);
	});

	describe("initializeService", () => {
		it("should subscribe to the getCurrentUser$ observable to get the current user from the Stark User service", () => {
			const mockUser: Partial<StarkUser> = { roles: [] };
			mockSessionService.getCurrentUser.mockReturnValue(of(<StarkUser>mockUser));
			expect(authorizationService.user).toBeUndefined();

			authorizationService.initializeService();

			expect(authorizationService.user).toBe(<StarkUser>mockUser);
		});

		it("should throw an error if the getCurrentUser$ observable emits an error", async () => {
			const previousUnhandledErrorHandler = config.onUnhandledError;
			let capturedUnhandledError: unknown;

			try {
				config.onUnhandledError = (error: unknown): void => {
					capturedUnhandledError = error;
				};
				mockSessionService.getCurrentUser.mockReturnValue(throwError(() => new Error("dummy error")));
				expect(authorizationService.user).toBeUndefined();

				authorizationService.initializeService();
				await new Promise<void>((resolve) => {
					setTimeout(resolve, 0);
				});

				expect(capturedUnhandledError).toBeInstanceOf(Error);
				expect((<Error>capturedUnhandledError).message).toBe("StarkRBACAuthorizationService: error while getting the user profile");
				expect(authorizationService.user).toBeUndefined();
			} finally {
				config.onUnhandledError = previousUnhandledErrorHandler;
			}
		});

		it("should call registerTransitionHook function", () => {
			const mockUser: Partial<StarkUser> = { roles: [] };
			mockSessionService.getCurrentUser.mockReturnValue(of(<StarkUser>mockUser));
			vi.spyOn(authorizationService, "registerTransitionHook");

			authorizationService.initializeService();

			expect(authorizationService.registerTransitionHook).toHaveBeenCalledTimes(1);
		});
	});

	describe("registerTransitionHook", () => {
		it("should add transitionHook (onStart) matching all states with permissions except starkAppInit/starkAppExit children", () => {
			authorizationService.registerTransitionHook();

			expect(mockRoutingService.addTransitionHook).toHaveBeenCalledTimes(1);
			expect(mockRoutingService.addTransitionHook.mock.calls[0][0]).toBe(StarkRoutingTransitionHook.ON_START);

			const hookMatchCriteria: HookMatchCriteria = mockRoutingService.addTransitionHook.mock.calls[0][1];

			expect(hookMatchCriteria.entering).toBeDefined();

			const matchingFn: Predicate<any> = <Predicate<any>>hookMatchCriteria.entering;
			const nonMatchingStates: object[] = [
				{ name: "starkAppInit.state1" },
				{ name: "starkAppInit.state2", data: {} },
				{ name: "starkAppInit.stateX", data: { whatever: {} } },
				{ name: "starkAppExit.state1" },
				{ name: "starkAppExit.state2" },
				{ name: "starkAppExit.stateX" },
				{ abstract: true, name: "" } // root state
			];
			const matchingStates: object[] = [
				{ name: "whatever.state1", data: { permissions: { only: [] } } },
				{ name: "other.state2", data: { permissions: { except: [] } } },
				{ name: "stateX", data: { permissions: {} } }
			];

			for (const state of matchingStates) {
				expect(matchingFn(state)).toBe(true);
			}

			for (const state of nonMatchingStates) {
				expect(matchingFn(state)).toBe(false);
			}

			expect(mockRoutingService.addTransitionHook.mock.calls[0][2]).toBeDefined();
			expect(mockRoutingService.addTransitionHook.mock.calls[0][3]).toEqual({ priority: 900 });
		});

		it("should resolve the promise when the onStart hook is triggered and the current user IS authorized", () => {
			authorizationService.registerTransitionHook();

			expect(mockRoutingService.addTransitionHook.mock.calls[0][0]).toBe(StarkRoutingTransitionHook.ON_START);
			const onStartHookCallback = getOnStartHookCallback(mockRoutingService);

			vi.spyOn(authorizationService, "isNavigationAuthorized").mockReturnValue(true);
			vi.spyOn(authorizationService, "handleUnauthorizedNavigation");

			const mockPermissions: StarkRBACStatePermissions = {
				only: [""]
			};
			const mockTransition: Transition = <Transition>(<unknown>{
				to: (): StateDeclaration => getMockTransitionTargetStateWithPermissions(mockPermissions)
			});

			// trigger the onStart hook callback
			const hookResult: boolean | TargetState = onStartHookCallback(mockTransition);
			expect(hookResult).toBe(true);

			expect(authorizationService.isNavigationAuthorized).toHaveBeenCalledTimes(1);
			expect(authorizationService.isNavigationAuthorized).toHaveBeenCalledWith(mockPermissions);
			expect(authorizationService.handleUnauthorizedNavigation).not.toHaveBeenCalled();
		});

		it("should reject the promise with the value returned by handleUnauthorizedNavigation() when the user is NOT authorized", () => {
			authorizationService.registerTransitionHook();

			expect(mockRoutingService.addTransitionHook.mock.calls[0][0]).toBe(StarkRoutingTransitionHook.ON_START);
			const onStartHookCallback = getOnStartHookCallback(mockRoutingService);

			vi.spyOn(authorizationService, "isNavigationAuthorized").mockReturnValue(false);
			const mockRejectedTargetState: TargetState = <TargetState>(<unknown>{ name: (): StateOrName => "dummy.rejection.state" });
			vi.spyOn(authorizationService, "handleUnauthorizedNavigation").mockReturnValue(mockRejectedTargetState);

			const mockPermissions: StarkRBACStatePermissions = {
				only: [""]
			};
			const mockTransition: Transition = <Transition>(<unknown>{
				to: (): StateDeclaration => getMockTransitionTargetStateWithPermissions(mockPermissions)
			});

			// trigger the onStart hook callback
			const hookResult: boolean | TargetState = onStartHookCallback(mockTransition);
			expect(hookResult).toBe(mockRejectedTargetState);

			expect(authorizationService.isNavigationAuthorized).toHaveBeenCalledTimes(1);
			expect(authorizationService.isNavigationAuthorized).toHaveBeenCalledWith(mockPermissions);
			expect(authorizationService.handleUnauthorizedNavigation).toHaveBeenCalledTimes(1);
			expect(authorizationService.handleUnauthorizedNavigation).toHaveBeenCalledWith(mockPermissions, mockTransition);
		});
	});

	describe("hasRole", () => {
		it("should return true only if the current user has the given role", () => {
			const authorizedRole: string = dummyRole;
			const unauthorizedRole = "simple mortal";
			const mockUserWithRoles: Partial<StarkUser> = {
				roles: [dummyRole, "manager"]
			};
			authorizationService.user = <StarkUser>mockUserWithRoles;

			expect(authorizationService.hasRole(authorizedRole)).toBe(true);
			expect(authorizationService.hasRole(unauthorizedRole)).toBe(false);
		});

		it("should return false when the given role is empty or undefined", () => {
			const mockUserWithRoles: Partial<StarkUser> = {
				roles: [dummyRole, "manager", "", "   "] // empty string is not a valid role!
			};
			authorizationService.user = <StarkUser>mockUserWithRoles;

			expect(authorizationService.hasRole("   ")).toBe(false);
			expect(authorizationService.hasRole(<any>undefined)).toBe(false);
		});

		it("should return false when there is no current user defined or it has no roles", () => {
			const someRole = "whatever";
			authorizationService.user = <any>undefined;

			expect(authorizationService.hasRole(someRole)).toBe(false);

			const mockUserWithEmptyRoles: Partial<StarkUser> = { roles: [] };

			authorizationService.user = <StarkUser>mockUserWithEmptyRoles;

			expect(authorizationService.hasRole(someRole)).toBe(false);
		});
	});

	describe("hasAnyRole", () => {
		it("should return true only if the current user has ANY of the given roles", () => {
			const authorizedRoles: string[] = [dummyRole, "admin"];
			const unauthorizedRoles: string[] = ["simple mortal", "get out of here"];
			let mockUserWithRoles: Partial<StarkUser> = {
				roles: [dummyRole, "manager"]
			};
			authorizationService.user = <StarkUser>mockUserWithRoles;

			expect(authorizationService.hasAnyRole(authorizedRoles)).toBe(true);
			expect(authorizationService.hasAnyRole(unauthorizedRoles)).toBe(false);

			mockUserWithRoles = {
				roles: ["vip", "admin"]
			};
			authorizationService.user = <StarkUser>mockUserWithRoles;

			expect(authorizationService.hasAnyRole(authorizedRoles)).toBe(true);
			expect(authorizationService.hasAnyRole(unauthorizedRoles)).toBe(false);
		});

		it("should return false when the given roles are empty or undefined", () => {
			const mockUserWithRoles: Partial<StarkUser> = {
				roles: [dummyRole, "manager", "", "   "] // empty string is not a valid role!
			};
			authorizationService.user = <StarkUser>mockUserWithRoles;

			expect(authorizationService.hasAnyRole([])).toBe(false);
			expect(authorizationService.hasAnyRole(["", "   "])).toBe(false);
			expect(authorizationService.hasAnyRole(<any>undefined)).toBe(false);
		});

		it("should return false when there is no current user defined or it has no roles", () => {
			const someRoles: string[] = ["whatever"];
			authorizationService.user = <any>undefined;

			expect(authorizationService.hasAnyRole(someRoles)).toBe(false);

			const mockUserWithEmptyRoles: Partial<StarkUser> = { roles: [] };

			authorizationService.user = <StarkUser>mockUserWithEmptyRoles;

			expect(authorizationService.hasAnyRole(someRoles)).toBe(false);
		});
	});

	describe("isAnonymous", () => {
		it("should return true only if the current user has isAnonymous property set to TRUE", () => {
			let mockUserAnonymous: Partial<StarkUser> = { isAnonymous: true };
			authorizationService.user = <StarkUser>mockUserAnonymous;

			expect(authorizationService.isAnonymous()).toBe(true);

			mockUserAnonymous = { isAnonymous: false };
			authorizationService.user = <StarkUser>mockUserAnonymous;

			expect(authorizationService.isAnonymous()).toBe(false);

			mockUserAnonymous = { isAnonymous: undefined };
			authorizationService.user = <StarkUser>mockUserAnonymous;

			expect(authorizationService.isAnonymous()).toBe(false);

			mockUserAnonymous = {};
			authorizationService.user = <StarkUser>mockUserAnonymous;

			expect(authorizationService.isAnonymous()).toBe(false);
		});

		it("should return false when there is no current user defined", () => {
			authorizationService.user = <any>undefined;

			expect(authorizationService.isAnonymous()).toBe(false);
		});
	});

	describe("isNavigationAuthorized", () => {
		it("should call hasAnyRole() with the permissions 'only' if they are defined and return the value returned by that function", () => {
			const mockPermissions: StarkRBACStatePermissions = {
				only: ["dummyRole", "superRole"]
			};
			const hasAnyRoleSpy = vi.spyOn(authorizationService, "hasAnyRole").mockReturnValueOnce(true).mockReturnValueOnce(false);

			let result: boolean = authorizationService.isNavigationAuthorized(mockPermissions);

			expect(result).toBe(true);
			expect(authorizationService.hasAnyRole).toHaveBeenCalledTimes(1);
			expect(authorizationService.hasAnyRole).toHaveBeenCalledWith(<string[]>mockPermissions.only);

			hasAnyRoleSpy.mockReset();
			hasAnyRoleSpy.mockReturnValue(false);
			result = authorizationService.isNavigationAuthorized(mockPermissions);

			expect(result).toBe(false);
			expect(authorizationService.hasAnyRole).toHaveBeenCalledTimes(1);
			expect(authorizationService.hasAnyRole).toHaveBeenCalledWith(<string[]>mockPermissions.only);
		});

		it("should call hasAnyRole() with the permissions 'except' if they are defined and return the INVERTED value that is returned", () => {
			const mockPermissions: StarkRBACStatePermissions = {
				except: ["dummyRole", "superRole"]
			};
			const hasAnyRoleSpy = vi.spyOn(authorizationService, "hasAnyRole").mockReturnValueOnce(true).mockReturnValueOnce(false);

			let result: boolean = authorizationService.isNavigationAuthorized(mockPermissions);

			expect(result).toBe(false); // inverted value of what hasAnyRole returns => 'except'
			expect(authorizationService.hasAnyRole).toHaveBeenCalledTimes(1);
			expect(authorizationService.hasAnyRole).toHaveBeenCalledWith(<string[]>mockPermissions.except);

			hasAnyRoleSpy.mockReset();
			hasAnyRoleSpy.mockReturnValue(false);
			result = authorizationService.isNavigationAuthorized(mockPermissions);

			expect(result).toBe(true); // inverted value of what hasAnyRole returns => 'except'
			expect(authorizationService.hasAnyRole).toHaveBeenCalledTimes(1);
			expect(authorizationService.hasAnyRole).toHaveBeenCalledWith(<string[]>mockPermissions.except);
		});

		it("should give preference to permissions 'only' over 'except' when both are defined and call hasAnyRole() with those", () => {
			const mockPermissions: StarkRBACStatePermissions = {
				only: ["dummyRole", "superRole"],
				except: ["don't care"]
			};
			const hasAnyRoleSpy = vi.spyOn(authorizationService, "hasAnyRole").mockReturnValueOnce(true).mockReturnValueOnce(false);

			let result: boolean = authorizationService.isNavigationAuthorized(mockPermissions);

			expect(result).toBe(true);
			expect(authorizationService.hasAnyRole).toHaveBeenCalledTimes(1);
			expect(authorizationService.hasAnyRole).toHaveBeenCalledWith(<string[]>mockPermissions.only);

			hasAnyRoleSpy.mockReset();
			hasAnyRoleSpy.mockReturnValue(false);
			result = authorizationService.isNavigationAuthorized(mockPermissions);

			expect(result).toBe(false);
			expect(authorizationService.hasAnyRole).toHaveBeenCalledTimes(1);
			expect(authorizationService.hasAnyRole).toHaveBeenCalledWith(<string[]>mockPermissions.only);
		});

		it("should return true without calling hasAnyRole() when the permissions object has invalid 'only' nor 'except' or is undefined", () => {
			const undefinedStatePermissionsStr = "could not find 'only' or 'except'";

			vi.spyOn(authorizationService, "hasAnyRole");

			const mockPermissionsArray: StarkRBACStatePermissions[] = [
				{},
				{ only: <any>"not an array" },
				{ except: <any>"not an array" },
				{ redirectTo: { stateName: "", params: {} } },
				<any>undefined
			];

			for (const mockPermissions of mockPermissionsArray) {
				mockLogger.warn.mockReset();

				const result: boolean = authorizationService.isNavigationAuthorized(mockPermissions);

				expect(result).toBe(true);
				expect(authorizationService.hasAnyRole).not.toHaveBeenCalled();

				if (typeof mockPermissions !== "undefined") {
					expect(mockLogger.warn).toHaveBeenCalledTimes(1);
					expect(mockLogger.warn.mock.calls[0][0]).toContain(undefinedStatePermissionsStr);
				} else {
					// if the permissions object is undefined, no warning is logged
					expect(mockLogger.warn).not.toHaveBeenCalled();
				}
			}
		});
	});

	describe("handleUnauthorizedNavigation", () => {
		it("should log a warning and return the value of redirectNavigation() in case permissions object has 'redirectTo' defined", () => {
			const mockPermissions: StarkRBACStatePermissions = {
				redirectTo: {
					stateName: "dummy redirection state",
					params: { someParam: "whatever" }
				}
			};
			const mockTransition: Partial<Transition> = {};
			vi.spyOn(authorizationService, "redirectNavigation").mockReturnValue(<any>"dummy redirection return value");

			const result: any = authorizationService.handleUnauthorizedNavigation(mockPermissions, <Transition>mockTransition);

			expect(result).toBe(<any>"dummy redirection return value");
			expect(authorizationService.redirectNavigation).toHaveBeenCalledTimes(1);
			expect(authorizationService.redirectNavigation).toHaveBeenCalledWith(
				<StarkStateRedirection>mockPermissions.redirectTo,
				<Transition>mockTransition
			);
			expect(mockLogger.warn).toHaveBeenCalledTimes(1);
			expect(mockLogger.warn).toHaveBeenCalledWith(starkUnauthorizedUserError);
			expect(mockStore.dispatch).not.toHaveBeenCalled();
		});

		it("should dispatch a FAILURE action and throw an error when permissions object is undefined ot it has no 'redirectTo' defined", () => {
			let mockPermissions: StarkRBACStatePermissions = {};
			const targetStateObj: any = {
				name: createMockFn<() => StateOrName>().mockReturnValue(dummyUnauthorizedStateName)
			};
			const mockTransition: Partial<Transition> = {
				targetState: createMockFn<() => TargetState>().mockReturnValue(targetStateObj)
			};
			vi.spyOn(authorizationService, "redirectNavigation");

			expect(() => {
				authorizationService.handleUnauthorizedNavigation(mockPermissions, <Transition>mockTransition);
			}).toThrowError(starkUnauthorizedUserError);

			expect(authorizationService.redirectNavigation).not.toHaveBeenCalled();
			expect(mockLogger.warn).toHaveBeenCalledTimes(1);
			expect(mockLogger.warn).toHaveBeenCalledWith(starkUnauthorizedUserError);
			expect(mockStore.dispatch).toHaveBeenCalledTimes(1);
			expect(mockStore.dispatch).toHaveBeenCalledWith(
				StarkRBACAuthorizationActions.userNavigationUnauthorized({ targetState: dummyUnauthorizedStateName })
			);

			mockPermissions = <any>undefined;
			mockLogger.warn.mockReset();

			expect(() => {
				authorizationService.handleUnauthorizedNavigation(mockPermissions, <Transition>mockTransition);
			}).toThrowError(starkUnauthorizedUserError);

			expect(authorizationService.redirectNavigation).not.toHaveBeenCalled();
			expect(mockLogger.warn).toHaveBeenCalledTimes(1);
			expect(mockLogger.warn).toHaveBeenCalledWith(starkUnauthorizedUserError);
		});
	});

	describe("redirectNavigation", () => {
		type MockRedirectTargetStateMetadata = {
			redirectionStateName?: StateOrName;
			redirectionStateParams?: RawParams;
			redirectionStateParamsReplaced?: boolean;
		};

		// mock target state
		let targetStateObj: any;
		let mockTransition: Partial<Transition>;
		const mockRedirectToParams: RawParams = { someParam: "whatever" };
		const mockRedirectToObj: StarkStateRedirection = {
			stateName: "dummy redirection state",
			params: mockRedirectToParams
		};

		beforeEach(() => {
			targetStateObj = {
				redirectionStateName: undefined, // custom prop
				redirectionStateParams: undefined, // custom prop
				redirectionStateParamsReplaced: undefined, // custom prop
				// name() function as defined in the Ui-Router API
				name: createMockFn<() => StateOrName>().mockReturnValue(dummyUnauthorizedStateName),
				// withState() function as defined in the Ui-Router API
				withState: createMockFn<(state: StateOrName) => TargetState>().mockImplementation((state: StateOrName): TargetState => {
					targetStateObj.redirectionStateName = state;
					return targetStateObj;
				}),
				// withParams() function as defined in the Ui-Router API
				withParams: createMockFn<(params: RawParams, replace: boolean) => TargetState>().mockImplementation(
					(params: RawParams, replace: boolean): TargetState => {
						targetStateObj.redirectionStateParams = params;
						targetStateObj.redirectionStateParamsReplaced = replace;
						return targetStateObj;
					}
				)
			};

			mockTransition = {
				targetState: createMockFn<() => TargetState>().mockReturnValue(targetStateObj)
			};
		});

		it("should log a warning, dispatch REDIRECTED action and return a redirection state based on permissions 'redirectTo' object", () => {
			const result: TargetState & MockRedirectTargetStateMetadata = <TargetState & MockRedirectTargetStateMetadata>(
				authorizationService.redirectNavigation(mockRedirectToObj, <Transition>mockTransition)
			);

			expect(result).toBe(targetStateObj);
			expect(result.redirectionStateName).toBe(mockRedirectToObj.stateName);
			expect(result.redirectionStateParams).toBe(mockRedirectToObj.params);
			expect(result.redirectionStateParamsReplaced).toBe(true);
			expect(mockTransition.targetState).toHaveBeenCalledTimes(1);
			expect(targetStateObj.withState).toHaveBeenCalledTimes(1);
			expect(targetStateObj.withState).toHaveBeenCalledWith(mockRedirectToObj.stateName);
			expect(targetStateObj.withParams).toHaveBeenCalledTimes(1);
			expect(targetStateObj.withParams).toHaveBeenCalledWith(mockRedirectToParams, true);
			expect(mockLogger.warn).toHaveBeenCalledTimes(1);
			expect(mockLogger.warn.mock.calls[0][0]).toContain("redirecting");
			expect(mockStore.dispatch).toHaveBeenCalledTimes(1);
			expect(mockStore.dispatch).toHaveBeenCalledWith(
				StarkRBACAuthorizationActions.userNavigationUnauthorizedRedirected({
					targetState: dummyUnauthorizedStateName,
					redirectionState: mockRedirectToObj.stateName
				})
			);
		});

		it("should log a warning, dispatch REDIRECTED action and return a redirection state based on permissions 'redirectTo' function", () => {
			const mockRedirectToFn: StarkStateRedirectionFn = createMockFn<StarkStateRedirectionFn>().mockReturnValue(mockRedirectToObj);

			const result: TargetState & MockRedirectTargetStateMetadata = <TargetState & MockRedirectTargetStateMetadata>(
				authorizationService.redirectNavigation(mockRedirectToFn, <Transition>mockTransition)
			);
			expect(result).toBe(targetStateObj);
			expect(result.redirectionStateName).toBe(mockRedirectToObj.stateName);
			expect(result.redirectionStateParams).toBe(mockRedirectToObj.params);
			expect(result.redirectionStateParamsReplaced).toBe(true);
			expect(mockRedirectToFn).toHaveBeenCalledTimes(1);
			expect(mockRedirectToFn).toHaveBeenCalledWith(<Transition>mockTransition);
			expect(mockTransition.targetState).toHaveBeenCalledTimes(1);
			expect(targetStateObj.withState).toHaveBeenCalledTimes(1);
			expect(targetStateObj.withState).toHaveBeenCalledWith(mockRedirectToObj.stateName);
			expect(targetStateObj.withParams).toHaveBeenCalledTimes(1);
			expect(targetStateObj.withParams).toHaveBeenCalledWith(mockRedirectToParams, true);
			expect(mockLogger.warn).toHaveBeenCalledTimes(1);
			expect(mockLogger.warn.mock.calls[0][0]).toContain("redirecting");
			expect(mockStore.dispatch).toHaveBeenCalledTimes(1);
			expect(mockStore.dispatch).toHaveBeenCalledWith(
				StarkRBACAuthorizationActions.userNavigationUnauthorizedRedirected({
					targetState: dummyUnauthorizedStateName,
					redirectionState: mockRedirectToObj.stateName
				})
			);
		});
	});
});

class AuthorizationServiceHelper extends StarkRBACAuthorizationServiceImpl {
	public override registerTransitionHook(): void {
		super.registerTransitionHook();
	}

	public override isNavigationAuthorized(permissions: StarkRBACStatePermissions): boolean {
		return super.isNavigationAuthorized(permissions);
	}

	public override handleUnauthorizedNavigation(permissions: StarkRBACStatePermissions, transition: Transition): TargetState {
		return super.handleUnauthorizedNavigation(permissions, transition);
	}

	public override redirectNavigation(redirectTo: StarkStateRedirection | StarkStateRedirectionFn, transition: Transition): TargetState {
		return super.redirectNavigation(redirectTo, transition);
	}
}
