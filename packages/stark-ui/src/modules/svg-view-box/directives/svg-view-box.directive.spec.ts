import { Component, DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { STARK_LOGGING_SERVICE, StarkLoggingService } from "@nationalbankbelgium/stark-core";
import { vi } from "vitest";
import { StarkSvgViewBoxModule } from "../svg-view-box.module";
import { STARK_DEFAULT_VIEW_BOX_SIZE, StarkSvgViewBoxDirective } from "./svg-view-box.directive";

describe("SvgViewBoxDirective", () => {
	@Component({
		standalone: true,
		selector: "stark-svg-view-box-default-host",
		imports: [StarkSvgViewBoxModule],
		template: getTemplate("[starkSvgViewBox]='$any(viewBoxSize)'")
	})
	class DefaultHostComponent {
		public viewBoxSize: unknown = "";
	}

	@Component({
		standalone: true,
		selector: "stark-svg-view-box-custom-host",
		imports: [StarkSvgViewBoxModule],
		template: getTemplate("[starkSvgViewBox]='$any(viewBoxSize)'")
	})
	class CustomHostComponent {
		public viewBoxSize: unknown = "48";
	}

	@Component({
		standalone: true,
		selector: "stark-svg-view-box-existing-host",
		imports: [StarkSvgViewBoxModule],
		template: getTemplate("[starkSvgViewBox]='$any(viewBoxSize)'", "viewBox='0 0 12 12'")
	})
	class ExistingViewBoxHostComponent {
		public viewBoxSize: unknown = "";
	}

	function getTemplate(svgViewBoxDirective: string, viewBoxAttribute?: string): string {
		return `
<div ${svgViewBoxDirective}>
	<svg xmlns="http://www.w3.org/2000/svg" ${viewBoxAttribute}>
		<text font-size="8" font-family="serif" y="6"><![CDATA[dummy icon]]></text>
	</svg>
</div>
`;
	}

	const mockLogger = {
		debug: vi.fn<(message: string) => void>()
	} as unknown as StarkLoggingService;

	describe("when viewBox value is not defined", () => {
		let fixture: ComponentFixture<DefaultHostComponent>;

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [DefaultHostComponent],
				providers: [{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger }]
			});

			fixture = TestBed.createComponent(DefaultHostComponent);
			fixture.detectChanges();
		});

		it("should add the default values to the viewBox attribute of the svg element", () => {
			expect(fixture).toBeDefined();
			const parentElement: DebugElement = fixture.debugElement.query(By.directive(StarkSvgViewBoxDirective));
			expect(parentElement).toBeDefined();
			const svgElement: SVGElement = parentElement.nativeElement.querySelector("svg");
			expect(svgElement).toBeDefined();
			expect(svgElement.hasAttribute("viewBox")).toBe(true);
			expect(svgElement.getAttribute("viewBox")).toBe(`0 0 ${STARK_DEFAULT_VIEW_BOX_SIZE} ${STARK_DEFAULT_VIEW_BOX_SIZE}`);
		});
	});

	describe("when viewBox value is given", () => {
		const viewBoxValue = 48;
		let fixture: ComponentFixture<CustomHostComponent>;

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [CustomHostComponent],
				providers: [{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger }]
			});

			fixture = TestBed.createComponent(CustomHostComponent);
			fixture.detectChanges();
		});

		it("should add the provided value as the width and height of the viewBox attribute of the svg element", () => {
			expect(fixture).toBeDefined();
			const parentElement: DebugElement = fixture.debugElement.query(By.directive(StarkSvgViewBoxDirective));
			expect(parentElement).toBeDefined();
			const svgElement: SVGElement = parentElement.nativeElement.querySelector("svg");
			expect(svgElement).toBeDefined();
			expect(svgElement.hasAttribute("viewBox")).toBe(true);
			expect(svgElement.getAttribute("viewBox")).toBe(`0 0 ${viewBoxValue} ${viewBoxValue}`);
		});
	});

	describe("when SVG has already the viewBox attribute", () => {
		let fixture: ComponentFixture<ExistingViewBoxHostComponent>;

		beforeEach(() => {
			TestBed.configureTestingModule({
				imports: [ExistingViewBoxHostComponent],
				providers: [{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger }]
			});

			fixture = TestBed.createComponent(ExistingViewBoxHostComponent);
			fixture.detectChanges();
		});

		it("should overwrite the viewBox attribute", () => {
			expect(fixture).toBeDefined();
			const parentElement: DebugElement = fixture.debugElement.query(By.directive(StarkSvgViewBoxDirective));
			expect(parentElement).toBeDefined();
			const svgElement: SVGElement = parentElement.nativeElement.querySelector("svg");
			expect(svgElement).toBeDefined();
			expect(svgElement.hasAttribute("viewBox")).toBe(true);
			expect(svgElement.getAttribute("viewBox")).toBe(`0 0 ${STARK_DEFAULT_VIEW_BOX_SIZE} ${STARK_DEFAULT_VIEW_BOX_SIZE}`);
		});
	});
});
