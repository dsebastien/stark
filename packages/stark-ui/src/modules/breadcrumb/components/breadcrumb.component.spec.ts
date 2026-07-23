/* eslint-disable @angular-eslint/no-lifecycle-call */
import { StarkBreadcrumbConfig } from "./breadcrumb-config.intf";
import { StarkBreadcrumbComponent } from "./breadcrumb.component";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { Component, DebugElement, ErrorHandler, ViewChild } from "@angular/core";
import {
	STARK_LOGGING_SERVICE,
	STARK_ROUTING_SERVICE,
	StarkRoutingTransitionHook,
	type StarkLoggingService,
	type StarkRoutingService
} from "@nationalbankbelgium/stark-core";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateModule } from "@ngx-translate/core";
import { By } from "@angular/platform-browser";
import { StarkBreadcrumbPath } from "./breadcrumb-path.intf";
import { EMPTY, throwError } from "rxjs";
import { vi } from "vitest";
import { StarkBreadcrumbModule } from "../breadcrumb.module";

@Component({
	standalone: true,
	selector: `host-component`,
	imports: [StarkBreadcrumbModule],
	template: ` <stark-breadcrumb [breadcrumbConfig]="breadcrumbConfig"></stark-breadcrumb> `
})
class TestHostComponent {
	@ViewChild(StarkBreadcrumbComponent, { static: true })
	public breadcrumbComponent!: StarkBreadcrumbComponent;
	public breadcrumbConfig?: StarkBreadcrumbConfig;
}

describe("BreadcrumbComponent", () => {
	let component: StarkBreadcrumbComponent;
	let hostComponent: TestHostComponent;
	let hostFixture: ComponentFixture<TestHostComponent>;

	const childConst = "child";
	const parentConst = "parent";
	const grandParentConst = "grandparent";
	const rootAncestorConst = "root ancestor";

	// component bindings values
	const breadcrumbConfig: StarkBreadcrumbConfig = {
		breadcrumbPaths: [
			{
				id: "path 1",
				state: rootAncestorConst,
				stateParams: { param1: "param 1", param2: "param 2" },
				translationKey: "ROOT_ANCESTOR"
			},
			{
				id: "path 1.1",
				state: grandParentConst,
				stateParams: { param3: "param 3", param4: "param 4" },
				translationKey: "GRANDPARENT"
			},
			{
				id: "path 1.1.1",
				state: parentConst,
				stateParams: { param5: "param 5", param6: "param 6" },
				translationKey: "PARENT"
			},
			{
				id: "path 1.1.1.1",
				state: childConst,
				stateParams: { param7: "param 7", param8: "param 8" },
				translationKey: "CHILD"
			}
		]
	};

	const mockStateTreeParams: Map<string, any> = new Map<string, unknown>();
	mockStateTreeParams.set(childConst, { param7: "param 7", param8: "param 8" });
	mockStateTreeParams.set(parentConst, { param5: "param 5", param6: "param 6" });
	mockStateTreeParams.set(grandParentConst, { param3: "param 3", param4: "param 4" });
	mockStateTreeParams.set(rootAncestorConst, { param1: "param 1", param2: "param 2" });

	const mockStateTreeData: Map<string, any> = new Map<string, unknown>();
	mockStateTreeData.set(childConst, { translationKey: "CHILD" });
	mockStateTreeData.set(parentConst, { translationKey: "PARENT" });
	mockStateTreeData.set(grandParentConst, { translationKey: "GRANDPARENT" });
	mockStateTreeData.set(rootAncestorConst, { translationKey: "ROOT_ANCESTOR" });

	const loggingServiceMock: StarkLoggingService = {
		correlationId: "dummyCorrelationId",
		correlationIdHttpHeaderName: "Correlation-Id-HttpHeaderName",
		generateNewCorrelationId: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	} as unknown as StarkLoggingService;

	const routingServiceMock = {
		addTransitionHook: vi.fn(),
		getStateTreeParams: vi.fn(),
		getTranslationKeyFromState: vi.fn(),
		navigateTo: vi.fn()
	};

	const errorHandlerMock = {
		handleError: vi.fn()
	};

	const mockDeregisterTransitionHookFn = vi.fn();
	type BreadcrumbTransitionHookCallback = () => void;

	function isBreadcrumbTransitionHookCallback(callback: unknown): callback is BreadcrumbTransitionHookCallback {
		return typeof callback === "function";
	}

	function getTransitionHookCallback(): BreadcrumbTransitionHookCallback {
		const callback = routingServiceMock.addTransitionHook.mock.calls.at(-1)?.[2];

		if (!isBreadcrumbTransitionHookCallback(callback)) {
			throw new Error("Expected addTransitionHook to register a callable onSuccess hook");
		}

		return callback;
	}

	beforeEach(waitForAsync(() =>
		TestBed.configureTestingModule({
			imports: [NoopAnimationsModule, TestHostComponent, TranslateModule.forRoot()],
			providers: [
				{ provide: ErrorHandler, useValue: errorHandlerMock },
				{ provide: STARK_LOGGING_SERVICE, useValue: loggingServiceMock },
				{ provide: STARK_ROUTING_SERVICE, useValue: routingServiceMock as unknown as StarkRoutingService }
			]
		}).compileComponents()));

	// Inject module dependencies
	beforeEach(() => {
		routingServiceMock.addTransitionHook.mockReset();
		routingServiceMock.addTransitionHook.mockReturnValue(mockDeregisterTransitionHookFn);
		routingServiceMock.getStateTreeParams.mockReset();
		routingServiceMock.getStateTreeParams.mockReturnValue(mockStateTreeParams);
		routingServiceMock.getTranslationKeyFromState.mockReset();
		routingServiceMock.getTranslationKeyFromState.mockImplementation(
			(stateName: string) => mockStateTreeData.get(stateName).translationKey
		);
		routingServiceMock.navigateTo.mockReset();
		routingServiceMock.navigateTo.mockReturnValue(EMPTY);
		errorHandlerMock.handleError.mockReset();
		mockDeregisterTransitionHookFn.mockReset();

		hostFixture = TestBed.createComponent(TestHostComponent);
		hostComponent = hostFixture.componentInstance;
		component = hostComponent.breadcrumbComponent;

		hostComponent.breadcrumbConfig = breadcrumbConfig;
	});

	describe("on initialization", () => {
		it("should set internal component properties", () => {
			expect(hostFixture).toBeDefined();
			expect(component).toBeDefined();
			expect(component.logger).not.toBeNull();
			expect(component.logger).toBeDefined();
			expect(component.routingService).not.toBeNull();
			expect(component.routingService).toBeDefined();
		});
	});

	it("should render the appropriate content", () => {
		hostFixture.detectChanges();

		const pathLinks: DebugElement[] = hostFixture.debugElement.queryAll(By.css("a"));
		expect(pathLinks.length).toBe(4);

		for (let i = 0; i < pathLinks.length; i++) {
			expect(pathLinks[i].properties["id"]).toBe(breadcrumbConfig.breadcrumbPaths[i].id);
			expect(pathLinks[i].nativeElement.innerHTML).toBe(breadcrumbConfig.breadcrumbPaths[i].translationKey);
		}
	});

	it("should refresh the view when the config changes", () => {
		const newBreadcrumbConfig: StarkBreadcrumbConfig = {
			breadcrumbPaths: [
				{
					id: "first path",
					state: parentConst,
					stateParams: { paramX: "param X", paramY: "param Y" },
					translationKey: "FIRST_PATH"
				},
				{
					id: "second path",
					state: childConst,
					stateParams: { paramZ: "param Z" },
					translationKey: "SECOND_PATH"
				}
			]
		};

		hostComponent.breadcrumbConfig = newBreadcrumbConfig;
		hostFixture.detectChanges();

		const pathLinks: DebugElement[] = hostFixture.debugElement.queryAll(By.css("a"));
		expect(pathLinks.length).toBe(2);

		for (let i = 0; i < pathLinks.length; i++) {
			expect(pathLinks[i].properties["id"]).toBe(newBreadcrumbConfig.breadcrumbPaths[i].id);
			expect(pathLinks[i].nativeElement.innerHTML).toBe(newBreadcrumbConfig.breadcrumbPaths[i].translationKey);
		}
	});

	describe("ngOnInit", () => {
		it("should call getPathsFromStateTree() and add a route transition hook if breadcrumbConfig is not provided", () => {
			const getPathsSpy = vi.spyOn(component, "getPathsFromStateTree");
			component.breadcrumbConfig = undefined;

			component.ngOnInit();

			expect(component.breadcrumbConfig).toBeDefined();
			expect(getPathsSpy).toHaveBeenCalledTimes(1);
			expect(routingServiceMock.addTransitionHook).toHaveBeenCalledTimes(1);
			expect(routingServiceMock.addTransitionHook.mock.calls.at(-1)?.[0]).toBe(StarkRoutingTransitionHook.ON_SUCCESS);
			expect(routingServiceMock.addTransitionHook.mock.calls.at(-1)?.[1]).toEqual({});
			expect(typeof routingServiceMock.addTransitionHook.mock.calls.at(-1)?.[2]).toBe("function");
		});

		it("should call getPathsFromStateTree() to refresh the breadcrumbConfig whenever the transition hook is triggered", () => {
			const getPathsSpy = vi.spyOn(component, "getPathsFromStateTree");

			component.ngOnInit();

			expect(component.breadcrumbConfig).toBeDefined();
			expect(routingServiceMock.addTransitionHook).toHaveBeenCalledTimes(1);
			const transitionHookFn = getTransitionHookCallback();
			getPathsSpy.mockClear();

			transitionHookFn();
			expect(getPathsSpy).toHaveBeenCalledTimes(1);
			expect(component.breadcrumbConfig).toBeDefined();
		});
	});

	describe("ngOnDestroy", () => {
		beforeEach(() => {
			mockDeregisterTransitionHookFn.mockReset();
		});

		it("should call the transition hook deregistration function when no config is set", () => {
			hostComponent.breadcrumbConfig = undefined;
			hostFixture.detectChanges();

			component.ngOnDestroy();
			expect(mockDeregisterTransitionHookFn).toHaveBeenCalledTimes(1);
		});

		it("should NOT call the transition hook deregistration function when a config is set", () => {
			hostComponent.breadcrumbConfig = breadcrumbConfig;
			hostFixture.detectChanges();

			component.ngOnDestroy();
			expect(mockDeregisterTransitionHookFn).not.toHaveBeenCalled();
		});
	});

	describe("getPathsFromStateTree", () => {
		it("should call the routing service to fetch the params, resolves and data from the state tree", () => {
			component.getPathsFromStateTree();

			expect(routingServiceMock.getStateTreeParams).toHaveBeenCalledTimes(1);
			expect(routingServiceMock.getTranslationKeyFromState).toHaveBeenCalledTimes(4);
		});

		it("should call getTranslationKeyFromState to get the translation key for every state contained in the state tree params map", () => {
			component.getPathsFromStateTree();

			expect(routingServiceMock.getTranslationKeyFromState).toHaveBeenCalledTimes(mockStateTreeParams.size);
		});

		it("should get an ordered array (from child to root ancestor) containing the breadcrumb paths", () => {
			const result: StarkBreadcrumbPath[] = component.getPathsFromStateTree();

			expect(result.length).toBe(mockStateTreeParams.size);

			for (let idx = 0; idx < result.length; idx++) {
				expect(result[idx].id).toBe("breadcrumb-path-" + breadcrumbConfig.breadcrumbPaths[idx].state);
				expect(result[idx].state).toBe(breadcrumbConfig.breadcrumbPaths[idx].state);
				expect(result[idx].stateParams).toEqual(breadcrumbConfig.breadcrumbPaths[idx].stateParams);
				expect(result[idx].translationKey).toBe(breadcrumbConfig.breadcrumbPaths[idx].translationKey);
			}
		});
	});

	describe("breadcrumbClickHandler", () => {
		it("should call the routingService to navigate to the state with the corresponding params given in the breadcrumbPath", () => {
			const breadcrumbPath: StarkBreadcrumbPath = breadcrumbConfig.breadcrumbPaths[0];

			component.breadcrumbClickHandler(breadcrumbPath);

			expect(routingServiceMock.navigateTo).toHaveBeenCalledTimes(1);
			expect(routingServiceMock.navigateTo).toHaveBeenCalledWith(breadcrumbPath.state, breadcrumbPath.stateParams);
			expect(errorHandlerMock.handleError).not.toHaveBeenCalled();
		});

		it("should forward navigation errors to the Angular ErrorHandler", () => {
			const breadcrumbPath: StarkBreadcrumbPath = breadcrumbConfig.breadcrumbPaths[0];
			const navigationError = new Error("navigation failed");
			routingServiceMock.navigateTo.mockReturnValueOnce(throwError(() => navigationError));

			component.breadcrumbClickHandler(breadcrumbPath);

			expect(errorHandlerMock.handleError).toHaveBeenCalledTimes(1);
			expect(errorHandlerMock.handleError).toHaveBeenCalledWith(navigationError);
		});
	});
});
