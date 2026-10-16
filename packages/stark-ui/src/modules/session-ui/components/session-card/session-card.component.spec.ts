import { ComponentFixture, TestBed } from "@angular/core/testing";
import { TranslateModule } from "@ngx-translate/core";
import { Component } from "@angular/core";
import { STARK_LOGGING_SERVICE, STARK_ROUTING_SERVICE } from "@nationalbankbelgium/stark-core";
import { StarkSessionCardComponent } from "./session-card.component";
import { vi } from "vitest";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

type RoutingServiceMock = {
	navigateToHome: ReturnType<typeof vi.fn<() => void>>;
};

@Component({
	standalone: true,
	selector: "test-component",
	imports: [StarkSessionCardComponent],
	template: `
		<stark-session-card [cardTitle]="cardTitle">
			<div>TEST</div>
		</stark-session-card>
	`
})
class TestComponent {
	public cardTitle = "";
}

describe("SessionCardComponent", () => {
	let fixture: ComponentFixture<TestComponent>;
	let component: TestComponent;
	let mockLogger: LoggingServiceMock;
	let mockRoutingService: RoutingServiceMock;

	beforeEach(async () => {
		mockLogger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};
		mockRoutingService = {
			navigateToHome: vi.fn<() => void>()
		};

		await TestBed.configureTestingModule({
			imports: [TranslateModule.forRoot(), TestComponent],
			providers: [
				{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger },
				{ provide: STARK_ROUTING_SERVICE, useValue: mockRoutingService } // needed by AppLogo component
			]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(TestComponent);
		component = fixture.componentInstance;
	});

	it("Component should render", () => {
		const expected = "TEST";

		const sessionCard: HTMLElement | null = fixture.nativeElement.querySelector("stark-session-card");
		expect(sessionCard).not.toBeNull();
		expect(sessionCard?.textContent).toEqual(expected);
	});

	it("Title should not render when falsy", () => {
		component.cardTitle = "";
		fixture.detectChanges();

		const titleElement: HTMLElement | null = fixture.nativeElement.querySelector("stark-session-card mat-card-header mat-card-title");
		expect(titleElement).toBeNull();
	});

	it("Title should render when given", () => {
		component.cardTitle = "Testing-title";
		fixture.detectChanges();

		const expected = "Testing-title";

		const titleElement: HTMLElement | null = fixture.nativeElement.querySelector("stark-session-card mat-card-header mat-card-title");
		expect(titleElement).not.toBeNull();
		expect(titleElement?.textContent).toEqual(expected);
	});
});
