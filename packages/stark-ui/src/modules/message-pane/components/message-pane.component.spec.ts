/* eslint-disable @angular-eslint/no-lifecycle-call */

import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Component, DebugElement, ViewChild } from "@angular/core";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { By } from "@angular/platform-browser";
import { MatIconTestingModule } from "@angular/material/icon/testing";
import { TranslateModule } from "@ngx-translate/core";
import { BehaviorSubject, Observable } from "rxjs";
import { STARK_LOGGING_SERVICE } from "@nationalbankbelgium/stark-core";
import { vi } from "vitest";
import { StarkMessagePaneComponent, StarkMessagePaneNavItem } from "./message-pane.component";
import { STARK_MESSAGE_PANE_SERVICE } from "../services";
import {
	starkMessagePaneAlignClassPrefix,
	starkMessagePaneDisplayAnimatedClass,
	starkMessagePaneDisplayedClass
} from "./message-pane.constants";
import { StarkMessage, StarkMessageCollection, StarkMessageType } from "@nationalbankbelgium/stark-ui/src/common";
import { StarkDOMUtil } from "@nationalbankbelgium/stark-ui/src/util";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

type MessagePaneServiceMock = {
	getAll: ReturnType<typeof vi.fn<() => Observable<StarkMessageCollection>>>;
	clearAll: ReturnType<typeof vi.fn<() => void>>;
	remove: ReturnType<typeof vi.fn<(messages: StarkMessage[]) => void>>;
	clearOnNavigation: boolean;
};

type ObserverSpy<T> = {
	next: ReturnType<typeof vi.fn<(value: T) => void>>;
	error: ReturnType<typeof vi.fn<(error: unknown) => void>>;
	complete: ReturnType<typeof vi.fn<() => void>>;
};

function createObserverSpy<T>(): ObserverSpy<T> {
	return {
		next: vi.fn<(value: T) => void>(),
		error: vi.fn<(error: unknown) => void>(),
		complete: vi.fn<() => void>()
	};
}

@Component({
	standalone: true,
	selector: "host-component",
	imports: [StarkMessagePaneComponent],
	template: ` <stark-message-pane [clearOnNavigation]="clearOnNavigation" [align]="$any(align)"></stark-message-pane> `
})
class TestHostComponent {
	@ViewChild(StarkMessagePaneComponent, { static: true })
	public messagePaneComponent!: StarkMessagePaneComponent;

	public clearOnNavigation?: boolean;
	public align?: string;
}

describe("MessagePaneComponent", () => {
	let component: StarkMessagePaneComponent;
	let debugElementComponent: DebugElement;
	let hostComponent: TestHostComponent;
	let hostFixture: ComponentFixture<TestHostComponent>;
	let mockLogger: LoggingServiceMock;
	let mockMessagePaneService: MessagePaneServiceMock;
	let mockMessages: StarkMessageCollection;
	let messageCollection$: BehaviorSubject<StarkMessageCollection>;

	const mockClearOnNavigation = false;
	const mockDefaultAlign: "center" | "left" | "right" | undefined = "right";
	const mockCenterAlign: "center" | "left" | "right" | undefined = "center";

	const mockInfoMessage1: StarkMessage = {
		id: "3",
		key: "MESSAGES.INFOS.INFO1",
		interpolateValues: { var1: "some info value", var2: "whatever" },
		code: "1234",
		type: StarkMessageType.INFO
	};
	const mockWarningMessage1: StarkMessage = {
		id: "2",
		key: "MESSAGES.WARNINGS.WARNING1",
		interpolateValues: { var1: "some warning value", var2: "whatever" },
		code: "4321",
		type: StarkMessageType.WARNING
	};
	const mockWarningMessage2: StarkMessage = {
		id: "4",
		key: "MESSAGES.WARNINGS.WARNING2",
		interpolateValues: { var1: "some warning value", var2: "whatever" },
		code: "432122",
		type: StarkMessageType.WARNING
	};
	const mockErrorMessage1: StarkMessage = {
		id: "1",
		key: "MESSAGES.ERRORS.ERROR1",
		interpolateValues: { var1: "some error value", var2: "whatever" },
		code: "0159",
		type: StarkMessageType.ERROR
	};
	const mockErrorMessage2: StarkMessage = {
		id: "5",
		key: "MESSAGES.ERRORS.ERROR2",
		interpolateValues: { var1: "some error value", var2: "whatever" },
		code: "015922",
		type: StarkMessageType.ERROR
	};
	const mockErrorMessage3: StarkMessage = {
		id: "6",
		key: "MESSAGES.ERRORS.ERROR3",
		interpolateValues: { var1: "some error value", var2: "whatever" },
		code: "015933",
		type: StarkMessageType.ERROR
	};

	function getMessageElements(messagePaneContent: Element): NodeListOf<Element> {
		return StarkDOMUtil.getElementsBySelector(messagePaneContent, ".stark-message-pane-item");
	}

	function closeMessage(messageType: StarkMessagePaneNavItem, messageIndex: number): void {
		const messagesButton: HTMLElement = debugElementComponent.query(By.css("." + messageType)).nativeElement;
		const messagePaneContent: HTMLElement = debugElementComponent.query(By.css(".stark-message-pane-content")).nativeElement;

		messagesButton.click();
		hostFixture.detectChanges();

		const messageElements: NodeListOf<Element> = getMessageElements(messagePaneContent);
		const closeButton: HTMLElement = messageElements[messageIndex].querySelector("button") as HTMLElement;
		closeButton.click();
		hostFixture.detectChanges();
	}

	function assertDisplayedTotalMessages(messageType: StarkMessagePaneNavItem, numberOfMessages: number): void {
		const totalMessagesButton: DebugElement = debugElementComponent.query(By.css(".stark-message-pane-total"));
		const messagesTab: HTMLElement = totalMessagesButton.query(By.css("b")).nativeElement;

		expect(totalMessagesButton.classes[messageType]).toBe(true);
		expect(messagesTab.textContent).toEqual(`${numberOfMessages}`);
	}

	function assertDisplayedMessages(messageType: StarkMessagePaneNavItem, messages: StarkMessage[]): void {
		const messagesButton: DebugElement = debugElementComponent.query(By.css("." + messageType + ".tab"));
		const messagesTab: DebugElement = debugElementComponent.query(By.css("." + messageType + " b"));
		const messagePaneContent: HTMLElement = debugElementComponent.query(By.css(".stark-message-pane-content")).nativeElement;

		if (messages.length > 0) {
			expect(messagesButton).toBeTruthy();
			expect(messagePaneContent).toBeTruthy();
			expect(messagesTab).toBeTruthy();
			expect(messagesTab.nativeElement.textContent).toEqual(`${messages.length}`);

			messagesButton.nativeElement.click();
			hostFixture.detectChanges();

			expect(component.toggleActive).toHaveBeenCalled();
			expect(component.toggleActive).toHaveBeenCalledWith(messageType);

			let messageElements: NodeListOf<Element> = getMessageElements(messagePaneContent);
			expect(messageElements.length).toBe(messages.length);

			messagesButton.nativeElement.click();
			hostFixture.detectChanges();
			messageElements = getMessageElements(messagePaneContent);
			expect(messageElements.length).toBe(0);
		} else {
			expect(messagesButton).toBeNull();
		}
	}

	beforeEach(async () => {
		mockLogger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};
		mockMessagePaneService = {
			getAll: vi.fn<() => Observable<StarkMessageCollection>>(),
			clearAll: vi.fn<() => void>(),
			remove: vi.fn<(messages: StarkMessage[]) => void>(),
			clearOnNavigation: false
		};

		await TestBed.configureTestingModule({
			imports: [MatIconTestingModule, TranslateModule.forRoot(), NoopAnimationsModule, TestHostComponent],
			providers: [
				{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger },
				{ provide: STARK_MESSAGE_PANE_SERVICE, useValue: mockMessagePaneService }
			]
		}).compileComponents();
	});

	beforeEach(() => {
		hostFixture = TestBed.createComponent(TestHostComponent);
		hostComponent = hostFixture.componentInstance;
		component = hostComponent.messagePaneComponent;
		debugElementComponent = hostFixture.debugElement.query(By.directive(StarkMessagePaneComponent));

		vi.spyOn(component, "clearAllMessages");
		vi.spyOn(component, "collapseMessages");
		vi.spyOn(component, "expandMessages");
		vi.spyOn(component, "hidePane");
		vi.spyOn(component, "showPane");
		vi.spyOn(component, "toggleActive");

		mockMessages = {
			infoMessages: [],
			warningMessages: [],
			errorMessages: []
		};
		messageCollection$ = new BehaviorSubject<StarkMessageCollection>(mockMessages);
		mockMessagePaneService.getAll.mockReturnValue(messageCollection$);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("on initialization", () => {
		beforeEach(() => {
			hostFixture.detectChanges();
		});

		it("should set internal component properties", () => {
			expect(hostFixture).toBeDefined();
			expect(component).toBeDefined();
			expect(component.logger).toBeTruthy();
			expect(component.messagePaneService).toBeTruthy();
		});

		it("should have default inputs", () => {
			expect(component.clearOnNavigation).toBeUndefined();
			expect(component.align).toBe(mockDefaultAlign);
		});
	});

	describe("on initialization with specific inputs", () => {
		beforeEach(() => {
			hostComponent.clearOnNavigation = mockClearOnNavigation;
			hostComponent.align = mockCenterAlign;
			hostFixture.detectChanges();
		});

		describe("inputs", () => {
			it("should have inputs set", () => {
				expect(component.clearOnNavigation).toBe(mockClearOnNavigation);
				expect(component.align).toBe(mockCenterAlign);
			});

			it("should have the correct CSS classes", () => {
				const alignClassname: string = starkMessagePaneAlignClassPrefix + mockCenterAlign;
				expect(debugElementComponent.classes[alignClassname]).toBe(true);
			});
		});
	});

	describe("showPane", () => {
		it("should add classes to the root element", () => {
			vi.useFakeTimers();
			component.ngOnInit();

			expect(debugElementComponent).toBeTruthy();
			expect(debugElementComponent.classes[starkMessagePaneDisplayedClass]).toBeUndefined();
			expect(debugElementComponent.classes[starkMessagePaneDisplayAnimatedClass]).toBeUndefined();

			component.showPane();

			expect(debugElementComponent.classes[starkMessagePaneDisplayedClass]).toBe(true);
			vi.advanceTimersByTime(component.showAnimationDelay + 10);
			expect(debugElementComponent.classes[starkMessagePaneDisplayAnimatedClass]).toBe(true);
		});

		it("when called right after hidePane(), it should wait fot the panel to be hidden before re-showing the pane", () => {
			vi.useFakeTimers();
			const mockObserver: ObserverSpy<string> = createObserverSpy<string>();

			component.ngOnInit();
			component["renderer"].addClass(component["elementRef"].nativeElement, starkMessagePaneDisplayAnimatedClass);
			component["renderer"].addClass(component["elementRef"].nativeElement, starkMessagePaneDisplayedClass);

			expect(debugElementComponent.classes[starkMessagePaneDisplayedClass]).toBe(true);
			expect(debugElementComponent.classes[starkMessagePaneDisplayAnimatedClass]).toBe(true);
			expect(component.hide$).toBeUndefined();

			component.hidePane();

			expect(component.hide$).toBeDefined();
			(component.hide$ as Observable<string>).subscribe({
				next: mockObserver.next,
				error: mockObserver.error,
				complete: mockObserver.complete
			});

			expect(debugElementComponent.classes[starkMessagePaneDisplayAnimatedClass]).toBeUndefined();
			expect(debugElementComponent.classes[starkMessagePaneDisplayedClass]).toBe(true);

			component.showPane();

			expect(debugElementComponent.classes[starkMessagePaneDisplayedClass]).toBe(true);
			expect(debugElementComponent.classes[starkMessagePaneDisplayAnimatedClass]).toBeUndefined();

			expect(mockObserver.next).not.toHaveBeenCalled();
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();

			vi.advanceTimersByTime(component.hideAnimationDelay + 10);

			expect(debugElementComponent.classes[starkMessagePaneDisplayedClass]).toBe(true);
			expect(debugElementComponent.classes[starkMessagePaneDisplayAnimatedClass]).toBeUndefined();

			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.next).toHaveBeenCalledWith(expect.stringContaining("pane hidden"));
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).toHaveBeenCalledTimes(1);

			vi.advanceTimersByTime(component.showAnimationDelay + 10);
			expect(debugElementComponent.classes[starkMessagePaneDisplayAnimatedClass]).toBe(true);
		});
	});

	describe("hidePane", () => {
		it("should remove classes from the root element", () => {
			vi.useFakeTimers();
			component.ngOnInit();
			expect(component["elementRef"].nativeElement).toBeTruthy();
			component["renderer"].addClass(component["elementRef"].nativeElement, starkMessagePaneDisplayAnimatedClass);
			component["renderer"].addClass(component["elementRef"].nativeElement, starkMessagePaneDisplayedClass);

			expect(debugElementComponent.classes[starkMessagePaneDisplayAnimatedClass]).toBe(true);
			expect(debugElementComponent.classes[starkMessagePaneDisplayedClass]).toBe(true);

			component.hidePane();
			expect(debugElementComponent.classes[starkMessagePaneDisplayAnimatedClass]).toBeUndefined();
			expect(debugElementComponent.classes[starkMessagePaneDisplayedClass]).toBe(true);

			vi.advanceTimersByTime(component.hideAnimationDelay + 10);
			expect(debugElementComponent.classes[starkMessagePaneDisplayedClass]).toBeUndefined();
		});

		it("should create a new hide$ Subject that should emit once the hide process has finished", () => {
			vi.useFakeTimers();
			const mockObserver: ObserverSpy<string> = createObserverSpy<string>();

			component.ngOnInit();
			component["renderer"].addClass(component["elementRef"].nativeElement, starkMessagePaneDisplayAnimatedClass);
			component["renderer"].addClass(component["elementRef"].nativeElement, starkMessagePaneDisplayedClass);

			expect(component.hide$).toBeUndefined();
			expect(debugElementComponent.classes[starkMessagePaneDisplayAnimatedClass]).toBe(true);
			expect(debugElementComponent.classes[starkMessagePaneDisplayedClass]).toBe(true);

			component.hidePane();

			expect(component.hide$).toBeDefined();
			(component.hide$ as Observable<string>).subscribe({
				next: mockObserver.next,
				error: mockObserver.error,
				complete: mockObserver.complete
			});

			expect(mockObserver.next).not.toHaveBeenCalled();
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();

			expect(debugElementComponent.classes[starkMessagePaneDisplayAnimatedClass]).toBeUndefined();
			expect(debugElementComponent.classes[starkMessagePaneDisplayedClass]).toBe(true);

			vi.advanceTimersByTime(component.hideAnimationDelay + 10);
			expect(debugElementComponent.classes[starkMessagePaneDisplayedClass]).toBeUndefined();

			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.next).toHaveBeenCalledWith(expect.stringContaining("pane hidden"));
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).toHaveBeenCalledTimes(1);
		});
	});

	describe("message pane", () => {
		beforeEach(() => {
			hostFixture.detectChanges();

			mockMessages = {
				infoMessages: [mockInfoMessage1],
				warningMessages: [mockWarningMessage1, mockWarningMessage2],
				errorMessages: [mockErrorMessage1, mockErrorMessage2, mockErrorMessage3]
			};

			messageCollection$.next(mockMessages);
			hostFixture.detectChanges();
		});

		describe("display message pane", () => {
			it("should render the appropriate content", () => {
				expect(component.showPane).toHaveBeenCalledTimes(1);

				const messagesNavBar: HTMLElement = debugElementComponent.query(By.css(".summary")).nativeElement;
				expect(messagesNavBar).not.toBeNull();

				const activeTab: DebugElement = debugElementComponent.query(By.css(".active"));
				expect(activeTab).toBeNull();

				const errorMessagesTab: HTMLElement = debugElementComponent.query(By.css(".errors b")).nativeElement;
				const warningMessagesTab: HTMLElement = debugElementComponent.query(By.css(".warnings b")).nativeElement;
				const infoMessagesTab: HTMLElement = debugElementComponent.query(By.css(".infos b")).nativeElement;
				const totalMessagesTab: HTMLElement = debugElementComponent.query(By.css(".stark-message-pane-total b")).nativeElement;
				const totalMessages: number =
					mockMessages.infoMessages.length + mockMessages.warningMessages.length + mockMessages.errorMessages.length;

				expect(errorMessagesTab).toBeTruthy();
				expect(warningMessagesTab).toBeTruthy();
				expect(infoMessagesTab).toBeTruthy();
				expect(totalMessagesTab).toBeTruthy();
				expect(errorMessagesTab.textContent).toEqual(`${mockMessages.errorMessages.length}`);
				expect(warningMessagesTab.textContent).toEqual(`${mockMessages.warningMessages.length}`);
				expect(infoMessagesTab.textContent).toEqual(`${mockMessages.infoMessages.length}`);
				expect(totalMessagesTab.textContent).toEqual(`${totalMessages}`);
			});
		});

		describe("collapse, expand and hide the message pane", () => {
			beforeEach(() => {
				mockMessagePaneService.clearAll.mockImplementation(() => {
					const emptyMessageCollection: StarkMessageCollection = {
						infoMessages: [],
						warningMessages: [],
						errorMessages: []
					};

					messageCollection$.next(emptyMessageCollection);
					hostFixture.detectChanges();
				});
			});

			it("should expand and collapse upon button clicks", () => {
				const collapseMessagesButton: DebugElement = debugElementComponent.query(By.css(".collapse-pane"));
				const totalMessagesButton: DebugElement = debugElementComponent.query(By.css(".stark-message-pane-total"));

				expect(collapseMessagesButton.nativeElement).toBeTruthy();
				expect(totalMessagesButton.nativeElement).toBeTruthy();
				expect(totalMessagesButton.classes["errors"]).toBe(true);
				expect(debugElementComponent.classes["collapsed"]).toBeUndefined();

				collapseMessagesButton.nativeElement.click();
				hostFixture.detectChanges();

				expect(component.collapseMessages).toHaveBeenCalledTimes(1);
				expect(debugElementComponent.classes["collapsed"]).toBe(true);

				totalMessagesButton.nativeElement.click();
				hostFixture.detectChanges();

				expect(component.expandMessages).toHaveBeenCalledTimes(1);
				expect(debugElementComponent.classes["collapsed"]).toBeUndefined();
			});

			it("should clear all messages and hide the message pane component", () => {
				const clearAllMessagesButton: HTMLElement = debugElementComponent.query(By.css(".clear-all-messages")).nativeElement;

				expect(clearAllMessagesButton).toBeTruthy();

				clearAllMessagesButton.click();
				hostFixture.detectChanges();

				expect(component.clearAllMessages).toHaveBeenCalledTimes(1);
				expect(mockMessagePaneService.clearAll).toHaveBeenCalledTimes(1);
				expect(component.hidePane).toHaveBeenCalledTimes(1);
				expect(component.isVisible).toBe(false);

				const messagePaneContent: HTMLElement = debugElementComponent.query(By.css(".stark-message-pane-content")).nativeElement;
				const messageElements: NodeListOf<Element> = getMessageElements(messagePaneContent);
				expect(messageElements.length).toBe(0);

				assertDisplayedMessages("warnings", []);
				assertDisplayedMessages("infos", []);
				assertDisplayedMessages("errors", []);
			});
		});

		describe("messages details", () => {
			it("should expand and collapse the error messages when clicking the errors button", () => {
				assertDisplayedMessages("errors", mockMessages.errorMessages);
				assertDisplayedMessages("warnings", mockMessages.warningMessages);
				assertDisplayedMessages("infos", mockMessages.infoMessages);
			});
		});

		describe("messages", () => {
			beforeEach(() => {
				hostFixture.detectChanges();

				mockMessages = {
					infoMessages: [mockInfoMessage1],
					warningMessages: [mockWarningMessage1],
					errorMessages: [mockErrorMessage1]
				};

				messageCollection$.next(mockMessages);
				hostFixture.detectChanges();

				mockMessagePaneService.remove.mockImplementation((messagesToRemove: StarkMessage[]) => {
					for (const message of messagesToRemove) {
						let messageArray: StarkMessage[];
						switch (message.type) {
							case StarkMessageType.INFO:
								messageArray = mockMessages.infoMessages;
								break;
							case StarkMessageType.WARNING:
								messageArray = mockMessages.warningMessages;
								break;
							case StarkMessageType.ERROR:
								messageArray = mockMessages.errorMessages;
								break;
							default:
								throw new Error("unknown message type");
						}

						const idx: number = messageArray.indexOf(message);
						if (idx !== -1) {
							messageArray.splice(idx, 1);
						}
					}

					messageCollection$.next(mockMessages);
					hostFixture.detectChanges();
				});
			});

			it("should be removed when its 'close' button is clicked and remove the current tab if it has no more messages", () => {
				let indexToRemove: number;

				assertDisplayedTotalMessages("errors", 3);

				indexToRemove = mockMessages.errorMessages.indexOf(mockErrorMessage1);
				closeMessage("errors", indexToRemove);
				assertDisplayedMessages("errors", mockMessages.errorMessages);
				assertDisplayedTotalMessages("warnings", 2);

				indexToRemove = mockMessages.warningMessages.indexOf(mockWarningMessage1);
				closeMessage("warnings", indexToRemove);
				assertDisplayedMessages("warnings", mockMessages.warningMessages);
				assertDisplayedTotalMessages("infos", 1);

				indexToRemove = mockMessages.infoMessages.indexOf(mockInfoMessage1);
				closeMessage("infos", indexToRemove);
				assertDisplayedMessages("infos", mockMessages.infoMessages);
				assertDisplayedTotalMessages("infos", 0);
			});
		});

		describe("toggleActive", () => {
			it("should change the current active tab", () => {
				component.ngOnInit();
				expect(component.currentNavItem).toBe("");
				component.toggleActive("errors");
				expect(component.currentNavItem).toBe("errors");
				component.toggleActive("warnings");
				expect(component.currentNavItem).toBe("warnings");
			});

			it("clicking twice should set the active tab to none", () => {
				component.ngOnInit();
				expect(component.currentNavItem).toBe("");
				component.toggleActive("errors");
				expect(component.currentNavItem).toBe("errors");
				component.toggleActive("errors");
				expect(component.currentNavItem).toBe("");
			});
		});
	});
});
