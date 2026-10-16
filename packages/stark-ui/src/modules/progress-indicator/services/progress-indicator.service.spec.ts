import { Store } from "@ngrx/store";
import { BehaviorSubject, Observable } from "rxjs";
import { StarkLoggingService } from "@nationalbankbelgium/stark-core";
import { StarkUIApplicationState } from "@nationalbankbelgium/stark-ui/src/common";
import { vi } from "vitest";
import { StarkProgressIndicatorActions } from "../actions";
import { StarkProgressIndicatorFullConfig, StarkProgressIndicatorType } from "../entities";
import { progressIndicatorReducer } from "../reducers";
import { StarkProgressIndicatorServiceImpl } from "../services";

type ProgressIndicatorMap = Map<string, StarkProgressIndicatorFullConfig>;

type LoggerMock = {
	debug: ReturnType<typeof vi.fn<(message: string) => void>>;
	error: ReturnType<typeof vi.fn<(message: string) => void>>;
};

type StoreMock = {
	dispatch: ReturnType<typeof vi.fn<(action: StarkProgressIndicatorActions.Types) => void>>;
	pipe: ReturnType<typeof vi.fn<(...args: unknown[]) => Observable<ProgressIndicatorMap>>>;
};

const createLoggerMock = (): LoggerMock => ({
	debug: vi.fn<(message: string) => void>(),
	error: vi.fn<(message: string) => void>()
});

const getDispatchedTypes = (store: StoreMock): string[] => store.dispatch.mock.calls.map(([action]) => action.type);

describe("ProgressIndicatorService", () => {
	let mockStore: StoreMock;
	let progressIndicatorService: ProgressIndicatorServiceHelper;
	let mockLogger: LoggerMock;
	let mockProgressIndicatorMap: ProgressIndicatorMap;
	let progressIndicatorState$: BehaviorSubject<ProgressIndicatorMap>;

	const dummyTopic = "some topic";
	const dummyType: StarkProgressIndicatorType = StarkProgressIndicatorType.SPINNER;

	const getTopicConfig = (): StarkProgressIndicatorFullConfig =>
		progressIndicatorService.progressIndicatorMap.get(dummyTopic) as StarkProgressIndicatorFullConfig;

	const expectDispatchTypes = (...types: string[]): void => {
		expect(mockStore.dispatch).toHaveBeenCalledTimes(types.length);
		expect(getDispatchedTypes(mockStore)).toEqual(types);
	};

	const expectTopicConfig = (visible: boolean, listenersCount: number, pendingListenersCount: number): void => {
		const progressIndicatorConfig = getTopicConfig();
		expect(progressIndicatorConfig.topic).toBe(dummyTopic);
		expect(progressIndicatorConfig.type).toBe(dummyType);
		expect(progressIndicatorConfig.visible).toBe(visible);
		expect(progressIndicatorConfig.listenersCount).toEqual(listenersCount);
		expect(progressIndicatorConfig.pendingListenersCount).toEqual(pendingListenersCount);
	};

	beforeEach(() => {
		vi.useFakeTimers();
		mockLogger = createLoggerMock();
		mockProgressIndicatorMap = new Map<string, StarkProgressIndicatorFullConfig>();
		progressIndicatorState$ = new BehaviorSubject(mockProgressIndicatorMap);
		mockStore = {
			dispatch: vi.fn<(action: StarkProgressIndicatorActions.Types) => void>(),
			pipe: vi.fn<(...args: unknown[]) => Observable<ProgressIndicatorMap>>(() => progressIndicatorState$)
		};

		progressIndicatorService = new ProgressIndicatorServiceHelper(
			mockLogger as unknown as StarkLoggingService,
			mockStore as unknown as Store<StarkUIApplicationState>
		);

		mockStore.dispatch.mockImplementation((action: StarkProgressIndicatorActions.Types) => {
			const nextState = progressIndicatorReducer(progressIndicatorService.progressIndicatorMap, action) as ProgressIndicatorMap;
			progressIndicatorService.progressIndicatorMap = nextState;
			progressIndicatorState$.next(nextState);
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("on initialization", () => {
		it("should subscribe to the store to fetch the latest value of the starkProgressIndicator map", () => {
			expect(mockStore.pipe).toHaveBeenCalledTimes(1);
			expect(progressIndicatorService.progressIndicatorMap).toBe(mockProgressIndicatorMap);
			expect(progressIndicatorService.progressIndicatorMap$).toBeDefined();
		});
	});

	describe("register", () => {
		it("should dispatch the REGISTER action in case the topic does not exist yet in the store", () => {
			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(false);

			progressIndicatorService.register(dummyTopic, dummyType);

			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(true);
			expectDispatchTypes(StarkProgressIndicatorActions.register.type);
			expectTopicConfig(false, 1, 0);
		});

		it("should dispatch the REGISTER action in case the topic already exists in the store and increase the listenersCount by 1", () => {
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.register(dummyTopic, dummyType);

			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(true);
			expectDispatchTypes(StarkProgressIndicatorActions.register.type, StarkProgressIndicatorActions.register.type);
			expectTopicConfig(false, 2, 0);
		});
	});

	describe("show", () => {
		it("should dispatch the SHOW action in case the topic exists in the store but not yet visible and increase the pendingListenersCount by 1", () => {
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.show(dummyTopic);

			expectDispatchTypes(StarkProgressIndicatorActions.register.type, StarkProgressIndicatorActions.show.type);
			expectTopicConfig(true, 1, 1);
		});

		it("should NOT dispatch any action in case the topic does not exist in the store", () => {
			progressIndicatorService.show(dummyTopic);
			vi.advanceTimersByTime(800);

			expect(mockStore.dispatch).not.toHaveBeenCalled();
		});

		it("should dispatch the SHOW action right after the topic is created and increase the pendingListenersCount by 1", () => {
			progressIndicatorService.show(dummyTopic);
			progressIndicatorService.register(dummyTopic, dummyType);
			vi.advanceTimersByTime(50);

			expectDispatchTypes(StarkProgressIndicatorActions.register.type, StarkProgressIndicatorActions.show.type);
			expectTopicConfig(true, 1, 1);
		});

		it("should dispatch the SHOW action twice and increase the ListenersCount and the pendingListenersCount by 2", () => {
			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(false);

			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.show(dummyTopic);
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.show(dummyTopic);
			vi.advanceTimersByTime(50);

			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(true);
			expectDispatchTypes(
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.show.type,
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.show.type
			);
			expectTopicConfig(true, 2, 2);
		});
	});

	describe("hide", () => {
		it("should dispatch the HIDE action in case the topic exists and decrease the pendingListenersCount by 1", () => {
			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(false);
			progressIndicatorService.register(dummyTopic, dummyType);
			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(true);

			progressIndicatorService.show(dummyTopic);
			progressIndicatorService.hide(dummyTopic);
			vi.advanceTimersByTime(100);

			expectDispatchTypes(
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.show.type,
				StarkProgressIndicatorActions.hide.type
			);
			expectTopicConfig(false, 1, 0);
		});

		it("should dispatch the HIDE action and decrease the pendingListenersCount by 1", () => {
			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(false);

			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.show(dummyTopic);
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.show(dummyTopic);
			progressIndicatorService.hide(dummyTopic);
			vi.advanceTimersByTime(100);

			expectDispatchTypes(
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.show.type,
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.show.type,
				StarkProgressIndicatorActions.hide.type
			);
			expectTopicConfig(true, 2, 1);
		});
	});

	describe("register after showing/hiding", () => {
		it("should dispatch the show/hide actions in order", () => {
			progressIndicatorService.show(dummyTopic);
			progressIndicatorService.hide(dummyTopic);
			progressIndicatorService.register(dummyTopic, dummyType);
			vi.advanceTimersByTime(200);

			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(true);
			expectDispatchTypes(
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.show.type,
				StarkProgressIndicatorActions.hide.type
			);
			expectTopicConfig(false, 1, 0);
		});

		it("should dispatch only the show action if 'hide' is called before 'show'", () => {
			progressIndicatorService.hide(dummyTopic);
			progressIndicatorService.show(dummyTopic);
			progressIndicatorService.register(dummyTopic, dummyType);
			vi.advanceTimersByTime(200);

			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(true);
			expectDispatchTypes(StarkProgressIndicatorActions.register.type, StarkProgressIndicatorActions.show.type);
			expectTopicConfig(true, 1, 1);
		});
	});

	describe("deregister", () => {
		it("should dispatch the DEREGISTER action in case the topic exists and its listenersCount is 1", () => {
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.deregister(dummyTopic);

			expectDispatchTypes(StarkProgressIndicatorActions.register.type, StarkProgressIndicatorActions.deregister.type);
			expect(mockStore.dispatch).toHaveBeenCalledWith(StarkProgressIndicatorActions.deregister({ topic: dummyTopic }));
			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(false);
		});

		it("should dispatch the DEREGISTER action in case the topic exists and decrease the listenersCount by 1", () => {
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.deregister(dummyTopic);

			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(true);
			expectDispatchTypes(
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.deregister.type
			);
			expectTopicConfig(false, 1, 0);
		});

		it("should NOT dispatch any action in case the topic does not exist in the store", () => {
			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(false);

			progressIndicatorService.deregister(dummyTopic);

			expect(mockStore.dispatch).not.toHaveBeenCalled();
		});

		it("should dispatch the DEREGISTER action and remove the topic from the store", () => {
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.show(dummyTopic);
			progressIndicatorService.hide(dummyTopic);
			vi.advanceTimersByTime(100);
			progressIndicatorService.deregister(dummyTopic);

			expectDispatchTypes(
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.show.type,
				StarkProgressIndicatorActions.hide.type,
				StarkProgressIndicatorActions.deregister.type
			);
			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(false);
		});

		it("should NOT remove the topic from the store when there are still listeners", () => {
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.show(dummyTopic);
			progressIndicatorService.hide(dummyTopic);
			vi.advanceTimersByTime(100);
			progressIndicatorService.deregister(dummyTopic);

			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(true);
			expectDispatchTypes(
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.show.type,
				StarkProgressIndicatorActions.hide.type,
				StarkProgressIndicatorActions.deregister.type
			);
			expectTopicConfig(false, 1, 0);
		});

		it("should NOT remove the topic from the store when there are still listeners regardless of the pendingListeners", () => {
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.show(dummyTopic);
			progressIndicatorService.show(dummyTopic);
			progressIndicatorService.hide(dummyTopic);
			vi.advanceTimersByTime(100);
			progressIndicatorService.deregister(dummyTopic);

			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(true);
			expectDispatchTypes(
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.show.type,
				StarkProgressIndicatorActions.show.type,
				StarkProgressIndicatorActions.hide.type,
				StarkProgressIndicatorActions.deregister.type
			);
			expectTopicConfig(true, 1, 1);
		});
	});

	describe("deregister with multiple listeners", () => {
		it("should dispatch the DEREGISTER action and NOT remove the topic from the store in case there are multiple listeners", () => {
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.show(dummyTopic);
			progressIndicatorService.show(dummyTopic);
			progressIndicatorService.hide(dummyTopic);
			progressIndicatorService.hide(dummyTopic);
			vi.advanceTimersByTime(100);
			progressIndicatorService.deregister(dummyTopic);

			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(true);
			expectDispatchTypes(
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.show.type,
				StarkProgressIndicatorActions.show.type,
				StarkProgressIndicatorActions.hide.type,
				StarkProgressIndicatorActions.hide.type,
				StarkProgressIndicatorActions.deregister.type
			);
		});

		it("should remove the topic from the store after all the different actions were dispatched in order", () => {
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.register(dummyTopic, dummyType);
			progressIndicatorService.show(dummyTopic);
			progressIndicatorService.show(dummyTopic);
			progressIndicatorService.hide(dummyTopic);
			progressIndicatorService.hide(dummyTopic);
			vi.advanceTimersByTime(100);
			progressIndicatorService.deregister(dummyTopic);
			progressIndicatorService.deregister(dummyTopic);

			expect(progressIndicatorService.progressIndicatorMap.has(dummyTopic)).toBe(false);
			expectDispatchTypes(
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.register.type,
				StarkProgressIndicatorActions.show.type,
				StarkProgressIndicatorActions.show.type,
				StarkProgressIndicatorActions.hide.type,
				StarkProgressIndicatorActions.hide.type,
				StarkProgressIndicatorActions.deregister.type,
				StarkProgressIndicatorActions.deregister.type
			);
		});
	});
});

class ProgressIndicatorServiceHelper extends StarkProgressIndicatorServiceImpl {
	declare public progressIndicatorMap: ProgressIndicatorMap;
	declare public progressIndicatorMap$: Observable<ProgressIndicatorMap>;
}
