import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { Component, ViewChild } from "@angular/core";
import { MatIconTestingModule } from "@angular/material/icon/testing";
import {
	STARK_LOGGING_SERVICE,
	STARK_ROUTING_SERVICE,
	type StarkLoggingService,
	type StarkRoutingService
} from "@nationalbankbelgium/stark-core";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { StarkAppMenuItemComponent } from "./app-menu-item.component";
import { StarkMenuGroup } from "./app-menu-group.intf";
import { vi } from "vitest";
import { StarkAppMenuModule } from "../app-menu.module";

describe("AppMenuItemComponent", () => {
	const loggingServiceMock: StarkLoggingService = {
		correlationId: "dummyCorrelationId",
		correlationIdHttpHeaderName: "Correlation-Id-HttpHeaderName",
		generateNewCorrelationId: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	} as unknown as StarkLoggingService;

	const mockRoutingService = {
		navigateTo: vi.fn(),
		isCurrentUiStateIncludedIn: vi.fn(),
		isCurrentUiState: vi.fn(),
		addTransitionHook: vi.fn(() => vi.fn())
	};

	function getTransitionHookCallback(index: number): () => void {
		const call = mockRoutingService.addTransitionHook.mock.calls[index] as unknown[] | undefined;
		const callback = call?.[2];

		if (typeof callback !== "function") {
			throw new Error(`Expected addTransitionHook call ${index} to register a callback`);
		}

		return callback as () => void;
	}

	@Component({
		standalone: true,
		selector: "host-component",
		imports: [StarkAppMenuModule],
		template: ` <stark-app-menu-item [level]="level" [menuGroup]="menuGroup"></stark-app-menu-item> `
	})
	class TestHostComponent {
		@ViewChild(StarkAppMenuItemComponent, { static: true })
		public starkAppMenuItem!: StarkAppMenuItemComponent;

		public level = 1;
		public menuGroup: StarkMenuGroup = {
			id: "id-item",
			label: "Label",
			isVisible: true,
			isEnabled: true,
			targetState: "test"
		};
	}

	// IMPORTANT: The official way to test components using ChangeDetectionStrategy.OnPush is to wrap it with a test host component
	// see https://github.com/angular/angular/issues/12313#issuecomment-444623173
	let hostComponent: TestHostComponent;
	let component: StarkAppMenuItemComponent;
	let hostFixture: ComponentFixture<TestHostComponent>;

	const renderHost = (initializer?: (host: TestHostComponent) => void): void => {
		hostFixture?.destroy();
		hostFixture = TestBed.createComponent(TestHostComponent);
		hostComponent = hostFixture.componentInstance;
		initializer?.(hostComponent);
		hostFixture.detectChanges();
		component = hostComponent.starkAppMenuItem;
		mockRoutingService.navigateTo.mockClear();
		mockRoutingService.isCurrentUiStateIncludedIn.mockClear();
		mockRoutingService.isCurrentUiState.mockClear();
	};

	/**
	 * async beforeEach
	 */
	beforeEach(waitForAsync(() =>
		TestBed.configureTestingModule({
			imports: [MatIconTestingModule, NoopAnimationsModule, TestHostComponent, TranslateModule.forRoot()],
			providers: [
				{ provide: STARK_LOGGING_SERVICE, useValue: loggingServiceMock },
				{ provide: STARK_ROUTING_SERVICE, useValue: mockRoutingService as unknown as StarkRoutingService },
				TranslateService
			]
		})
			/**
			 * Compile template and css
			 */
			.compileComponents()));

	/**
	 * Synchronous beforeEach
	 */
	beforeEach(() => {
		mockRoutingService.addTransitionHook.mockReset();
		mockRoutingService.addTransitionHook.mockImplementation(() => vi.fn());
		renderHost();
	});

	describe("simple menu item", () => {
		it("id should be set", () => {
			const item: HTMLElement = hostFixture.nativeElement.querySelector("#" + hostComponent.menuGroup.id);
			expect(item).toBeDefined();
		});

		it("should trigger a navigation when clicked", () => {
			const item: HTMLElement = hostFixture.nativeElement.querySelector("#" + hostComponent.menuGroup.id);
			item.click();
			hostFixture.detectChanges();

			expect(mockRoutingService.navigateTo).toHaveBeenCalledTimes(1);
		});

		it("should have the 'stark-disabled' class set when 'isEnabled' is false", () => {
			renderHost((host: TestHostComponent) => {
				host.menuGroup = { ...host.menuGroup, isEnabled: false };
			});

			const item: HTMLElement = hostFixture.nativeElement.querySelector("#" + hostComponent.menuGroup.id);
			item.click();
			hostFixture.detectChanges();

			expect(item.classList).toContain("stark-disabled");
			expect(mockRoutingService.navigateTo).toHaveBeenCalledTimes(0);
		});

		it("should have the 'active' class when 'isActive' is true", () => {
			const item: HTMLElement = hostFixture.nativeElement.querySelector("#" + hostComponent.menuGroup.id);
			expect(item.classList).not.toContain("active");

			component.isActive = true;
			hostFixture.detectChanges();

			expect(item.classList).toContain("active");

			component.isActive = false;
			hostFixture.detectChanges();

			expect(item.classList).not.toContain("active");
		});

		it("should be displayed when 'isVisible' is true", () => {
			renderHost((host: TestHostComponent) => {
				host.menuGroup = { ...host.menuGroup, isVisible: false };
			});

			let item: HTMLElement = hostFixture.nativeElement.querySelector("#" + hostComponent.menuGroup.id);
			expect(item).toBeFalsy();

			renderHost((host: TestHostComponent) => {
				host.menuGroup = { ...host.menuGroup, isVisible: true };
			});

			item = hostFixture.nativeElement.querySelector("#" + hostComponent.menuGroup.id);
			expect(item).toBeTruthy();
		});

		it("should dispatch 'activated' event when 'isActive' is true", () => {
			const emitSpy = vi.spyOn(component.activated, "emit");
			component.isActive = true;
			hostFixture.detectChanges();

			expect(emitSpy).toHaveBeenCalledTimes(1);
		});

		it("should dispatch 'deactivated' event when 'isActive' is false", () => {
			const emitSpy = vi.spyOn(component.deactivated, "emit");
			component.isActive = false;
			hostFixture.detectChanges();

			expect(emitSpy).toHaveBeenCalledTimes(1);
		});

		it("should render the configured menu item icon", () => {
			renderHost((host: TestHostComponent) => {
				host.menuGroup = { ...host.menuGroup, icon: "home" };
			});

			const icon: HTMLElement = hostFixture.nativeElement.querySelector("mat-icon.stark-small-icon");

			expect(icon).toBeTruthy();
		});

		it("should activate when child state is selected and do not have child menu", () => {
			hostFixture.detectChanges();
			// `stateChange` is attached to `routingTransitionSuccessCallback` in `StarkAppMenuItemComponent`
			const stateChange = getTransitionHookCallback(0);
			mockRoutingService.isCurrentUiStateIncludedIn.mockImplementation((state) => state === "test");
			stateChange();
			expect(component.isActive).toBe(true);
			expect(mockRoutingService.isCurrentUiStateIncludedIn).toHaveBeenCalledWith("test");
			expect(mockRoutingService.isCurrentUiState).not.toHaveBeenCalledWith("test");
		});
	});

	describe("menu item with children", () => {
		beforeEach(() => {
			hostComponent.menuGroup.entries = [
				{
					id: "id-child-1",
					label: "Child 1",
					isVisible: true,
					isEnabled: true,
					targetState: "child-1-route"
				},
				{
					id: "id-child-2",
					label: "Child 2",
					isVisible: true,
					isEnabled: true,
					targetState: "child-2-route"
				}
			];
			hostFixture.detectChanges();
		});

		it("should have an expansion panel", () => {
			const expansionPanel: HTMLElement = hostFixture.nativeElement.querySelector(".mat-expansion-panel");
			expect(expansionPanel).toBeDefined();
		});

		it("should not activate when child state is selected and do not have child menu", () => {
			hostFixture.detectChanges();
			// `stateChange` is attached to `routingTransitionSuccessCallback` in `StarkAppMenuItemComponent`
			const stateChange = getTransitionHookCallback(0);
			mockRoutingService.isCurrentUiState.mockImplementation((state) => state === "active-state");
			stateChange();
			expect(component.isActive).toBe(false);
			expect(mockRoutingService.isCurrentUiStateIncludedIn).not.toHaveBeenCalledWith("test");
			expect(mockRoutingService.isCurrentUiState).toHaveBeenCalledWith("test");
		});
	});
});
