/* eslint-disable @angular-eslint/no-lifecycle-call */
import { CommonModule } from "@angular/common";
import { Component, NgModule } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatDialogModule } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { OverlayContainer } from "@angular/cdk/overlay";
import { ESCAPE } from "@angular/cdk/keycodes";
import { TranslateModule } from "@ngx-translate/core";
import { Observer } from "rxjs";
import { vi } from "vitest";
import { StarkPromptDialogContent } from "./prompt-dialog-content.intf";
import { StarkPromptDialogComponent, StarkPromptDialogResult } from "./prompt-dialog.component";

type ObserverSpy<T> = Observer<T> & {
	next: ReturnType<typeof vi.fn<(value: T) => void>>;
	error: ReturnType<typeof vi.fn<(err: unknown) => void>>;
	complete: ReturnType<typeof vi.fn<() => void>>;
};

@Component({
	standalone: false,
	selector: `host-component`,
	template: ` no content `
})
class TestHostComponent {}

@NgModule({
	declarations: [TestHostComponent, StarkPromptDialogComponent],
	imports: [
		CommonModule,
		ReactiveFormsModule,
		NoopAnimationsModule,
		MatButtonModule,
		MatDialogModule,
		MatFormFieldModule,
		MatInputModule,
		TranslateModule.forRoot()
	]
})
class PromptDialogTestModule {}

describe("PromptDialogComponent", () => {
	let hostFixture: ComponentFixture<TestHostComponent>;
	let hostComponent: TestHostComponent;
	let dialogService: MatDialog;
	let overlayContainer: OverlayContainer;
	let overlayContainerElement: HTMLElement;
	let mockObserver: ObserverSpy<StarkPromptDialogResult>;

	const dummyDialogContent: StarkPromptDialogContent = {
		title: "This is the dialog title",
		textContent: "Here goes the content",
		label: "The input's label",
		placeholder: "The input's placeholder",
		initialValue: "The input's initial value",
		ok: "Ok button label",
		cancel: "Cancel button label"
	};

	const matDialogSelector = "mat-dialog-container.mat-mdc-dialog-container";
	const matDialogTitleSelector = "[mat-dialog-title]";
	const matDialogContentSelector = "[mat-dialog-content]";
	const matDialogActionsSelector = "[mat-dialog-actions]";
	const dialogComponentSelector = "stark-prompt-dialog";

	function openDialog(dialogData: StarkPromptDialogContent): MatDialogRef<StarkPromptDialogComponent, StarkPromptDialogResult> {
		return dialogService.open<StarkPromptDialogComponent, StarkPromptDialogContent, StarkPromptDialogResult>(
			StarkPromptDialogComponent,
			{
				data: dialogData
			}
		);
	}

	function triggerClick(element: HTMLElement): void {
		element.click();
	}

	function createObserverSpy<T>(): ObserverSpy<T> {
		return {
			next: vi.fn<(value: T) => void>(),
			error: vi.fn<(err: unknown) => void>(),
			complete: vi.fn<() => void>()
		};
	}

	/**
	 * Angular Material dialogs listen to the Escape key on the keydown event
	 */
	function triggerKeydownEscape(element: HTMLElement): void {
		const keydownEvent = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
		Object.defineProperty(keydownEvent, "keyCode", { get: (): number => ESCAPE });
		element.dispatchEvent(keydownEvent);
	}

	async function waitForDialogToClose(): Promise<void> {
		await hostFixture.whenStable();
		await new Promise((resolve) => setTimeout(resolve, 500));
		hostFixture.detectChanges();
		await hostFixture.whenStable();
		hostFixture.detectChanges();
	}

	beforeEach(waitForAsync(() =>
		TestBed.configureTestingModule({
			imports: [PromptDialogTestModule]
		}).compileComponents()));

	afterEach(() => {
		overlayContainer.ngOnDestroy();
	});

	beforeEach(() => {
		dialogService = TestBed.inject(MatDialog);
		overlayContainer = TestBed.inject(OverlayContainer);
		overlayContainerElement = overlayContainer.getContainerElement();

		hostFixture = TestBed.createComponent(TestHostComponent);
		hostComponent = hostFixture.componentInstance;
		hostFixture.detectChanges();

		mockObserver = createObserverSpy<StarkPromptDialogResult>();
	});

	it("should be correctly opened via the MatDialog service", () => {
		expect(hostComponent).toBeDefined();
		expect(dialogService).toBeDefined();

		const dialogRef: MatDialogRef<StarkPromptDialogComponent, StarkPromptDialogResult> = openDialog(dummyDialogContent);
		hostFixture.detectChanges();

		expect(dialogRef.componentInstance instanceof StarkPromptDialogComponent).toBe(true);

		const dialogElement: HTMLElement | null = overlayContainerElement.querySelector<HTMLElement>(
			matDialogSelector + " " + dialogComponentSelector
		);

		const dialogTitleElement: HTMLElement | null = (<HTMLElement>dialogElement).querySelector<HTMLElement>(matDialogTitleSelector);
		expect(dialogTitleElement).toBeDefined();
		expect((<HTMLElement>dialogTitleElement).innerHTML).toEqual(<string>dummyDialogContent.title);

		const dialogContentElement: HTMLElement | null = (<HTMLElement>dialogElement).querySelector<HTMLElement>(matDialogContentSelector);
		expect(dialogContentElement).toBeDefined();
		expect((<HTMLElement>dialogContentElement).innerHTML).toContain(<string>dummyDialogContent.textContent);

		const dialogActionsElement: HTMLElement | null = (<HTMLElement>dialogElement).querySelector<HTMLElement>(matDialogActionsSelector);
		expect(dialogActionsElement).toBeDefined();
		const dialogButtonElements: NodeListOf<HTMLElement> = (<HTMLElement>dialogActionsElement).querySelectorAll("button");
		expect(dialogButtonElements.length).toBe(2);
		expect(dialogButtonElements[0].textContent?.trim()).toBe(<string>dummyDialogContent.cancel);
		expect(dialogButtonElements[1].textContent?.trim()).toBe(<string>dummyDialogContent.ok);
	});

	it("should return the value typed by the user as result when the 'Ok' button is clicked", async () => {
		const dialogRef: MatDialogRef<StarkPromptDialogComponent, StarkPromptDialogResult> = openDialog(dummyDialogContent);
		hostFixture.detectChanges();

		const dialogElement: HTMLElement | null = overlayContainerElement.querySelector<HTMLElement>(
			matDialogSelector + " " + dialogComponentSelector
		);

		dialogRef.afterClosed().subscribe(mockObserver);

		const dummyValue = "some dummy value";
		expect(dialogRef.componentInstance.formControl.value).toBe(dummyDialogContent.initialValue);
		dialogRef.componentInstance.formControl.setValue(dummyValue); // changing the input's value

		const dialogActionsElement: HTMLElement | null = (<HTMLElement>dialogElement).querySelector<HTMLElement>(matDialogActionsSelector);
		expect(dialogActionsElement).toBeDefined();
		const dialogButtonElements: NodeListOf<HTMLElement> = (<HTMLElement>dialogActionsElement).querySelectorAll("button");
		expect(dialogButtonElements.length).toBe(2);

		triggerClick(dialogButtonElements[1]); // clicking the "ok" button
		hostFixture.detectChanges();
		await waitForDialogToClose();

		expect(mockObserver.next).toHaveBeenCalledTimes(1);
		expect(mockObserver.next).toHaveBeenCalledWith(dummyValue);
		expect(mockObserver.error).not.toHaveBeenCalled();
		expect(mockObserver.complete).toHaveBeenCalled();
	});

	it("should return 'cancel' as result when the 'Cancel' button is clicked", async () => {
		const dialogRef: MatDialogRef<StarkPromptDialogComponent, StarkPromptDialogResult> = openDialog(dummyDialogContent);
		hostFixture.detectChanges();

		const dialogElement: HTMLElement | null = overlayContainerElement.querySelector<HTMLElement>(
			matDialogSelector + " " + dialogComponentSelector
		);

		dialogRef.afterClosed().subscribe(mockObserver);

		const dialogActionsElement: HTMLElement | null = (<HTMLElement>dialogElement).querySelector<HTMLElement>(matDialogActionsSelector);
		expect(dialogActionsElement).toBeDefined();
		const dialogButtonElements: NodeListOf<HTMLElement> = (<HTMLElement>dialogActionsElement).querySelectorAll("button");
		expect(dialogButtonElements.length).toBe(2);

		triggerClick(dialogButtonElements[0]); // clicking the "cancel" button
		hostFixture.detectChanges();
		await waitForDialogToClose();

		expect(mockObserver.next).toHaveBeenCalledTimes(1);
		expect(mockObserver.next).toHaveBeenCalledWith("cancel");
		expect(mockObserver.error).not.toHaveBeenCalled();
		expect(mockObserver.complete).toHaveBeenCalled();
	});

	it("should return undefined as result when it is cancelled by clicking outside of the dialog", async () => {
		const dialogRef: MatDialogRef<StarkPromptDialogComponent, StarkPromptDialogResult> = openDialog(dummyDialogContent);
		hostFixture.detectChanges();

		dialogRef.afterClosed().subscribe(mockObserver);

		triggerClick(<HTMLElement>overlayContainerElement.querySelector(".cdk-overlay-backdrop")); // clicking on the backdrop
		hostFixture.detectChanges();
		await waitForDialogToClose();

		expect(mockObserver.next).toHaveBeenCalledTimes(1);
		expect(mockObserver.next).toHaveBeenCalledWith(undefined);
		expect(mockObserver.error).not.toHaveBeenCalled();
		expect(mockObserver.complete).toHaveBeenCalled();
	});

	it("should return undefined as result when it is cancelled by pressing the ESC key", async () => {
		const dialogRef: MatDialogRef<StarkPromptDialogComponent, StarkPromptDialogResult> = openDialog(dummyDialogContent);
		hostFixture.detectChanges();

		dialogRef.afterClosed().subscribe(mockObserver);

		triggerKeydownEscape(overlayContainerElement); // pressing Esc key in the overlay
		hostFixture.detectChanges();
		await waitForDialogToClose();

		expect(mockObserver.next).toHaveBeenCalledTimes(1);
		expect(mockObserver.next).toHaveBeenCalledWith(undefined);
		expect(mockObserver.error).not.toHaveBeenCalled();
		expect(mockObserver.complete).toHaveBeenCalled();
	});
});
