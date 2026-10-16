import { TestBed } from "@angular/core/testing";
import { Observable, ReplaySubject, of } from "rxjs";
import { provideMockActions } from "@ngrx/effects/testing";
import { StarkRoutingActions } from "@nationalbankbelgium/stark-core";
import { vi } from "vitest";
import { StarkMessagePaneEffects } from "./message-pane.effects";
import { STARK_MESSAGE_PANE_SERVICE } from "../services";

type MessagePaneServiceMock = {
	clearAll: ReturnType<typeof vi.fn<() => void>>;
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

describe("Effect: StarkMessagePaneEffects", () => {
	let messagePaneEffects: StarkMessagePaneEffects;
	let mockMessagePaneService: MessagePaneServiceMock;
	let actions: Observable<unknown>;

	beforeEach(() => {
		actions = of();
		mockMessagePaneService = {
			clearAll: vi.fn<() => void>(),
			clearOnNavigation: false
		};

		TestBed.configureTestingModule({
			providers: [
				StarkMessagePaneEffects,
				provideMockActions(() => actions),
				{
					provide: STARK_MESSAGE_PANE_SERVICE,
					useValue: mockMessagePaneService
				}
			]
		});

		messagePaneEffects = TestBed.inject(StarkMessagePaneEffects);
	});

	describe("on clearOnNavigationSuccess$", () => {
		it("should clear and hide the message pane", () => {
			mockMessagePaneService.clearOnNavigation = true;
			const mockObserver: ObserverSpy<void> = createObserverSpy<void>();
			const subject: ReplaySubject<ReturnType<typeof StarkRoutingActions.navigateSuccess>> = new ReplaySubject(1);
			actions = subject.asObservable();

			messagePaneEffects.clearOnNavigationSuccess$.subscribe({
				next: mockObserver.next,
				error: mockObserver.error,
				complete: mockObserver.complete
			});

			subject.next(StarkRoutingActions.navigateSuccess({ previousState: "previousState", currentState: "currentState" }));

			expect(mockMessagePaneService.clearAll).toHaveBeenCalledTimes(1);
			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();
		});

		it("should not clear and hide the message pane when the 'clearOnNavigation' option is not set", () => {
			mockMessagePaneService.clearOnNavigation = false;
			const mockObserver: ObserverSpy<void> = createObserverSpy<void>();
			const subject: ReplaySubject<ReturnType<typeof StarkRoutingActions.navigateSuccess>> = new ReplaySubject(1);
			actions = subject.asObservable();

			messagePaneEffects.clearOnNavigationSuccess$.subscribe({
				next: mockObserver.next,
				error: mockObserver.error,
				complete: mockObserver.complete
			});

			subject.next(StarkRoutingActions.navigateSuccess({ previousState: "previousState", currentState: "currentState" }));

			expect(mockMessagePaneService.clearAll).not.toHaveBeenCalled();
			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();
		});
	});
});
