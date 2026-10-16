import { Store } from "@ngrx/store";
import { BehaviorSubject, Observable } from "rxjs";
import { vi } from "vitest";
import {
	StarkMessage,
	StarkMessageCollection,
	StarkMessageImpl,
	StarkMessageType,
	StarkUIApplicationState
} from "@nationalbankbelgium/stark-ui/src/common";
import { StarkMessagePaneActions } from "../actions";
import { StarkMessagePaneServiceImpl } from "./message-pane.service";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

type StoreMock = {
	dispatch: ReturnType<typeof vi.fn<(action: unknown) => void>>;
	pipe: ReturnType<typeof vi.fn<(...args: unknown[]) => Observable<StarkMessageCollection>>>;
};

type ObserverSpy<T> = {
	next: ReturnType<typeof vi.fn<(value: T) => void>>;
	error: ReturnType<typeof vi.fn<(error: unknown) => void>>;
	complete: ReturnType<typeof vi.fn<() => void>>;
};

const createObserverSpy = <T>(): ObserverSpy<T> => ({
	next: vi.fn<(value: T) => void>(),
	error: vi.fn<(error: unknown) => void>(),
	complete: vi.fn<() => void>()
});

describe("MessagePaneService", () => {
	let mockStore: StoreMock;
	let mockLogger: LoggingServiceMock;
	let appMessagesState$: BehaviorSubject<StarkMessageCollection>;
	let mockMessageCollection: StarkMessageCollection;
	let messagePaneService: MessagePaneServiceHelper;

	const mockInfoMessage: StarkMessage = {
		id: "3",
		key: "MESSAGES.INFOS.DUMMY",
		interpolateValues: { var1: "some info value", var2: "whatever" },
		code: "1234",
		type: StarkMessageType.INFO
	};
	const mockWarningMessage: StarkMessage = {
		id: "2",
		key: "MESSAGES.WARNINGS.DUMMY",
		interpolateValues: { var1: "some warning value", var2: "whatever" },
		code: "4321",
		type: StarkMessageType.WARNING
	};
	const mockErrorMessage: StarkMessage = {
		id: "1",
		key: "MESSAGES.ERRORS.DUMMY",
		interpolateValues: { var1: "some error value", var2: "whatever" },
		code: "0159",
		type: StarkMessageType.ERROR
	};

	beforeEach(() => {
		mockStore = {
			dispatch: vi.fn<(action: unknown) => void>(),
			pipe: vi.fn<(...args: unknown[]) => Observable<StarkMessageCollection>>()
		};
		mockLogger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};

		mockMessageCollection = {
			errorMessages: [],
			warningMessages: [],
			infoMessages: []
		};

		appMessagesState$ = new BehaviorSubject(mockMessageCollection);
		mockStore.pipe.mockReturnValue(appMessagesState$);

		messagePaneService = new MessagePaneServiceHelper(mockLogger as any, mockStore as unknown as Store<StarkUIApplicationState>);
	});

	afterEach(() => {
		appMessagesState$.complete();
	});

	describe("on initialization", () => {
		it("should subscribe to the store to fetch the latest value of the starkMessages (StarkMessageCollection)", () => {
			expect(mockStore.pipe).toHaveBeenCalledTimes(1);
			expect(messagePaneService.messages$).toBeDefined();

			const mockMessagesObserver = createObserverSpy<StarkMessageCollection>();

			messagePaneService.messages$.subscribe({
				next: mockMessagesObserver.next,
				error: mockMessagesObserver.error,
				complete: mockMessagesObserver.complete
			});

			expect(mockMessagesObserver.next).toHaveBeenCalledTimes(1);
			expect(mockMessagesObserver.next).toHaveBeenCalledWith(mockMessageCollection);
			expect(mockMessagesObserver.error).not.toHaveBeenCalled();
			expect(mockMessagesObserver.complete).not.toHaveBeenCalled();
		});
	});

	describe("add", () => {
		it("should dispatch the ADD_MESSAGES action passing the given messages in the payload", () => {
			const mockMessages: StarkMessage[] = [mockInfoMessage, mockWarningMessage, mockErrorMessage];

			messagePaneService.add(mockMessages);

			mockMessages[0] = { ...mockInfoMessage, priority: 999 };
			mockMessages[1] = { ...mockWarningMessage, priority: 999 };
			mockMessages[2] = { ...mockErrorMessage, priority: 999 };

			expect(mockStore.dispatch).toHaveBeenCalledTimes(1);
			expect(mockStore.dispatch).toHaveBeenCalledWith(StarkMessagePaneActions.addMessages({ messages: mockMessages }));
		});
	});

	describe("addOne", () => {
		it("should dispatch the ADD_MESSAGES action and return the observable used to fetch the latest value of the starkMessages", () => {
			messagePaneService.addOne(mockInfoMessage);
			const validatedMessage: StarkMessage = { ...mockInfoMessage, priority: 999 };

			expect(mockStore.dispatch).toHaveBeenCalledTimes(1);
			expect(mockStore.dispatch).toHaveBeenCalledWith(StarkMessagePaneActions.addMessages({ messages: [validatedMessage] }));
		});

		it("should add the default priority of 999, when it is not supplied", () => {
			const message: StarkMessage = {
				id: "3",
				key: "MESSAGES.INFOS.DUMMY",
				interpolateValues: { var1: "some info value", var2: "whatever" },
				code: "1234",
				type: StarkMessageType.INFO
			};

			messagePaneService.addOne(message);
			const validatedMessage: StarkMessage = { ...message, priority: 999 };
			expect(mockStore.dispatch).toHaveBeenCalledWith(StarkMessagePaneActions.addMessages({ messages: [validatedMessage] }));
		});

		it("should throw an error when the priority is smaller than 1", () => {
			const message: StarkMessage = {
				id: "3",
				key: "MESSAGES.INFOS.DUMMY",
				interpolateValues: { var1: "some info value", var2: "whatever" },
				code: "1234",
				type: StarkMessageType.INFO,
				priority: -1
			};

			expect(() => messagePaneService.addOne(message)).toThrowError(/priority has to be between 1 and 999/);
		});

		it("should throw an error when the priority is greater than 999", () => {
			const message: StarkMessage = new StarkMessageImpl(
				"3",
				"MESSAGES.INFOS.DUMMY",
				"1234",
				StarkMessageType.INFO,
				{ var1: "some info value", var2: "whatever" },
				1000
			);

			expect(() => messagePaneService.addOne(message)).toThrowError(/priority has to be between 1 and 999/);
		});

		it("should not change a priority between 1 and 999", () => {
			const message: StarkMessage = new StarkMessageImpl(
				"3",
				"MESSAGES.INFOS.DUMMY",
				"1234",
				StarkMessageType.INFO,
				{ var1: "some info value", var2: "whatever" },
				200
			);

			messagePaneService.addOne(message);
			expect(mockStore.dispatch).toHaveBeenCalledWith(StarkMessagePaneActions.addMessages({ messages: [message] }));
		});
	});

	describe("getAll", () => {
		it("should dispatch the GET_ALL_MESSAGES action passing the given messages in the payload", () => {
			expect(messagePaneService.messages$).toBeDefined();

			const mockMessagesObserver = createObserverSpy<StarkMessageCollection>();

			const getAll$: Observable<StarkMessageCollection> = messagePaneService.getAll();
			expect(getAll$).toBe(messagePaneService.messages$);

			getAll$.subscribe({
				next: mockMessagesObserver.next,
				error: mockMessagesObserver.error,
				complete: mockMessagesObserver.complete
			});

			expect(mockMessagesObserver.next).toHaveBeenCalledTimes(1);
			expect(mockMessagesObserver.next).toHaveBeenCalledWith(mockMessageCollection);
			expect(mockMessagesObserver.error).not.toHaveBeenCalled();
			expect(mockMessagesObserver.complete).not.toHaveBeenCalled();
			expect(mockStore.dispatch).toHaveBeenCalledTimes(1);
			expect(mockStore.dispatch).toHaveBeenCalledWith(StarkMessagePaneActions.getAllMessages());
		});
	});

	describe("remove", () => {
		it("should dispatch the REMOVE_MESSAGES action passing the given messages in the payload", () => {
			const mockMessages: StarkMessage[] = [mockInfoMessage, mockWarningMessage, mockErrorMessage];

			messagePaneService.remove(mockMessages);

			expect(mockStore.dispatch).toHaveBeenCalledTimes(1);
			expect(mockStore.dispatch).toHaveBeenCalledWith(StarkMessagePaneActions.removeMessages({ messages: mockMessages }));
		});
	});

	describe("clearAll", () => {
		it("should dispatch the CLEAR_MESSAGES action without any payload", () => {
			messagePaneService.clearAll();

			expect(mockStore.dispatch).toHaveBeenCalledTimes(1);
			expect(mockStore.dispatch).toHaveBeenCalledWith(StarkMessagePaneActions.clearMessages());
		});
	});
});

class MessagePaneServiceHelper extends StarkMessagePaneServiceImpl {
	declare public messages$: Observable<StarkMessageCollection>;
}
