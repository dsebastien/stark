/* eslint-disable @angular-eslint/no-lifecycle-call */
import { CommonModule } from "@angular/common";
import { Component, NgModule } from "@angular/core";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { OverlayContainer } from "@angular/cdk/overlay";
import { ESCAPE } from "@angular/cdk/keycodes";
import { TranslateModule } from "@ngx-translate/core";
import { Observer } from "rxjs";
import { vi } from "vitest";
import { StarkConfirmDialogContent } from "./confirm-dialog-content.intf";
import { StarkConfirmDialogComponent, StarkConfirmDialogResult } from "./confirm-dialog.component";

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
	declarations: [TestHostComponent, StarkConfirmDialogComponent],
	imports: [CommonModule, NoopAnimationsModule, MatButtonModule, MatDialogModule, TranslateModule.forRoot()]
})
class ConfirmDialogTestModule {}

describe("ConfirmDialogComponent", () => {
	let hostFixture: ComponentFixture<TestHostComponent>;
	let hostComponent: TestHostComponent;
	let dialogService: MatDialog;
	let overlayContainer: OverlayContainer;
	let overlayContainerElement: HTMLElement;
	let mockObserver: ObserverSpy<StarkConfirmDialogResult>;

	const dummyDialogContent: StarkConfirmDialogContent = {
		title: "This is the dialog title",
		textContent: "Here goes the content",
		ok: "Ok button label",
		cancel: "Cancel button label"
	};

	const matDialogSelector = "mat-dialog-container.mat-mdc-dialog-container";
	const matDialogTitleSelector = "[mat-dialog-title]";
	const matDialogContentSelector = "[mat-dialog-content]";
	const matDialogActionsSelector = "[mat-dialog-actions]";
	const dialogComponentSelector = "stark-confirm-dialog";

	function openDialog(dialogData: StarkConfirmDialogContent): MatDialogRef<StarkConfirmDialogComponent, StarkConfirmDialogResult> {
		return dialogService.open<StarkConfirmDialogComponent, StarkConfirmDialogContent, StarkConfirmDialogResult>(
			StarkConfirmDialogComponent,
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
			imports: [ConfirmDialogTestModule]
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

		mockObserver = createObserverSpy<StarkConfirmDialogResult>();
	});

	it("should be correctly opened via the MatDialog service", () => {
		expect(hostComponent).toBeDefined();
		expect(dialogService).toBeDefined();

		const dialogRef: MatDialogRef<StarkConfirmDialogComponent, StarkConfirmDialogResult> = openDialog(dummyDialogContent);
		hostFixture.detectChanges();

		expect(dialogRef.componentInstance instanceof StarkConfirmDialogComponent).toBe(true);

		const dialogElement: HTMLElement | null = overlayContainerElement.querySelector<HTMLElement>(
			matDialogSelector + " " + dialogComponentSelector
		);

		const dialogTitleElement: HTMLElement | null = (<HTMLElement>dialogElement).querySelector<HTMLElement>(matDialogTitleSelector);
		expect(dialogTitleElement).toBeDefined();
		expect((<HTMLElement>dialogTitleElement).innerHTML).toEqual(<string>dummyDialogContent.title);

		const dialogContentElement: HTMLElement | null = (<HTMLElement>dialogElement).querySelector<HTMLElement>(matDialogContentSelector);
		expect(dialogContentElement).toBeDefined();
		expect((<HTMLElement>dialogContentElement).innerHTML).toBe(<string>dummyDialogContent.textContent);

		const dialogActionsElement: HTMLElement | null = (<HTMLElement>dialogElement).querySelector<HTMLElement>(matDialogActionsSelector);
		expect(dialogActionsElement).toBeDefined();
		const dialogButtonElements: NodeListOf<HTMLElement> = (<HTMLElement>dialogActionsElement).querySelectorAll("button");
		expect(dialogButtonElements.length).toBe(2);
		expect(dialogButtonElements[0].textContent?.trim()).toBe(<string>dummyDialogContent.cancel);
		expect(dialogButtonElements[1].textContent?.trim()).toBe(<string>dummyDialogContent.ok);
	});

	it("should return 'ok' as result when the 'Ok' button is clicked", async () => {
		const dialogRef: MatDialogRef<StarkConfirmDialogComponent, StarkConfirmDialogResult> = openDialog(dummyDialogContent);
		hostFixture.detectChanges();

		const dialogElement: HTMLElement | null = overlayContainerElement.querySelector<HTMLElement>(
			matDialogSelector + " " + dialogComponentSelector
		);

		dialogRef.afterClosed().subscribe(mockObserver);

		const dialogActionsElement: HTMLElement | null = (<HTMLElement>dialogElement).querySelector<HTMLElement>(matDialogActionsSelector);
		expect(dialogActionsElement).toBeDefined();
		const dialogButtonElements: NodeListOf<HTMLElement> = (<HTMLElement>dialogActionsElement).querySelectorAll("button");
		expect(dialogButtonElements.length).toBe(2);

		triggerClick(dialogButtonElements[1]); // clicking the "ok" button
		hostFixture.detectChanges();
		await waitForDialogToClose();

		expect(mockObserver.next).toHaveBeenCalledTimes(1);
		expect(mockObserver.next).toHaveBeenCalledWith("ok");
		expect(mockObserver.error).not.toHaveBeenCalled();
		expect(mockObserver.complete).toHaveBeenCalled();
	});

	it("should return 'cancel' as result when the 'Cancel' button is clicked", async () => {
		const dialogRef: MatDialogRef<StarkConfirmDialogComponent, StarkConfirmDialogResult> = openDialog(dummyDialogContent);
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
		const dialogRef: MatDialogRef<StarkConfirmDialogComponent, StarkConfirmDialogResult> = openDialog(dummyDialogContent);
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
		const dialogRef: MatDialogRef<StarkConfirmDialogComponent, StarkConfirmDialogResult> = openDialog(dummyDialogContent);
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
