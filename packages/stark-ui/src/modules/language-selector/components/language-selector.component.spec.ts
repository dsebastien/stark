import { Component, ViewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { DateAdapter } from "@angular/material/core";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import {
	STARK_APP_METADATA,
	STARK_LOGGING_SERVICE,
	STARK_SESSION_SERVICE,
	StarkApplicationMetadata,
	StarkApplicationMetadataImpl,
	StarkSessionService,
	StarkLanguages
} from "@nationalbankbelgium/stark-core";
import { TranslateModule } from "@ngx-translate/core";
import { Observable, of, throwError } from "rxjs";
import { vi } from "vitest";
import { StarkLanguageSelectorModule } from "../language-selector.module";
import { StarkLanguageSelectorComponent, StarkLanguageSelectorMode } from "./language-selector.component";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn>;
	error: ReturnType<typeof vi.fn>;
	warn: ReturnType<typeof vi.fn>;
};

type SessionServiceMock = {
	getCurrentLanguage: ReturnType<typeof vi.fn>;
	setCurrentLanguage: ReturnType<typeof vi.fn>;
};

type DateAdapterMock = {
	setLocale: ReturnType<typeof vi.fn>;
};

@Component({
	standalone: true,
	selector: "host-component",
	imports: [StarkLanguageSelectorModule],
	template: `<stark-language-selector [mode]="mode"></stark-language-selector>`
})
class TestHostComponent {
	@ViewChild(StarkLanguageSelectorComponent, { static: true })
	public languageSelectorComponent!: StarkLanguageSelectorComponent;

	public mode: StarkLanguageSelectorMode = "dropdown";
}

describe("LanguageSelectorComponent", () => {
	let component: StarkLanguageSelectorComponent;
	let hostFixture: ComponentFixture<TestHostComponent>;
	let logger: LoggingServiceMock;
	let sessionService: SessionServiceMock;
	let dateAdapter: DateAdapterMock;

	const appMetadata: StarkApplicationMetadata = createAppMetadata();

	describe("on initialization", () => {
		beforeEach(async () => {
			await renderHost(of("fr"));
		});

		it("should set internal component properties", () => {
			expect(hostFixture).toBeDefined();
			expect(component).toBeDefined();
			expect(component.logger).toBeDefined();
		});

		it("should have inputs", () => {
			expect(component.languageSelectorId).toBeDefined();
			expect(component.mode).toBeDefined();
			expect(component.selectedLanguage).toBeDefined();
		});
	});

	describe("on failing initialization", () => {
		beforeEach(async () => {
			await renderHost(throwError(() => "dummy-error"));
		});

		it("should log an error when the sessionService.getCurrentLanguage fails", () => {
			expect(component.logger).toBeDefined();
			expect(logger.error).toHaveBeenCalledTimes(1);
		});
	});

	describe("on changeLanguage", () => {
		beforeEach(async () => {
			await renderHost(of("fr"));
		});

		it("should change the selected language", () => {
			expect(component.selectedLanguage).toBe("fr");
			component.changeLanguage("nl");
			expect(component.selectedLanguage).toBe("nl");
			component.changeLanguage("en");
			expect(component.selectedLanguage).toBe("en");
			component.changeLanguage("fr");
			expect(component.selectedLanguage).toBe("fr");
			component.changeLanguage("en");
			expect(component.selectedLanguage).toBe("en");
		});
	});

	async function renderHost(currentLanguage$: Observable<string>): Promise<void> {
		logger = createLoggerMock();
		sessionService = createSessionServiceMock(currentLanguage$);
		dateAdapter = createDateAdapterMock();

		await TestBed.configureTestingModule({
			imports: [TestHostComponent, NoopAnimationsModule, TranslateModule.forRoot()],
			providers: [
				{ provide: STARK_APP_METADATA, useValue: appMetadata },
				{ provide: STARK_LOGGING_SERVICE, useValue: logger },
				{ provide: STARK_SESSION_SERVICE, useValue: sessionService as unknown as StarkSessionService },
				{ provide: DateAdapter, useValue: dateAdapter as unknown as DateAdapter<unknown> }
			]
		}).compileComponents();

		hostFixture = TestBed.createComponent(TestHostComponent);
		hostFixture.detectChanges();
		component = hostFixture.componentInstance.languageSelectorComponent;
	}
});

function createAppMetadata(): StarkApplicationMetadata {
	const appMetadata = new StarkApplicationMetadataImpl();
	appMetadata.supportedLanguages = [StarkLanguages.EN_US, StarkLanguages.FR_BE, StarkLanguages.NL_BE];
	return appMetadata;
}

function createLoggerMock(): LoggingServiceMock {
	return {
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn()
	};
}

function createSessionServiceMock(currentLanguage$: Observable<string>): SessionServiceMock {
	return {
		getCurrentLanguage: vi.fn(() => currentLanguage$),
		setCurrentLanguage: vi.fn()
	};
}

function createDateAdapterMock(): DateAdapterMock {
	return {
		setLocale: vi.fn()
	};
}
