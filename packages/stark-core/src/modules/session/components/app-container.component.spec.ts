import { MockStarkLoggingService, MockStarkRoutingService } from "@nationalbankbelgium/stark-core/testing";
import { ChangeDetectorRef, NgZone } from "@angular/core";
import { vi } from "vitest";

import { starkAppExitStateName, starkAppInitStateName } from "../constants";
import { StarkAppContainerComponent } from "./app-container.component";

describe("StarkAppContainerComponent", () => {
	let component: StarkAppContainerComponent;
	let mockLogger: MockStarkLoggingService;
	let mockRoutingService: MockStarkRoutingService;
	let mockNgZone: Pick<NgZone, "run">;
	let mockChangeDetectorRef: Pick<ChangeDetectorRef, "detectChanges">;

	beforeEach(() => {
		mockLogger = new MockStarkLoggingService();
		mockRoutingService = new MockStarkRoutingService();
		mockNgZone = {
			run: <T>(fn: (...args: any[]) => T) => fn()
		};
		mockChangeDetectorRef = {
			detectChanges: vi.fn<ChangeDetectorRef["detectChanges"]>()
		};

		component = new StarkAppContainerComponent(
			mockLogger,
			mockRoutingService,
			mockNgZone as NgZone,
			mockChangeDetectorRef as ChangeDetectorRef
		);
	});

	describe("isAppInitOrExitState", () => {
		it("should return true for init child states", () => {
			mockRoutingService.getCurrentStateName.mockReturnValue(`${starkAppInitStateName}.starkPreloading`);

			expect(component.isAppInitOrExitState()).toBe(true);
		});

		it("should return true for exit child states", () => {
			mockRoutingService.getCurrentStateName.mockReturnValue(`${starkAppExitStateName}.starkSessionLogout`);

			expect(component.isAppInitOrExitState()).toBe(true);
		});

		it("should return false for regular app states", () => {
			mockRoutingService.getCurrentStateName.mockReturnValue("home");

			expect(component.isAppInitOrExitState()).toBe(false);
		});
	});

	describe("ngOnInit", () => {
		it("should refresh the init/exit flag and register a routing hook", () => {
			mockRoutingService.getCurrentStateName.mockReturnValue(`${starkAppInitStateName}.starkPreloading`);
			mockRoutingService.addTransitionHook.mockReturnValue(() => undefined);

			component.ngOnInit();

			expect(component.appInitOrExitState).toBe(true);
			expect(mockRoutingService.addTransitionHook).toHaveBeenCalled();
		});

		it("should refresh the init/exit flag when the transition hook fires", () => {
			let registeredHook: (() => boolean) | undefined;

			mockRoutingService.getCurrentStateName
				.mockReturnValueOnce("home")
				.mockReturnValueOnce(`${starkAppExitStateName}.starkSessionLogout`);
			mockRoutingService.addTransitionHook.mockImplementation((_hook, _criteria, callback) => {
				registeredHook = callback as () => boolean;
				return () => undefined;
			});

			component.ngOnInit();

			expect(component.appInitOrExitState).toBe(false);

			const result = registeredHook?.();

			expect(result).toBe(true);
			expect(component.appInitOrExitState).toBe(true);
			expect(mockChangeDetectorRef.detectChanges).toHaveBeenCalled();
		});
	});
});
