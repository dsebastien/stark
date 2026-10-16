/* eslint-disable @angular-eslint/component-max-inline-declarations */
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Component, SimpleChange, ViewChild } from "@angular/core";
import { STARK_LOGGING_SERVICE } from "@nationalbankbelgium/stark-core";
import { StarkSliderComponent } from "./slider.component";
import { Options } from "nouislider";
import { vi } from "vitest";

type SliderUpdateHandler = (_values: Array<string | number>, _handle: number, unencodedValues: number[]) => void;

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

@Component({
	standalone: true,
	selector: "stark-slider-host",
	imports: [StarkSliderComponent],
	template: `
		<stark-slider
			[values]="sliderValues"
			sliderId="rangeSlider"
			[sliderConfig]="sliderConfig"
			(changed)="onValuesChange($event)"
		></stark-slider>
	`
})
class TestHostComponent {
	@ViewChild(StarkSliderComponent, { static: true })
	public sliderComponent!: StarkSliderComponent;

	public sliderId = "rangeSlider";
	public sliderValues: number[] = [0];
	public sliderConfig: Options = {
		start: 0,
		range: {
			min: 0,
			max: 100
		}
	};

	/**
	 * Simulates the OnValueChanges event of the slider component
	 * To be able to test the 'Changes' output
	 * @param values - Array of numeric values to be set to the slider.
	 */
	public onValuesChange(values: number[]): void {
		this.sliderValues = values;
	}
}

function isSliderUpdateHandler(callback: unknown): callback is SliderUpdateHandler {
	return typeof callback === "function";
}

function getSliderUpdateHandler(componentInstance: StarkSliderComponent): SliderUpdateHandler {
	const sliderOnCalls = (componentInstance.slider.on as unknown as { mock: { calls: unknown[][] } }).mock.calls;
	const callback = sliderOnCalls[0]?.[1];

	if (!isSliderUpdateHandler(callback)) {
		throw new Error("Expected slider.on to register a callable update handler");
	}

	return callback;
}

describe("SliderComponent", () => {
	let component: StarkSliderComponent;
	let hostComponent: TestHostComponent;
	let hostFixture: ComponentFixture<TestHostComponent>;
	let attachSliderInstanceUpdateHandlerSpy: ReturnType<typeof vi.spyOn>;
	let originalAttachSliderInstanceUpdateHandler: () => void;

	const mockConfig: Options = {
		start: 5,
		range: {
			min: 5,
			max: 95
		}
	};
	const mockSliderId = "rangeSlider";
	const mockValues: number[] = [11, 22];
	const newMockValues: number[] = [14, 18];

	beforeEach(async () => {
		const mockLogger: LoggingServiceMock = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};

		await TestBed.configureTestingModule({
			imports: [TestHostComponent],
			providers: [{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger as any }]
		}).compileComponents();
	});

	beforeEach(() => {
		hostFixture = TestBed.createComponent(TestHostComponent);
		hostComponent = hostFixture.componentInstance;
		component = hostComponent.sliderComponent;

		hostComponent.sliderConfig = mockConfig;
		hostComponent.sliderValues = mockValues;
		hostComponent.sliderId = mockSliderId;

		vi.spyOn(component, "updateSliderInstanceValues");
		vi.spyOn(component.changed, "emit");

		originalAttachSliderInstanceUpdateHandler = component.attachSliderInstanceUpdateHandler.bind(component);
		attachSliderInstanceUpdateHandlerSpy = vi.spyOn(component, "attachSliderInstanceUpdateHandler").mockImplementation(() => undefined);

		hostFixture.detectChanges();

		vi.spyOn(component.slider, "on");
		vi.spyOn(component.slider, "set");
	});

	describe("on initialization", () => {
		it("should set internal component properties", () => {
			expect(hostFixture).toBeDefined();
			expect(component).toBeDefined();

			expect(component.logger).not.toBeNull();
			expect(component.logger).toBeDefined();
		});

		it("should have inputs", () => {
			expect(component.values).toBe(mockValues);
			expect(component.sliderConfig).toBe(mockConfig);
			expect(component.sliderId).toBe(mockSliderId);
			expect(component.changed).toBeDefined();
		});
	});

	describe("required inputs", () => {
		beforeEach(() => {
			hostFixture = TestBed.createComponent(TestHostComponent);
			hostComponent = hostFixture.componentInstance;

			hostComponent.sliderValues = mockValues;
			hostComponent.sliderConfig = mockConfig;
		});

		it("should not throw any errors when everything is set correctly", () => {
			expect(() => hostFixture.detectChanges()).not.toThrowError();
		});

		it("should throw an error when values are not set", () => {
			hostComponent.sliderValues = undefined as unknown as number[];
			expect(() => hostFixture.detectChanges()).toThrowError("StarkSliderComponent: values should be set.");
		});

		it("should throw an error when values are not set", () => {
			hostComponent.sliderConfig = undefined as unknown as Options;
			expect(() => hostFixture.detectChanges()).toThrowError("StarkSliderComponent: sliderConfig should be set.");
		});
	});

	describe("createSliderInstance", () => {
		it("should create the slider instance and assign it to the internal variable", () => {
			expect(component.slider).toBeDefined();
		});
	});

	describe("attachSliderInstanceUpdateHandler", () => {
		it("should add an 'update' event listener to the slider instance", () => {
			attachSliderInstanceUpdateHandlerSpy.mockImplementation(originalAttachSliderInstanceUpdateHandler);

			component.attachSliderInstanceUpdateHandler();

			expect(component.slider.on).toHaveBeenCalledTimes(1);

			const sliderOnCalls = (component.slider.on as unknown as { mock: { calls: unknown[][] } }).mock.calls;
			expect(sliderOnCalls[0]?.[0]).toBe("update");
			expect(typeof sliderOnCalls[0]?.[1]).toBe("function");
		});

		it("should update the slider instance when the values change", () => {
			component.values = newMockValues;
			component.ngOnChanges({
				values: new SimpleChange(mockValues, newMockValues, false)
			});

			expect(component.updateSliderInstanceValues).toHaveBeenCalledTimes(1);
			expect(component.values).toBe(newMockValues);
		});

		it("should update the values and call changed() whenever the update handler is triggered and the slider unencodedValues changed", () => {
			attachSliderInstanceUpdateHandlerSpy.mockImplementation(originalAttachSliderInstanceUpdateHandler);
			component.attachSliderInstanceUpdateHandler();

			const updateHandler = getSliderUpdateHandler(component);
			const dummyHandle = 0;
			const dummyEncodedValues: Array<string | number> = [];
			const dummyUnencodedValues: number[] = [14, 18];

			updateHandler(dummyEncodedValues, dummyHandle, dummyUnencodedValues);

			expect(component.values).toEqual(dummyUnencodedValues);
			expect(component.latestUnencodedValues).toBe(dummyUnencodedValues);
			expect(component.changed.emit).toHaveBeenCalledTimes(1);
			expect(component.changed.emit).toHaveBeenCalledWith(component.values);
		});

		it("should not update the slider instance when the same values are used", () => {
			hostComponent.sliderValues = mockValues;
			hostFixture.detectChanges();

			expect(component.updateSliderInstanceValues).toHaveBeenCalledTimes(0);
			expect(component.values).toBe(mockValues);
		});

		it("should NOT do anything in case the update handler is triggered but the slider unencodedValues did not change", () => {
			attachSliderInstanceUpdateHandlerSpy.mockImplementation(originalAttachSliderInstanceUpdateHandler);
			component.attachSliderInstanceUpdateHandler();

			const updateHandler = getSliderUpdateHandler(component);
			const dummyHandle = 0;
			const dummyEncodedValues: Array<string | number> = [];

			updateHandler(dummyEncodedValues, dummyHandle, mockValues);

			expect(component.values).toBe(mockValues);
			expect(component.latestUnencodedValues).toBeUndefined();
			expect(component.changed.emit).not.toHaveBeenCalled();
		});
	});

	describe("updateSliderInstanceValues", () => {
		it("should set the current values to the slider instance", () => {
			hostComponent.sliderValues = mockValues;

			component.updateSliderInstanceValues();

			expect(component.slider.set).toHaveBeenCalledTimes(1);
			expect(component.slider.set).toHaveBeenCalledWith(mockValues);
		});
	});
});
