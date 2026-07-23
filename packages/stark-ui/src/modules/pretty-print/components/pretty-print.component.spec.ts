import { CommonModule } from "@angular/common";
import { Component, NgModule, SimpleChange, SimpleChanges, ViewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { STARK_LOGGING_SERVICE, StarkLoggingService } from "@nationalbankbelgium/stark-core";
import { firstValueFrom, of, throwError } from "rxjs";
import { vi } from "vitest";
import { STARK_PRETTY_PRINT_SERVICE, StarkPrettyPrintService, StarkPrettyPrintServiceImpl } from "../services";
import { StarkPrettyPrintFormat } from "../types";
import { StarkPrettyPrintComponent } from "./pretty-print.component";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn>;
	error: ReturnType<typeof vi.fn>;
	warn: ReturnType<typeof vi.fn>;
};

type PrettyPrintServiceMock = {
	format: ReturnType<typeof vi.fn>;
};

@NgModule({
	declarations: [StarkPrettyPrintComponent],
	imports: [CommonModule],
	exports: [StarkPrettyPrintComponent]
})
class TestPrettyPrintModule {}

@Component({
	standalone: true,
	selector: "host-component",
	imports: [TestPrettyPrintModule],
	template: `<stark-pretty-print
		[data]="$any(data)"
		[format]="$any(format)"
		[enableHighlighting]="enableHighlighting"
	></stark-pretty-print>`
})
class TestHostComponent {
	@ViewChild(StarkPrettyPrintComponent, { static: true })
	public prettyPrintComponent!: StarkPrettyPrintComponent;

	public data?: string;
	public format?: StarkPrettyPrintFormat;
	public enableHighlighting?: boolean;
}

describe("PrettyPrintComponent", () => {
	let component: StarkPrettyPrintComponent;
	let hostComponent: TestHostComponent;
	let hostFixture: ComponentFixture<TestHostComponent>;
	let mockPrettyPrintService: PrettyPrintServiceMock;

	type HostInitializer = (host: TestHostComponent) => void;
	type PrettyPrintInputChanges = {
		data?: string;
		format?: StarkPrettyPrintFormat;
		enableHighlighting?: boolean;
	};

	const rawHtmlData = [
		"<!DOCTYPE html><html><head>",
		"<style>body {background-color: powderblue;}h1{color: blue;}flashy{color: red;}</style>",
		"</head><body><h1>This is a heading</h1>",
		'<p class="flashy">This is a flashy paragraph.</p>',
		"</body></html>"
	].join("");

	const formattedHtmlData = [
		"<!doctype html>",
		"<html>",
		"  <head>",
		"    <style>",
		"      body {",
		"        background-color: powderblue;",
		"      }",
		"      h1 {",
		"        color: blue;",
		"      }",
		"      flashy {",
		"        color: red;",
		"      }",
		"    </style>",
		"  </head>",
		"  <body>",
		"    <h1>This is a heading</h1>",
		'    <p class="flashy">This is a flashy paragraph.</p>',
		"  </body>",
		"</html>",
		""
	].join("\n");

	const rawAngularHtmlData = [
		"<!DOCTYPE html><html><head>",
		"<style>body {background-color: powderblue;}h1{color: blue;}flashy{color: red;}</style>",
		"</head><body><h1>This is a {{heading|uppercase}}</h1>",
		'<p class="flashy">This is a flashy paragraph.</p>',
		'<button class="dummy-class" [class.active]="isActive" color="primary" (click)=triggerAction($event)>Click me</button>',
		"</body></html>"
	].join("");

	const formattedAngularHtmlData = [
		"<!doctype html>",
		"<html>",
		"  <head>",
		"    <style>",
		"      body {",
		"        background-color: powderblue;",
		"      }",
		"      h1 {",
		"        color: blue;",
		"      }",
		"      flashy {",
		"        color: red;",
		"      }",
		"    </style>",
		"  </head>",
		"  <body>",
		"    <h1>This is a {{ heading | uppercase }}</h1>",
		'    <p class="flashy">This is a flashy paragraph.</p>',
		"    <button",
		'      class="dummy-class"',
		'      [class.active]="isActive"',
		'      color="primary"',
		'      (click)="triggerAction($event)"',
		"    >",
		"      Click me",
		"    </button>",
		"  </body>",
		"</html>",
		""
	].join("\n");

	beforeEach(async () => {
		mockPrettyPrintService = {
			format: vi.fn()
		};

		await TestBed.configureTestingModule({
			imports: [TestHostComponent],
			providers: [
				{ provide: STARK_LOGGING_SERVICE, useValue: createLoggerMock() },
				{ provide: STARK_PRETTY_PRINT_SERVICE, useValue: mockPrettyPrintService as unknown as StarkPrettyPrintService }
			]
		}).compileComponents();
	});

	const renderHost = (initializer?: HostInitializer): void => {
		hostFixture = TestBed.createComponent(TestHostComponent);
		hostComponent = hostFixture.componentInstance;
		initializer?.(hostComponent);
		hostFixture.detectChanges();

		component = hostComponent.prettyPrintComponent;
	};

	const applyInputChanges = (changes: PrettyPrintInputChanges): void => {
		const onChangesObject: SimpleChanges = {};

		if (Object.prototype.hasOwnProperty.call(changes, "data")) {
			onChangesObject["data"] = new SimpleChange(component.data, changes.data, typeof component.data === "undefined");
			hostComponent.data = changes.data;
			component.data = changes.data ?? "";
		}

		if (Object.prototype.hasOwnProperty.call(changes, "format")) {
			onChangesObject["format"] = new SimpleChange(component.format, changes.format, typeof component.format === "undefined");
			hostComponent.format = changes.format;
			component.format = changes.format;
		}

		if (Object.prototype.hasOwnProperty.call(changes, "enableHighlighting")) {
			onChangesObject["enableHighlighting"] = new SimpleChange(
				component.enableHighlighting,
				changes.enableHighlighting,
				typeof component.enableHighlighting === "undefined"
			);
			hostComponent.enableHighlighting = changes.enableHighlighting;
			component.enableHighlighting = changes.enableHighlighting;
		}

		component.ngOnChanges(onChangesObject);
	};

	beforeEach(() => {
		renderHost();
	});

	describe("on initialization", () => {
		it("should set internal component properties", () => {
			expect(hostFixture).toBeDefined();
			expect(component).toBeDefined();
			expect(component.logger).toBeDefined();
		});

		it("should NOT have any inputs set", () => {
			expect(component.data).toBeUndefined();
			expect(component.format).toBeUndefined();
			expect(component.enableHighlighting).toBeUndefined();
		});

		it("should NOT have called the service", () => {
			expect(mockPrettyPrintService.format).not.toHaveBeenCalled();
		});
	});

	describe("call the PrettyPrintService", () => {
		it("should NOT call the service when not format input are set", () => {
			applyInputChanges({ data: rawHtmlData });

			expect(component.data).toBe(rawHtmlData);
			expect(mockPrettyPrintService.format).not.toHaveBeenCalled();
		});

		it("should NOT call the service when not data input are set", () => {
			applyInputChanges({ format: "html" });

			expect(component.format).toBe("html");
			expect(mockPrettyPrintService.format).not.toHaveBeenCalled();
		});

		it("should call the service when input are set", () => {
			mockPrettyPrintService.format.mockReturnValue(of(formattedHtmlData));

			applyInputChanges({ format: "html", data: rawHtmlData });

			expect(mockPrettyPrintService.format).toHaveBeenCalledTimes(1);
			expect(mockPrettyPrintService.format).toHaveBeenCalledWith(rawHtmlData, "html", false);
		});

		it("should call the service when input date change", () => {
			mockPrettyPrintService.format.mockReturnValue(of(formattedHtmlData));

			applyInputChanges({ format: "html", data: rawHtmlData });

			expect(mockPrettyPrintService.format).toHaveBeenCalledTimes(1);
			expect(mockPrettyPrintService.format).toHaveBeenCalledWith(rawHtmlData, "html", false);

			mockPrettyPrintService.format.mockReset();
			mockPrettyPrintService.format.mockReturnValue(of(formattedAngularHtmlData));

			applyInputChanges({ data: rawAngularHtmlData });

			expect(mockPrettyPrintService.format).toHaveBeenCalledTimes(1);
			expect(mockPrettyPrintService.format).toHaveBeenCalledWith(rawAngularHtmlData, "html", false);
		});

		it("should call the service when input format change", () => {
			mockPrettyPrintService.format.mockReturnValue(of(formattedHtmlData));

			applyInputChanges({ format: "html", data: rawHtmlData });

			expect(mockPrettyPrintService.format).toHaveBeenCalledTimes(1);
			expect(mockPrettyPrintService.format).toHaveBeenCalledWith(rawHtmlData, "html", false);

			mockPrettyPrintService.format.mockReset();
			mockPrettyPrintService.format.mockReturnValue(of(formattedAngularHtmlData));

			applyInputChanges({ format: "xml" });

			expect(mockPrettyPrintService.format).toHaveBeenCalledTimes(1);
			expect(mockPrettyPrintService.format).toHaveBeenCalledWith(rawHtmlData, "xml", false);
		});

		it("should call the service when input enableHighlighting change", () => {
			mockPrettyPrintService.format.mockReturnValue(of(formattedHtmlData));

			applyInputChanges({ format: "html", data: rawHtmlData });

			expect(mockPrettyPrintService.format).toHaveBeenCalledTimes(1);
			expect(mockPrettyPrintService.format).toHaveBeenCalledWith(rawHtmlData, "html", false);

			mockPrettyPrintService.format.mockReset();
			mockPrettyPrintService.format.mockReturnValue(of(formattedHtmlData));

			applyInputChanges({ enableHighlighting: true });

			expect(mockPrettyPrintService.format).toHaveBeenCalledTimes(1);
			expect(mockPrettyPrintService.format).toHaveBeenCalledWith(rawHtmlData, "html", true);
		});
	});

	describe("handle observable subscription next", () => {
		it("should call ChangeDetectorRef.detectChanges", () => {
			mockPrettyPrintService.format.mockReturnValue(of(formattedHtmlData));
			const detectChangesSpy = vi.spyOn((component as unknown as { cdRef: { detectChanges: () => void } }).cdRef, "detectChanges");

			applyInputChanges({ format: "html", data: rawHtmlData });

			expect(detectChangesSpy).toHaveBeenCalledTimes(1);
		});

		it("should set the prettyString with correct values and bind to the correct html tag", () => {
			mockPrettyPrintService.format.mockReturnValue(of(formattedHtmlData));

			applyInputChanges({ format: "html", data: rawHtmlData });

			let formattedData = component.prettyString;

			formattedData = formattedData
				.replace(/&lt;/gi, "<")
				.replace(/&gt;/gi, ">")
				.replace(/&quot;/gi, '"');

			expect(formattedData).toBe(formattedHtmlData);
			expect(component.highlightingEnabled).toBe(false);

			const preElement = hostFixture.nativeElement.querySelector("pre") as HTMLPreElement | null;
			expect(preElement).toBeDefined();
			expect(preElement?.innerHTML).toContain("&lt;!doctype html&gt");
			expect(preElement?.innerHTML).toContain('&lt;p class="flashy"&gt');
			expect(preElement?.innerHTML).toContain("&lt;style&gt;");
			expect(preElement?.innerHTML).toContain("&lt;/style&gt;");
		});

		it("should highlight when success and enableHighlighting", async () => {
			const prettyPrintService = new StarkPrettyPrintServiceImpl(component.logger as StarkLoggingService);
			const highlightedHtmlData = await firstValueFrom(prettyPrintService.format(rawHtmlData, "html", true));

			mockPrettyPrintService.format.mockReturnValue(of(highlightedHtmlData));

			applyInputChanges({ format: "html", data: rawHtmlData, enableHighlighting: true });

			expect(component.highlightingEnabled).toBe(true);

			const preElement = hostFixture.nativeElement.querySelector("pre") as HTMLPreElement | null;
			expect(preElement).toBeDefined();
			expect(preElement?.innerHTML).toContain('<code class="language-markup">');
			expect(preElement?.innerHTML).toContain('<span class="token punctuation">&lt;</span>p</span>');
			expect(preElement?.innerHTML).toContain('<span class="token punctuation">&lt;</span>head</span>');
			expect(preElement?.innerHTML).toContain('<span class="token attr-name">class</span>');
		});
	});

	describe("handle observable subscription error", () => {
		it("should call ChangeDetectorRef.detectChanges", () => {
			mockPrettyPrintService.format.mockReturnValue(throwError(() => rawHtmlData));
			const detectChangesSpy = vi.spyOn((component as unknown as { cdRef: { detectChanges: () => void } }).cdRef, "detectChanges");

			applyInputChanges({ format: "html", data: rawHtmlData });

			expect(detectChangesSpy).toHaveBeenCalledTimes(1);
		});

		it("should not highlight when error", () => {
			mockPrettyPrintService.format.mockReturnValue(throwError(() => rawHtmlData));

			applyInputChanges({ format: "html", data: rawHtmlData, enableHighlighting: true });

			expect(component.prettyString).toBe(rawHtmlData);
			expect(component.highlightingEnabled).toBe(false);
		});
	});
});

function createLoggerMock(): LoggingServiceMock {
	return {
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn()
	};
}
