/* eslint-disable @angular-eslint/no-lifecycle-call */

import { ComponentFixture, TestBed } from "@angular/core/testing";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { STARK_LOGGING_SERVICE } from "@nationalbankbelgium/stark-core";
import { vi } from "vitest";
import { StarkAppFooterComponent } from "./app-footer.component";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

describe("AppFooterComponent", () => {
	let component: StarkAppFooterComponent;
	let fixture: ComponentFixture<StarkAppFooterComponent>;
	let translateService: TranslateService;
	let mockLogger: LoggingServiceMock;

	const currentYear: string = new Date().getFullYear().toString();

	beforeEach(async () => {
		mockLogger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};

		await TestBed.configureTestingModule({
			imports: [TranslateModule.forRoot(), StarkAppFooterComponent],
			providers: [{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger }]
		}).compileComponents();

		translateService = TestBed.inject(TranslateService);
		translateService.addLangs(["en", "fr", "nl", "de"]);
		translateService.setDefaultLang("en");
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(StarkAppFooterComponent);
		component = fixture.componentInstance;
		component.legalInfoUrl = "legal-info";
		component.helpPageUrl = "help-page";
		fixture.detectChanges();
	});

	describe("on initialization", () => {
		it("should set internal component properties", () => {
			expect(fixture).toBeDefined();
			expect(component).toBeDefined();
			expect(component.logger).not.toBeNull();
			expect(component.logger).toBeDefined();
			expect(component.$translate).not.toBeNull();
			expect(component.$translate).toBeDefined();
		});

		it("should have been initialized", () => {
			component.ngOnInit();

			expect(component.legalInfoUrl).not.toBeNull();
			expect(component.legalInfoUrl).toBeDefined();
			expect(component.legalInfoUrl).toBe("legal-info");
			expect(component.helpPageUrl).not.toBeNull();
			expect(component.helpPageUrl).toBeDefined();
			expect(component.helpPageUrl).toBe("help-page");
			expect(component.copyrightPeriod).not.toBeNull();
			expect(component.copyrightPeriod).toBeDefined();
			expect(component.copyrightPeriod).toBe("STARK.APP_FOOTER.COPYRIGHT_YEAR - " + currentYear);
		});
	});

	describe("getCopyrightYear()", () => {
		it("should give back copyright year", () => {
			const copyrightYear: string = component.getCopyrightYear();

			expect(copyrightYear).toBeDefined();
			expect(copyrightYear).toBe("STARK.APP_FOOTER.COPYRIGHT_YEAR");
		});
	});

	describe("getCopyrightPeriod()", () => {
		it("should give back copyright period", () => {
			let copyrightPeriod: string = component.getCopyrightPeriod("toto");

			expect(copyrightPeriod).toBeDefined();
			expect(copyrightPeriod).toBe("toto - " + currentYear);

			copyrightPeriod = component.getCopyrightPeriod(currentYear);

			expect(copyrightPeriod).toBeDefined();
			expect(copyrightPeriod).toBe(currentYear);
		});
	});
});
