import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { MatIconTestingModule } from "@angular/material/icon/testing";
import { STARK_LOGGING_SERVICE, STARK_ROUTING_SERVICE } from "@nationalbankbelgium/stark-core";
import { TranslateModule } from "@ngx-translate/core";
import { vi } from "vitest";
import { StarkAppMenuComponent } from "./app-menu.component";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

type RoutingServiceMock = {
	navigateTo: ReturnType<typeof vi.fn<(state: string, params?: unknown) => void>>;
	isCurrentUiStateIncludedIn: ReturnType<typeof vi.fn<(state: string) => boolean>>;
	isCurrentUiState: ReturnType<typeof vi.fn<(state: string) => boolean>>;
	addTransitionHook: ReturnType<typeof vi.fn<(...args: unknown[]) => VoidFunction>>;
};

describe("AppMenuComponent", () => {
	let component: StarkAppMenuComponent;
	let fixture: ComponentFixture<StarkAppMenuComponent>;
	let mockLogger: LoggingServiceMock;
	let mockRoutingService: RoutingServiceMock;

	beforeEach(async () => {
		mockLogger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};
		mockRoutingService = {
			navigateTo: vi.fn<(state: string, params?: unknown) => void>(),
			isCurrentUiStateIncludedIn: vi.fn<(state: string) => boolean>(() => false),
			isCurrentUiState: vi.fn<(state: string) => boolean>(() => false),
			addTransitionHook: vi.fn<(...args: unknown[]) => VoidFunction>(() => vi.fn())
		};

		await TestBed.configureTestingModule({
			imports: [MatIconTestingModule, NoopAnimationsModule, TranslateModule.forRoot(), StarkAppMenuComponent],
			providers: [
				{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger },
				{ provide: STARK_ROUTING_SERVICE, useValue: mockRoutingService }
			]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(StarkAppMenuComponent);
		component = fixture.componentInstance;
	});

	describe("sections", () => {
		it("should have a section when menuSections property of menuConfig is set", () => {
			component.menuConfig = {
				menuSections: [
					{
						label: "Section",
						menuGroups: [
							{
								id: "id-item",
								label: "Label",
								isVisible: true,
								isEnabled: true,
								targetState: "test"
							}
						]
					}
				]
			};

			fixture.detectChanges();

			const sectionTitle: HTMLElement = fixture.nativeElement.querySelector(".stark-section-title");
			expect(sectionTitle).toBeDefined();
		});
	});
});
