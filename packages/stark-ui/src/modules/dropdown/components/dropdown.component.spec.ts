/* eslint-disable @angular-eslint/component-max-inline-declarations, @angular-eslint/no-lifecycle-call */
import { Component, DebugElement, ViewChild } from "@angular/core";
import { UntypedFormControl, ReactiveFormsModule } from "@angular/forms";
import { SimpleChange } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { MatOptionModule } from "@angular/material/core";
import { MatSelect, MatSelectModule } from "@angular/material/select";
import { STARK_LOGGING_SERVICE } from "@nationalbankbelgium/stark-core";
import { StarkDropdownComponent } from "./dropdown.component";
import { CommonModule } from "@angular/common";
import { By } from "@angular/platform-browser";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Observer } from "rxjs";
import { vi } from "vitest";
import { StarkDropdownModule } from "../dropdown.module";

describe("DropdownComponent", () => {
	interface ComplexOption {
		id: number;
		label: string;
	}

	@Component({
		standalone: true,
		selector: `host-ng-control-component`,
		imports: [ReactiveFormsModule, StarkDropdownModule],
		template: `
			<stark-dropdown
				[dropdownId]="$any(dropdownId)"
				[formControl]="formControl"
				[multiSelect]="$any(multiSelect)"
				[optionIdProperty]="$any(optionIdProperty)"
				[optionLabelProperty]="$any(optionLabelProperty)"
				[options]="options"
				[placeholder]="$any(placeholder)"
				[required]="$any(required)"
				(selectionChanged)="selectionChanged($event)"
			>
			</stark-dropdown>
		`
	})
	class TestHostNgControlComponent {
		@ViewChild(StarkDropdownComponent, { static: true })
		public dropdownComponent!: StarkDropdownComponent;

		public dropdownId?: string;
		public formControl = new UntypedFormControl();
		// public header?: string;
		public multiSelect?: boolean;
		public optionIdProperty?: string;
		public optionLabelProperty?: string;
		public options: any[] = [];
		public placeholder?: string;
		public selectionChanged = (_value: any | any[]): void => {
			/* noop*/
		};
		public required?: boolean;
	}

	@Component({
		standalone: true,
		selector: `host-component`,
		imports: [StarkDropdownModule],
		template: `
			<stark-dropdown
				[dropdownId]="$any(dropdownId)"
				[disabled]="$any(disabled)"
				[multiSelect]="$any(multiSelect)"
				[optionIdProperty]="$any(optionIdProperty)"
				[optionLabelProperty]="$any(optionLabelProperty)"
				[options]="$any(options)"
				[placeholder]="$any(placeholder)"
				[required]="$any(required)"
				(selectionChanged)="selectionChanged($event)"
				[value]="$any(value)"
			>
			</stark-dropdown>
		`
	})
	class TestHostValueComponent {
		@ViewChild(StarkDropdownComponent, { static: true })
		public dropdownComponent!: StarkDropdownComponent;

		public dropdownId?: string;
		// public header?: string;
		public disabled?: boolean;
		public multiSelect?: boolean;
		public optionIdProperty?: string;
		public optionLabelProperty?: string;
		public options?: any[];
		public placeholder?: string;
		public value: any | any[];
		public selectionChanged = (_value: any | any[]): void => {
			/* noop*/
		};
		public required?: boolean;
	}

	@Component({
		standalone: true,
		selector: `host-component`,
		imports: [StarkDropdownModule],
		template: `
			<stark-dropdown
				[dropdownId]="$any(dropdownId)"
				[disabled]="$any(disabled)"
				[multiSelect]="$any(multiSelect)"
				[optionIdProperty]="$any(optionIdProperty)"
				[optionLabelProperty]="$any(optionLabelProperty)"
				[options]="options"
				[panelWidth]="panelWidth"
				[placeholder]="$any(placeholder)"
				[required]="$any(required)"
			>
			</stark-dropdown>
		`
	})
	class TestHostComponent {
		@ViewChild(StarkDropdownComponent, { static: true })
		public dropdownComponent!: StarkDropdownComponent;
		public dropdownId?: string;
		// public header?: string;
		public disabled?: boolean;
		public multiSelect?: boolean;
		public optionIdProperty?: string;
		public optionLabelProperty?: string;
		public options: any[] = [];
		// eslint-disable-next-line no-null/no-null
		public panelWidth: string | number | null = null;
		public placeholder?: string;
		public required?: boolean;
	}

	let component: StarkDropdownComponent;

	const simpleOptions: string[] = ["1", "2", "3"];
	const complexOptions: ComplexOption[] = [
		{
			id: 0,
			label: "label0"
		},
		{
			id: 1,
			label: "label1"
		},
		{
			id: 2,
			label: "label2"
		}
	];
	const dropdownPlaceholder = "dropdown placeholder";
	const dropdownValue = "dropdownValue";
	const dropdownId = "dropdownId";
	const dropdownOnChange = (): string => "dummyDropdownOnChange";
	const dropdownOptionIdProperty = "id";
	const dropdownOptionLabelProperty = "label";

	const matSelectTagSelector = "<mat-select";

	beforeEach(waitForAsync(() =>
		TestBed.configureTestingModule({
			imports: [
				CommonModule,
				MatSelectModule,
				MatOptionModule,
				ReactiveFormsModule,
				TranslateModule.forRoot(),
				NoopAnimationsModule,
				TestHostComponent,
				TestHostValueComponent,
				TestHostNgControlComponent
			],
			providers: [{ provide: STARK_LOGGING_SERVICE, useValue: createLoggerMock() }, TranslateService]
		}).compileComponents()));

	function getDropdownDebugElement(hostFixture: ComponentFixture<any>): DebugElement {
		return hostFixture.debugElement.query(By.directive(StarkDropdownComponent));
	}

	function getMatSelectDebugElement(hostFixture: ComponentFixture<any>): DebugElement {
		return getDropdownDebugElement(hostFixture).query(By.directive(MatSelect));
	}

	function getMatSelectComponent(hostFixture: ComponentFixture<any>): MatSelect {
		return <MatSelect>getMatSelectDebugElement(hostFixture).componentInstance;
	}

	function getMatSelectElement(hostFixture: ComponentFixture<any>): HTMLElement {
		return <HTMLElement>getMatSelectDebugElement(hostFixture).nativeElement;
	}

	function getMatSelectValueText(hostFixture: ComponentFixture<any>): string {
		const valueElement = getMatSelectElement(hostFixture).querySelector(".mat-mdc-select-value");
		return valueElement?.textContent?.replace(/\s+/g, " ").trim() ?? "";
	}

	function assertMatSelectValue(hostFixture: ComponentFixture<any>, value: any, displayedValue: any = value): void {
		expect(hostFixture.nativeElement.innerHTML).toContain(matSelectTagSelector);
		expect(getMatSelectComponent(hostFixture).value).toEqual(value);
		expect(getMatSelectValueText(hostFixture)).toContain(String(displayedValue));
	}

	async function stabilizeFixture(fixture: ComponentFixture<any>): Promise<void> {
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	}

	describe("default", () => {
		let hostComponent: TestHostComponent;
		let hostFixture: ComponentFixture<TestHostComponent>;

		function renderHost(setup?: (host: TestHostComponent) => void): void {
			if (hostFixture) {
				hostFixture.destroy();
			}
			hostFixture = TestBed.createComponent(TestHostComponent);
			hostComponent = hostFixture.componentInstance;
			hostComponent.dropdownId = dropdownId;
			hostComponent.options = simpleOptions;
			hostComponent.placeholder = dropdownPlaceholder;
			setup?.(hostComponent);
			hostFixture.detectChanges();
			component = hostComponent.dropdownComponent;
		}

		beforeEach(() => {
			renderHost();
		});

		describe("on initialization", () => {
			it("should set internal component properties", () => {
				expect(hostFixture).toBeDefined();
				expect(component).toBeDefined();
				expect(component.logger).not.toBeNull();
				expect(component.logger).toBeDefined();
			});

			it("should NOT have any inputs set", () => {
				expect(component.dropdownId).toBe(<any>hostComponent.dropdownId);
				expect(component.selectionChanged).toBeDefined();
				expect(component.multiSelect).toBe(!!hostComponent.multiSelect);
				expect(component.options).toBe(hostComponent.options);
				expect(component.placeholder).toBe(<any>hostComponent.placeholder);
				expect(component.disabled).toBeUndefined();
				expect(component.required).toBe(!!hostComponent.required);
			});

			it("should render the appropriate content", () => {
				const dropdownComponent = getDropdownDebugElement(hostFixture);
				const matSelect = getMatSelectComponent(hostFixture);
				expect(hostFixture.nativeElement.innerHTML).toContain(matSelectTagSelector);
				expect(
					(<HTMLElement>dropdownComponent.nativeElement).querySelector(".stark-dropdown-floating-label")?.textContent?.trim()
				).toBe(dropdownPlaceholder);
				expect((<HTMLElement>dropdownComponent.nativeElement).classList.contains("floating")).toBe(false);
				expect(dropdownComponent.componentInstance.value).toBeUndefined();
				expect(matSelect.value).toBeUndefined();
				expect(matSelect.placeholder).toBe(dropdownPlaceholder);
				expect(matSelect.id).toBe(dropdownId);
			});

			it("should keep an explicitly sized Material panel within its overlay bounds", async () => {
				renderHost((host) => {
					host.panelWidth = "212px";
				});
				await stabilizeFixture(hostFixture);

				const matSelect = getMatSelectComponent(hostFixture);
				expect(matSelect.panelWidth).toBe("212px");
				expect(matSelect.panelClass).toBe("stark-dropdown-fixed-panel-width");
			});
		});

		describe("on change", () => {
			describe("required", () => {
				it("should set the right value to the mat-select when 'required' changes", async () => {
					renderHost((host) => {
						host.required = true;
					});
					await stabilizeFixture(hostFixture);
					expect(component.required).toBe(true);
					expect(getMatSelectElement(hostFixture).getAttribute("aria-required")).toBe("true");
					expect(getMatSelectComponent(hostFixture).placeholder).toBe(`${dropdownPlaceholder} *`);

					renderHost((host) => {
						host.required = false;
					});
					await stabilizeFixture(hostFixture);
					expect(component.required).toBe(false);
					expect(getMatSelectElement(hostFixture).getAttribute("aria-required")).toBe("false");
					expect(getMatSelectComponent(hostFixture).placeholder).toBe(dropdownPlaceholder);
				});
			});

			describe("disabled", () => {
				it("should set the right value to the mat-select when 'disabled' changes", async () => {
					renderHost((host) => {
						host.disabled = true;
					});
					await stabilizeFixture(hostFixture);
					expect(component.disabled).toBe(true);
					expect(getMatSelectElement(hostFixture).getAttribute("aria-disabled")).toBe("true");

					renderHost((host) => {
						host.disabled = false;
					});
					await stabilizeFixture(hostFixture);
					expect(component.disabled).toBe(false);
					expect(getMatSelectElement(hostFixture).getAttribute("aria-disabled")).toBe("false");
				});
			});

			describe("multiSelect", () => {
				it("should set the right value to multiSelect when 'multiSelect' changes", () => {
					component.multiSelect = true;
					hostFixture.detectChanges();
					expect(component.multiSelect).toBe(true);

					component.multiSelect = <any>"true";
					hostFixture.detectChanges();
					expect(component.multiSelect).toBe(true);

					component.multiSelect = <any>"";
					hostFixture.detectChanges();
					expect(component.multiSelect).toBe(true);

					component.multiSelect = <any>undefined;
					hostFixture.detectChanges();
					expect(component.multiSelect).toBe(false);

					component.multiSelect = false;
					hostFixture.detectChanges();
					expect(component.multiSelect).toBe(false);

					component.multiSelect = <any>"false";
					hostFixture.detectChanges();
					expect(component.multiSelect).toBe(false);
				});
			});
		});

		describe("rendering 'options' in 'mat-option' when 'open mat-select'", () => {
			it("should render the right values when 'options' is an array of simple types", async () => {
				renderHost((host) => {
					host.options = simpleOptions;
				});

				const optionElements = getMatSelectComponent(hostFixture).options.toArray();
				expect(optionElements.length).toBe(simpleOptions.length);

				for (let index = 0; index < optionElements.length; index++) {
					expect(optionElements[index].value).toBe(simpleOptions[index]);
					expect(optionElements[index].viewValue).toContain(simpleOptions[index]);
				}
				hostFixture.destroy();
				await Promise.resolve();
			});

			it("should render the right values when 'options' is an array of complex types", async () => {
				renderHost((host) => {
					host.options = complexOptions;
					host.optionIdProperty = dropdownOptionIdProperty;
					host.optionLabelProperty = dropdownOptionLabelProperty;
				});

				const optionElements = getMatSelectComponent(hostFixture).options.toArray();
				expect(optionElements.length).toBe(complexOptions.length);

				for (let index = 0; index < optionElements.length; index++) {
					expect(optionElements[index].value).toBe(complexOptions[index][dropdownOptionIdProperty]);
					expect(optionElements[index].viewValue).toContain(complexOptions[index][dropdownOptionLabelProperty]);
				}
				hostFixture.destroy();
				await Promise.resolve();
			});
		});

		describe("should render checkboxes in 'mat-option' based on 'multiSelect' value", () => {
			it("should display a checkbox for every option in the dropdown when multiSelect is set to 'true'", async () => {
				renderHost((host) => {
					host.multiSelect = true;
				});

				expect(getMatSelectComponent(hostFixture).multiple).toBe(true);
				expect(getMatSelectComponent(hostFixture).options.length).toBe(hostComponent.options.length);
				hostFixture.destroy();
				await Promise.resolve();
			});

			it("should display a checkbox for every option in the dropdown when multiSelect has no value defined", async () => {
				renderHost((host) => {
					host.multiSelect = <any>"";
				});

				expect(getMatSelectComponent(hostFixture).multiple).toBe(true);
				expect(getMatSelectComponent(hostFixture).options.length).toBe(hostComponent.options.length);
				hostFixture.destroy();
				await Promise.resolve();
			});

			it("should NOT render the checkboxes if multiSelect is to any value other than 'true'", async () => {
				renderHost((host) => {
					host.multiSelect = <any>"false";
				});

				expect(getMatSelectComponent(hostFixture).multiple).toBe(false);
				hostFixture.destroy();
				await Promise.resolve();
			});
		});

		describe("setDefaultBlank", () => {
			it("should set 'defaultBlank' to false when it is not set or it is set to false", () => {
				component.defaultBlank = false;
				component.setDefaultBlank();
				expect(component.defaultBlank).toBe(false);

				component.defaultBlank = <any>undefined;
				component.setDefaultBlank();
				expect(component.defaultBlank).toBe(false);
			});

			it("should set 'defaultBlank' to false when 'required' is true", () => {
				component.defaultBlank = <any>undefined;
				component.required = true;
				component.setDefaultBlank();
				expect(component.defaultBlank).toBe(false);
			});
		});

		describe("optionIdProperty & optionLabelProperty", () => {
			it("should set the right value to optionsAreSimpleTypes when 'optionIdProperty' or 'optionLabelProperty' change", () => {
				component.optionIdProperty = dropdownOptionIdProperty;
				component.ngOnChanges({
					optionIdProperty: new SimpleChange(undefined, dropdownOptionIdProperty, false)
				});
				expect(component.optionsAreSimpleTypes).toBe(true);

				component.optionLabelProperty = dropdownOptionLabelProperty;
				component.options = complexOptions;
				component.ngOnChanges({
					optionLabelProperty: new SimpleChange(undefined, dropdownOptionLabelProperty, false)
				});
				expect(component.optionsAreSimpleTypes).toBe(false);

				component.optionLabelProperty = undefined;
				component.ngOnChanges({
					optionLabelProperty: new SimpleChange(dropdownOptionLabelProperty, undefined, false)
				});
				expect(component.optionsAreSimpleTypes).toBe(true);
			});
		});
	});

	describe("using value + selectionChanged", () => {
		let hostComponent: TestHostValueComponent;
		let hostFixture: ComponentFixture<TestHostValueComponent>;

		function renderHost(setup?: (host: TestHostValueComponent) => void): void {
			if (hostFixture) {
				hostFixture.destroy();
			}
			hostFixture = TestBed.createComponent(TestHostValueComponent);
			hostComponent = hostFixture.componentInstance;
			hostComponent.dropdownId = dropdownId;
			hostComponent.selectionChanged = dropdownOnChange;
			hostComponent.options = simpleOptions;
			hostComponent.placeholder = dropdownPlaceholder;
			hostComponent.value = dropdownValue;
			setup?.(hostComponent);
			hostFixture.detectChanges();
			component = hostComponent.dropdownComponent;
		}

		beforeEach(() => {
			renderHost();
		});

		describe("on initialization", () => {
			it("should have right inputs set", () => {
				expect(component.selectionChanged).toBeDefined();
				expect(component.disabled).toBeUndefined();
				expect(component.value).toBe(hostComponent.value);
			});

			it("should render the appropriate content", () => {
				const dropdownComponent = getDropdownDebugElement(hostFixture);
				const matSelect = getMatSelectComponent(hostFixture);
				expect(hostFixture.nativeElement.innerHTML).toContain(matSelectTagSelector);
				expect(dropdownComponent.componentInstance.value).toBe(dropdownValue);
				expect(matSelect.value).toBe(dropdownValue);
				expect(matSelect.placeholder).toBe(dropdownPlaceholder);
				expect(matSelect.id).toBe(dropdownId);
				expect((<HTMLElement>dropdownComponent.nativeElement).classList.contains("floating")).toBe(true);
			});
		});

		describe("on change", () => {
			describe("value", () => {
				it("should set the right value to the formControl when 'value' changes", () => {
					renderHost((host) => {
						host.value = "dummy-value";
					});
					expect(component.value).toBe("dummy-value");
					expect(getMatSelectComponent(hostFixture).value).toBe("dummy-value");
				});
			});
		});

		describe("on select option", () => {
			it("should emit the right value to 'selectionChanged' when 'simple types' options", async () => {
				renderHost((host) => {
					host.options = simpleOptions;
					host.optionIdProperty = undefined;
					host.optionLabelProperty = undefined;
					host.value = undefined;
					vi.spyOn(host, "selectionChanged");
				});

				component.onSelectionChange(<any>{ value: simpleOptions[2] });
				await stabilizeFixture(hostFixture);

				expect(hostComponent.selectionChanged).toHaveBeenCalledTimes(1);
				expect(hostComponent.selectionChanged).toHaveBeenCalledWith(simpleOptions[2]);
				assertMatSelectValue(hostFixture, simpleOptions[2]);

				hostFixture.destroy();
				await Promise.resolve();
			});

			it("should emit the right value to 'selectionChanged' when 'complex types' options", async () => {
				renderHost((host) => {
					host.options = complexOptions;
					host.optionIdProperty = dropdownOptionIdProperty;
					host.optionLabelProperty = dropdownOptionLabelProperty;
					host.value = undefined;
					vi.spyOn(host, "selectionChanged");
				});

				component.onSelectionChange(<any>{ value: complexOptions[2][dropdownOptionIdProperty] });
				await stabilizeFixture(hostFixture);

				expect(hostComponent.selectionChanged).toHaveBeenCalledTimes(1);
				expect(hostComponent.selectionChanged).toHaveBeenCalledWith(complexOptions[2][dropdownOptionIdProperty]);
				assertMatSelectValue(
					hostFixture,
					complexOptions[2][dropdownOptionIdProperty],
					complexOptions[2][dropdownOptionLabelProperty]
				);

				hostFixture.destroy();
				await Promise.resolve();
			});
		});
	});

	describe("using reactive forms", () => {
		let hostComponent: TestHostNgControlComponent;
		let hostFixture: ComponentFixture<TestHostNgControlComponent>;

		function renderHost(setup?: (host: TestHostNgControlComponent) => void): void {
			if (hostFixture) {
				hostFixture.destroy();
			}
			hostFixture = TestBed.createComponent(TestHostNgControlComponent);
			hostComponent = hostFixture.componentInstance;
			hostComponent.dropdownId = dropdownId;
			hostComponent.selectionChanged = dropdownOnChange;
			hostComponent.options = simpleOptions;
			hostComponent.placeholder = dropdownPlaceholder;
			hostComponent.formControl.setValue(dropdownValue);
			setup?.(hostComponent);
			hostFixture.detectChanges();
			component = hostComponent.dropdownComponent;
		}

		beforeEach(() => {
			renderHost();
		});

		describe("on initialization", () => {
			it("should have right inputs set", () => {
				expect(component.disabled).toBe(hostComponent.formControl.disabled);
				expect(component.required).toBe(!!hostComponent.required);
				expect(component.value).toBe(hostComponent.formControl.value);
			});

			it("should render the appropriate content", () => {
				const dropdownComponent = getDropdownDebugElement(hostFixture);
				const matSelect = getMatSelectComponent(hostFixture);
				expect(hostFixture.nativeElement.innerHTML).toContain(matSelectTagSelector);
				expect(dropdownComponent.componentInstance.ngControl?.control).toBe(hostComponent.formControl);
				expect(matSelect.value).toBe(dropdownValue);
				expect(matSelect.placeholder).toBe(dropdownPlaceholder);
				expect(matSelect.id).toBe(dropdownId);
			});
		});

		describe("on change", () => {
			describe("required", () => {
				it("should change the validators of the 'formControl' when 'required' changes", () => {
					renderHost((host) => {
						host.required = true;
						host.formControl.reset();
					});
					hostComponent.formControl.updateValueAndValidity();

					expect(hostComponent.formControl.validator).not.toBeNull();
					expect(component.validate(hostComponent.formControl)).toEqual({ required: true });
					expect(hostComponent.formControl.errors).toEqual({ required: true });

					renderHost((host) => {
						host.required = false;
						host.formControl.reset();
					});
					hostComponent.formControl.updateValueAndValidity();
					expect(hostComponent.formControl.validator).not.toBeNull();
					expect(component.validate(hostComponent.formControl)).toBeNull();
					expect(hostComponent.formControl.errors).toBeNull();
				});
			});

			describe("formControl.disabled", () => {
				it("should set the right value to the mat-select when 'formControl.disabled' changes", async () => {
					renderHost((host) => {
						host.formControl.disable();
					});
					await stabilizeFixture(hostFixture);
					expect(component.disabled).toBe(true);
					expect(getMatSelectElement(hostFixture).getAttribute("aria-disabled")).toBe("true");

					renderHost((host) => {
						host.formControl.enable();
					});
					await stabilizeFixture(hostFixture);
					expect(component.disabled).toBe(false);
					expect(getMatSelectElement(hostFixture).getAttribute("aria-disabled")).toBe("false");
				});

				it("shouldn't trigger a 'valueChange' event when the formControl is disabled or enabled with emitEvent set to false", () => {
					const mockObserver = createObserverSpy<any>();

					hostComponent.formControl.valueChanges.subscribe(mockObserver.observer);

					hostComponent.formControl.disable({ emitEvent: false });
					hostFixture.detectChanges();

					expect(component.disabled).toBe(true);

					hostComponent.formControl.enable({ emitEvent: false });
					hostFixture.detectChanges();

					expect(component.disabled).toBe(false);
					expect(mockObserver.next).not.toHaveBeenCalled(); // because the 'emitEvent' is false
					expect(mockObserver.error).not.toHaveBeenCalled();
					expect(mockObserver.complete).not.toHaveBeenCalled();
				});

				it("should trigger a 'valueChange' event when the formControl is disabled or enabled with emitEvent set to true", () => {
					const mockObserver = createObserverSpy<any>();

					hostComponent.formControl.valueChanges.subscribe(mockObserver.observer);

					hostComponent.formControl.disable(); // 'emitEvent' true by default
					hostFixture.detectChanges();

					expect(component.disabled).toBe(true);
					expect(mockObserver.next).toHaveBeenCalledTimes(1);
					expect(mockObserver.error).not.toHaveBeenCalled();
					expect(mockObserver.complete).not.toHaveBeenCalled();
					mockObserver.next.mockClear();

					hostComponent.formControl.enable(); // 'emitEvent' true by default
					hostFixture.detectChanges();

					expect(component.disabled).toBe(false);
					expect(mockObserver.next).toHaveBeenCalledTimes(1);
					expect(mockObserver.error).not.toHaveBeenCalled();
					expect(mockObserver.complete).not.toHaveBeenCalled();
				});
			});

			describe("formControl.value", () => {
				it("should set the right value to the formControl when 'value' changes", async () => {
					hostComponent.formControl.setValue("dummy-value");
					await stabilizeFixture(hostFixture);

					expect(hostComponent.formControl.value).toBe("dummy-value");
					expect(component.value).toBe("dummy-value");
				});
			});
		});

		describe("on select option", () => {
			it("should emit the right value to 'formControl' when 'simple types' options", async () => {
				const mockObserver = createObserverSpy<any>();

				renderHost((host) => {
					host.options = simpleOptions;
					host.optionIdProperty = undefined;
					host.optionLabelProperty = undefined;
					host.formControl.reset();
				});
				hostComponent.formControl.valueChanges.subscribe(mockObserver.observer);

				component.onSelectionChange(<any>{ value: simpleOptions[1] });
				await stabilizeFixture(hostFixture);

				expect(hostComponent.formControl.value).toEqual(simpleOptions[1]);
				expect(mockObserver.next).toHaveBeenCalled();
				expect(mockObserver.next).toHaveBeenCalledWith(simpleOptions[1]);
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
				assertMatSelectValue(hostFixture, simpleOptions[1]);

				hostFixture.destroy();
				await Promise.resolve();
			});

			it("should emit the right value to 'formControl' when 'complex types' options", async () => {
				const mockObserver = createObserverSpy<any>();

				renderHost((host) => {
					host.options = complexOptions;
					host.optionIdProperty = dropdownOptionIdProperty;
					host.optionLabelProperty = dropdownOptionLabelProperty;
					host.formControl.reset();
				});
				hostComponent.formControl.valueChanges.subscribe(mockObserver.observer);

				component.onSelectionChange(<any>{ value: complexOptions[2][dropdownOptionIdProperty] });
				await stabilizeFixture(hostFixture);

				expect(hostComponent.formControl.value).toEqual(complexOptions[2][dropdownOptionIdProperty]);
				expect(mockObserver.next).toHaveBeenCalled();
				expect(mockObserver.next).toHaveBeenCalledWith(complexOptions[2][dropdownOptionIdProperty]);
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).not.toHaveBeenCalled();
				assertMatSelectValue(
					hostFixture,
					complexOptions[2][dropdownOptionIdProperty],
					complexOptions[2][dropdownOptionLabelProperty]
				);

				hostFixture.destroy();
				await Promise.resolve();
			});
		});
	});

	function createLoggerMock(): { debug: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> } {
		return {
			debug: vi.fn(),
			error: vi.fn(),
			warn: vi.fn()
		};
	}

	function createObserverSpy<T>(): {
		observer: Observer<T>;
		next: ReturnType<typeof vi.fn>;
		error: ReturnType<typeof vi.fn>;
		complete: ReturnType<typeof vi.fn>;
	} {
		const next = vi.fn((value: T) => value);
		const error = vi.fn((err: unknown) => err);
		const complete = vi.fn();

		return {
			observer: {
				next: (value: T): void => {
					next(value);
				},
				error: (err: unknown): void => {
					error(err);
				},
				complete: (): void => {
					complete();
				}
			},
			next,
			error,
			complete
		};
	}
	// FIXME re-enable those tests as soon as a solution to replace the md-select-header as been found: https://github.com/angular/components/pull/7835
	//
	// describe("header", () => {
	// 	it("should be added to the DOM when header is defined", () => {
	// 		expect(dropdownHeader.length).toBe(1);
	// 	});
	//
	// 	it("should not be added to the DOM when header is undefined", () => {
	// 		hostComponent.header = undefined;
	// 		hostFixture.detectChanges();
	// 		expect(dropdownHeader.length).toBe(0);
	// 	});
	//
	// 	it("should not be added to the DOM when header is an empty string", () => {
	// 		hostComponent.header = "";
	// 		hostFixture.detectChanges();
	// 		expect(dropdownHeader.length).toBe(0);
	// 	});
	// });
});
