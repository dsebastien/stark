import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { STARK_LOGGING_SERVICE } from "@nationalbankbelgium/stark-core";
import { vi } from "vitest";
import { StarkProgressIndicatorComponent } from "./progress-indicator.component";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

describe("ProgressIndicatorComponent", () => {
	let component: StarkProgressIndicatorComponent;
	let hostFixture: ComponentFixture<StarkProgressIndicatorComponent>;
	let mockLogger: LoggingServiceMock;

	beforeEach(async () => {
		mockLogger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};

		await TestBed.configureTestingModule({
			imports: [StarkProgressIndicatorComponent],
			providers: [{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger }]
		}).compileComponents();
	});

	beforeEach(() => {
		hostFixture = TestBed.createComponent(StarkProgressIndicatorComponent);
		component = hostFixture.componentInstance;
		hostFixture.detectChanges();
	});

	describe("on initialization", () => {
		it("should set internal component properties", () => {
			expect(hostFixture).toBeDefined();
			expect(component).toBeDefined();
			expect(component.logger).not.toBeNull();
			expect(component.logger).toBeDefined();
		});
	});

	describe("progress indicator", () => {
		it("should be correctly displayed", () => {
			const progressIndicator = hostFixture.debugElement.query(By.css("div.stark-loading-icon"));
			expect(progressIndicator).toBeTruthy();
		});
	});
});
