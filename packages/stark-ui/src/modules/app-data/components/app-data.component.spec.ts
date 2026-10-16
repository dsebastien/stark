/* eslint-disable @angular-eslint/component-max-inline-declarations, @angular-eslint/no-lifecycle-call */
import { StarkAppDataComponent, StarkAppDataComponentMode } from "./app-data.component";
import { STARK_LOGGING_SERVICE, type StarkLoggingService } from "@nationalbankbelgium/stark-core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { MatIconTestingModule } from "@angular/material/icon/testing";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ChangeDetectionStrategy, ViewChild, Component } from "@angular/core";
import { OverlayContainer } from "@angular/cdk/overlay";
import { vi } from "vitest";
import { StarkAppDataModule } from "../app-data.module";

@Component({
	standalone: true,
	selector: `host-component`,
	changeDetection: ChangeDetectionStrategy.Default,
	imports: [StarkAppDataModule],
	template: `
		<stark-app-data [mode]="mode">
			<div class="summary-slot">This is the summary</div>
			<div class="detail-slot">This is the detail</div>
		</stark-app-data>
	`
})
class TestHostComponent {
	@ViewChild(StarkAppDataComponent, { static: true })
	public appDataComponent!: StarkAppDataComponent;
	public mode?: StarkAppDataComponentMode;
}

describe("AppDataComponent", () => {
	let component: StarkAppDataComponent;
	let hostComponent: TestHostComponent;
	let hostFixture: ComponentFixture<TestHostComponent>;

	// Rendered menu context
	let overlayContainer: OverlayContainer;
	let overlayContainerElement: HTMLElement;

	const detailSlotContent = "This is the detail";
	const summarySlotContent = "This is the summary";

	const loggingServiceMock: StarkLoggingService = {
		correlationId: "dummyCorrelationId",
		correlationIdHttpHeaderName: "Correlation-Id-HttpHeaderName",
		generateNewCorrelationId: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	} as unknown as StarkLoggingService;

	const getRenderedOverlayText = (): string => {
		return (overlayContainerElement.textContent || "").trim();
	};

	const getMenuPanel = (): HTMLElement => {
		const matPanelElement: HTMLElement | null = overlayContainerElement.querySelector(".mat-mdc-menu-panel");
		expect(matPanelElement).toBeTruthy();

		return <HTMLElement>matPanelElement;
	};

	const getDetailButton = (selector: string): HTMLButtonElement => {
		const button: HTMLButtonElement | null = hostFixture.nativeElement.querySelector(selector);
		expect(button).toBeTruthy();

		return <HTMLButtonElement>button;
	};

	const settleOverlayInteraction = async (): Promise<void> => {
		await hostFixture.whenStable();
		await new Promise((resolve) => setTimeout(resolve, 500));
		hostFixture.detectChanges();
		await hostFixture.whenStable();
		hostFixture.detectChanges();
	};

	const renderComponent = (mode?: StarkAppDataComponentMode): void => {
		hostComponent.mode = mode;
		hostFixture.detectChanges();
		component = hostComponent.appDataComponent;
	};

	beforeEach(waitForAsync(() =>
		TestBed.configureTestingModule({
			imports: [MatIconTestingModule, NoopAnimationsModule, TestHostComponent, TranslateModule.forRoot()],
			providers: [{ provide: STARK_LOGGING_SERVICE, useValue: loggingServiceMock }, TranslateService]
		}).compileComponents()));

	beforeEach(() => {
		// OverlayContainer needs to be injected to get the context for the rendered menu dropdown
		overlayContainer = TestBed.inject(OverlayContainer);
		overlayContainerElement = overlayContainer.getContainerElement();

		hostFixture = TestBed.createComponent(TestHostComponent);
		hostComponent = hostFixture.componentInstance;
	});

	afterEach(() => {
		overlayContainer.ngOnDestroy();
	});

	describe("on initialization", () => {
		beforeEach(() => {
			renderComponent();
		});

		it("should set internal component properties", () => {
			expect(hostFixture).toBeDefined();
			expect(hostComponent).toBeDefined();
			expect(component).toBeDefined();

			expect(component.logger).not.toBeNull();
			expect(component.logger).toBeDefined();
		});
	});

	describe("using 'dropdown' mode", () => {
		// Prepare hostComponent
		beforeEach(() => {
			renderComponent("dropdown");
		});

		describe("summary", () => {
			it("should display the summary content", () => {
				const summary: HTMLElement | null = hostFixture.nativeElement.querySelector(".stark-app-data-summary");
				expect(summary).toBeTruthy();
				expect((summary && summary.textContent) || "").toContain(summarySlotContent);
			});
		});

		describe("detail", () => {
			it("detail information should NOT be displayed on init", () => {
				expect(getRenderedOverlayText()).toBe("");
			});

			describe("open detail", () => {
				beforeEach(() => {
					// Open Detail
					const button = getDetailButton(".stark-app-data.dropdown button");
					button.click();
					hostFixture.detectChanges();
				});

				it("clicking button should display detail information", () => {
					expect(getRenderedOverlayText()).toBe(detailSlotContent);
					const matPanelElement = getMenuPanel();
					expect(matPanelElement.classList).toContain("stark-app-data");
					expect(matPanelElement.classList).toContain("dropdown-detail");
				});

				it("clicking outside the mat-menu-panel should close the detail", async () => {
					const backdrop = <HTMLElement>overlayContainerElement.querySelector(".cdk-overlay-backdrop");
					backdrop.click();
					hostFixture.detectChanges();
					await settleOverlayInteraction();

					expect(getRenderedOverlayText()).toBe("");
				});

				it("clicking inside the mat-menu-panel should NOT close the detail", async () => {
					const detail = <HTMLElement>overlayContainerElement.querySelector(".stark-app-data-detail");
					expect(detail).not.toBeNull();
					detail.click();
					hostFixture.detectChanges();
					await settleOverlayInteraction();

					expect(getRenderedOverlayText()).toBe(detailSlotContent);
				});
			});
		});
	});

	describe("using 'menu' mode", () => {
		// Prepare hostComponent
		beforeEach(() => {
			renderComponent("menu");
		});

		describe("summary", () => {
			it("should NOT display the summary content", () => {
				const summary: HTMLElement | null = hostFixture.nativeElement.querySelector(".stark-app-data-summary");
				expect(summary).toBeNull();
			});
		});

		describe("detail", () => {
			it("detail information should NOT be displayed on init", () => {
				expect(getRenderedOverlayText()).toBe("");
			});

			describe("open detail", () => {
				beforeEach(() => {
					// Open Detail
					const button = getDetailButton(".stark-app-data.menu button");
					button.click();
					hostFixture.detectChanges();
				});

				it("clicking button should display detail information", () => {
					expect(getRenderedOverlayText()).toBe(detailSlotContent);
					const matPanelElement = getMenuPanel();
					expect(matPanelElement.classList).toContain("stark-app-data");
					expect(matPanelElement.classList).toContain("menu-detail");
				});

				it("clicking outside the mat-menu-panel should close the detail", async () => {
					const backdrop = <HTMLElement>overlayContainerElement.querySelector(".cdk-overlay-backdrop");
					backdrop.click();
					hostFixture.detectChanges();
					await settleOverlayInteraction();

					expect(getRenderedOverlayText()).toBe("");
				});

				it("clicking inside the mat-menu-panel should NOT close the detail", async () => {
					expect(getRenderedOverlayText()).toBe(detailSlotContent);

					const detail = <HTMLElement>overlayContainerElement.querySelector(".stark-app-data-detail");
					expect(detail).not.toBeNull();
					detail.click();
					hostFixture.detectChanges();
					await settleOverlayInteraction();

					expect(getRenderedOverlayText()).toBe(detailSlotContent);
				});
			});
		});
	});
});
