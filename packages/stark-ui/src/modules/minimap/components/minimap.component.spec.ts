import { OverlayContainer } from "@angular/cdk/overlay";
import { ChangeDetectionStrategy, Component, ViewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { MatIconTestingModule } from "@angular/material/icon/testing";
import { TranslateModule } from "@ngx-translate/core";
import { vi } from "vitest";
import { StarkMinimapItemProperties } from "./item-properties.intf";
import { StarkMinimapComponent, StarkMinimapComponentMode } from "./minimap.component";

@Component({
	standalone: true,
	selector: "stark-minimap-host",
	imports: [StarkMinimapComponent],
	changeDetection: ChangeDetectionStrategy.Default,
	template: `
		<stark-minimap [visibleItems]="visibleItems" [items]="items" [mode]="mode" (showHideItem)="onShowHideItem($event)"></stark-minimap>
	`
})
class TestHostComponent {
	@ViewChild(StarkMinimapComponent, { static: true })
	public minimapComponent!: StarkMinimapComponent;

	public items: StarkMinimapItemProperties[] = [];
	public visibleItems: string[] = [];
	public mode?: StarkMinimapComponentMode;

	public onShowHideItem(_item: StarkMinimapItemProperties): void {
		/* noop*/
	}
}

describe("MinimapComponent", () => {
	let component: StarkMinimapComponent;
	let hostComponent: TestHostComponent;
	let hostFixture: ComponentFixture<TestHostComponent>;
	let overlayContainer: OverlayContainer;
	let overlayContainerElement: HTMLElement;

	const items: StarkMinimapItemProperties[] = [
		{ name: "column1", label: "Column 1" },
		{ name: "column2", label: "Column 2" },
		{ name: "column3", label: "Column 3" },
		{ name: "column4", label: "Column 4" }
	];
	const visibleItems: string[] = ["column1", "column2"];

	const renderComponent = (mode?: StarkMinimapComponentMode): void => {
		hostComponent.items = items;
		hostComponent.visibleItems = visibleItems;
		hostComponent.mode = mode;
		hostFixture.detectChanges();
		component = hostComponent.minimapComponent;
	};

	const openMenu = (): void => {
		const button: HTMLButtonElement = hostFixture.nativeElement.querySelector("button");
		button.click();
		hostFixture.detectChanges();
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [NoopAnimationsModule, MatIconTestingModule, TranslateModule.forRoot(), TestHostComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		overlayContainer = TestBed.inject(OverlayContainer);
		overlayContainerElement = overlayContainer.getContainerElement();
		hostFixture = TestBed.createComponent(TestHostComponent);
		hostComponent = hostFixture.componentInstance;
		vi.spyOn(hostComponent, "onShowHideItem");
	});

	afterEach(() => {
		overlayContainer.ngOnDestroy();
	});

	describe("configuration", () => {
		describe("menu", () => {
			let menuElement: HTMLElement | null;
			let menuItems: NodeListOf<HTMLElement>;

			beforeEach(() => {
				renderComponent();
				openMenu();

				menuElement = overlayContainerElement.querySelector(".mat-mdc-menu-panel");
				menuItems = overlayContainerElement.querySelectorAll(".mat-mdc-menu-panel .mat-mdc-menu-content .mat-mdc-menu-item");
			});

			it("clicking button should open menu", () => {
				expect(menuElement).toBeTruthy();
				expect(menuItems.length).toBe(items.length);
			});

			it("clicking outside menu should close it", async () => {
				const backdrop = overlayContainerElement.querySelector<HTMLElement>(".cdk-overlay-backdrop");
				expect(backdrop).toBeTruthy();
				if (!backdrop) {
					return;
				}

				backdrop.click();
				hostFixture.detectChanges();
				await hostFixture.whenStable();
				await hostFixture.whenRenderingDone();

				expect(hostFixture.nativeElement.querySelector("mat-icon").classList).not.toContain("open");
			});

			it("correct items should be checked", () => {
				expect(menuItems.length).toBe(items.length);
				menuItems.forEach((menuItemElement: HTMLElement) => {
					const labelElement: HTMLElement | null = menuItemElement.querySelector(".mdc-label");
					expect(labelElement).toBeTruthy();
					const text: string = ((labelElement && labelElement.textContent) || "").trim();

					const inputElement: HTMLInputElement | null = menuItemElement.querySelector("input[type='checkbox']");
					expect(inputElement).toBeTruthy();
					const isChecked: boolean = (inputElement && inputElement.checked) || false;

					const item: StarkMinimapItemProperties | undefined = items.find(
						({ label }: StarkMinimapItemProperties) => label === text
					);
					expect(item).toBeTruthy();
					const name: string = (item && item.name) || "";
					const isVisible: boolean = visibleItems.includes(name);

					expect(isChecked).toBe(isVisible);
				});
			});
		});

		describe("view mode", () => {
			it("full view should render by default", () => {
				renderComponent();
				expect(component.mode).toBeFalsy();

				const dotsElement: HTMLElement | null = hostFixture.nativeElement.querySelector("stark-minimap .stark-minimap-dots");
				expect(dotsElement).toBeTruthy();
				if (!dotsElement) {
					return;
				}

				const dotElements: NodeListOf<HTMLElement> = dotsElement.querySelectorAll(".stark-minimap-dot");
				expect(dotElements.length).toBe(items.length);
			});

			it("compact view should be rendered", () => {
				renderComponent("compact");

				const dotsElement: HTMLElement | null = hostFixture.nativeElement.querySelector("stark-minimap .stark-minimap-dots");
				expect(dotsElement).toBeNull();
			});
		});
	});

	describe("isItemVisible", () => {
		let defaultItem: StarkMinimapItemProperties;

		beforeEach(() => {
			renderComponent();
			component.items = [];
			component.visibleItems = [];
			defaultItem = { name: "item" };
		});

		it("should return FALSE if item is NOT present in visibleItems array", () => {
			const isVisibleColumn: boolean = component.isItemVisible(defaultItem);
			expect(isVisibleColumn).toBe(false);
		});

		it("should return TRUE if item is present in visibleItems array", () => {
			component.visibleItems.push(defaultItem.name);
			const isVisibleColumn: boolean = component.isItemVisible(defaultItem);
			expect(isVisibleColumn).toBe(true);
		});
	});

	describe("events", () => {
		let menuItems: NodeListOf<HTMLElement>;

		beforeEach(() => {
			renderComponent();
			vi.mocked(hostComponent.onShowHideItem).mockClear();
			openMenu();
			menuItems = overlayContainerElement.querySelectorAll(".mat-mdc-menu-panel .mat-mdc-menu-content .mat-mdc-menu-item");
		});

		it("event should be triggered with correct item for each label click", () => {
			expect(menuItems.length).toBe(items.length);

			menuItems.forEach((menuItemElement: HTMLElement) => {
				const labelElement: HTMLElement | null = menuItemElement.querySelector(".mdc-label");
				expect(labelElement).toBeTruthy();
				const text: string = ((labelElement && labelElement.textContent) || "").trim();
				const expectedItem: StarkMinimapItemProperties | undefined = items.find(
					({ label }: StarkMinimapItemProperties) => label === text
				);
				if (!labelElement) {
					return;
				}

				labelElement.click();
				expect(expectedItem).toBeDefined();
				expect(hostComponent.onShowHideItem).toHaveBeenCalledWith(expectedItem as StarkMinimapItemProperties);
			});

			expect(hostComponent.onShowHideItem).toHaveBeenCalledTimes(items.length);
		});
	});
});
