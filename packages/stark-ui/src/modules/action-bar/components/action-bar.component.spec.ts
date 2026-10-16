/* eslint-disable @angular-eslint/component-max-inline-declarations */
import { Component, ViewChild } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { MatIconTestingModule } from "@angular/material/icon/testing";
import { STARK_LOGGING_SERVICE, type StarkLoggingService } from "@nationalbankbelgium/stark-core";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { vi } from "vitest";
import { StarkActionBarModule } from "../action-bar.module";
import { StarkActionBarComponent, StarkActionBarComponentMode } from "./action-bar.component";
import { StarkAction } from "./action.intf";
import { StarkActionBarConfig } from "./action-bar-config.intf";

describe("ActionBarComponent", () => {
	const loggingServiceMock: StarkLoggingService = {
		correlationId: "dummyCorrelationId",
		correlationIdHttpHeaderName: "Correlation-Id-HttpHeaderName",
		generateNewCorrelationId: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	} as unknown as StarkLoggingService;

	@Component({
		standalone: true,
		selector: "host-component",
		imports: [StarkActionBarModule],
		template: `
			<stark-action-bar
				[mode]="mode"
				[actionBarId]="actionBarId"
				[actionBarConfig]="actionBarConfig"
				[alternativeActions]="alternativeActions"
			></stark-action-bar>
		`
	})
	class TestHostComponent {
		@ViewChild(StarkActionBarComponent, { static: true })
		public starkActionBar!: StarkActionBarComponent;

		public mode: StarkActionBarComponentMode = "full";
		public actionBarId = "";
		public actionBarConfig: StarkActionBarConfig = { actions: [] };
		public alternativeActions?: StarkAction[];
	}

	// IMPORTANT: The official way to test components using ChangeDetectionStrategy.OnPush is to wrap it with a test host component
	// see https://github.com/angular/angular/issues/12313#issuecomment-444623173
	let hostFixture: ComponentFixture<TestHostComponent>;
	let hostComponent: TestHostComponent;
	let component: StarkActionBarComponent;
	const buttonToggleSelector = ".extend-action-bar";

	function renderHost(initializer?: (host: TestHostComponent) => void): void {
		hostFixture = TestBed.createComponent(TestHostComponent);
		hostComponent = hostFixture.componentInstance;
		const demoActions: StarkAction[] = [
			{
				id: "userDetailValidate",
				label: "Validate",
				icon: "check",
				actionCall: vi.fn(),
				isEnabled: false,
				isVisible: true
			},
			{
				id: "userDetailSave",
				label: "Save",
				icon: "content-save",
				actionCall: vi.fn(),
				isEnabled: true,
				isVisible: true
			}
		];

		hostComponent.actionBarConfig = {
			actions: demoActions,
			isPresent: true
		};
		initializer?.(hostComponent);
		hostFixture.detectChanges();
		component = hostComponent.starkActionBar;
	}

	beforeEach(waitForAsync(() =>
		TestBed.configureTestingModule({
			imports: [MatIconTestingModule, TestHostComponent, TranslateModule.forRoot()],
			providers: [{ provide: STARK_LOGGING_SERVICE, useValue: loggingServiceMock }, TranslateService]
		}).compileComponents()));

	beforeEach(() => {
		renderHost();
	});

	describe("@Input() mode", () => {
		it("should have the toggle action bar button visible in full mode", () => {
			renderHost((host) => {
				host.mode = "full";
			});

			const buttonToggleExtend: HTMLElement = hostFixture.nativeElement.querySelector(buttonToggleSelector);
			expect(buttonToggleExtend).toBeDefined();
		});

		it("should not have the toggle action bar button visible in compact mode", () => {
			renderHost((host) => {
				host.mode = "compact";
			});

			const buttonToggleExtend: HTMLElement = hostFixture.nativeElement.querySelector(buttonToggleSelector);
			expect(buttonToggleExtend).toBeNull();
		});
	});

	describe("@Input() actionBarId", () => {
		it("should have set the id of the action bar", () => {
			renderHost((host) => {
				host.actionBarId = "action-bar-id";
			});

			const actionBar: HTMLElement = hostFixture.nativeElement.querySelector("#" + hostComponent.actionBarId);
			expect(actionBar).toBeDefined();
		});
	});

	describe("@Input() actionBarConfig", () => {
		it("should not call the defined action when disabled", () => {
			const menuItem: HTMLElement = hostFixture.nativeElement.querySelector(
				`#${hostComponent.actionBarId}-${hostComponent.actionBarConfig.actions[0].id}`
			);
			menuItem.click();
			expect(hostComponent.actionBarConfig.actions[0].actionCall).not.toHaveBeenCalled();
		});

		it("should call the defined action when enabled", () => {
			const menuItem: HTMLElement = hostFixture.nativeElement.querySelector(
				`#${hostComponent.actionBarId}-${hostComponent.actionBarConfig.actions[1].id}`
			);
			menuItem.click();
			expect(hostComponent.actionBarConfig.actions[1].actionCall).toHaveBeenCalledTimes(1);
		});
	});

	describe("@Input() alternativeActions", () => {
		beforeEach(() => {
			renderHost((host) => {
				host.alternativeActions = host.actionBarConfig.actions;
			});
		});

		it("should display", () => {
			const actionBar: HTMLElement = hostFixture.nativeElement.querySelector(".open-alt-actions");
			expect(actionBar).toBeDefined();
		});
	});

	describe("toggle extended action bar", () => {
		it("should toggle the action bar extension", () => {
			renderHost((host) => {
				host.mode = "full";
			});

			const buttonToggleExtend: HTMLElement = hostFixture.nativeElement.querySelector(buttonToggleSelector);
			const toggleSpy = vi.spyOn(component, "toggleExtendedActionBar");
			buttonToggleExtend.click();
			hostFixture.detectChanges();

			expect(toggleSpy).toHaveBeenCalledTimes(1);
			expect(component.isExtended).toBe(true);
			buttonToggleExtend.click();

			hostFixture.detectChanges();
			expect(toggleSpy).toHaveBeenCalledTimes(2);
			expect(component.isExtended).toBe(false);
		});
	});
});
