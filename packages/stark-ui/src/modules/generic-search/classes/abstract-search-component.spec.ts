/* eslint-disable @angular-eslint/no-lifecycle-call */
import { UntypedFormGroup } from "@angular/forms";
import { StarkResource } from "@nationalbankbelgium/stark-core";
import { StarkProgressIndicatorService } from "@nationalbankbelgium/stark-ui/src/modules/progress-indicator";
import { Observable, Observer, of, Subject, Subscriber, TeardownLogic, throwError } from "rxjs";
import { vi } from "vitest";
import { AbstractStarkSearchComponent, StarkGenericSearchService } from "../classes";
import { StarkSearchState } from "../entities";

type GenericSearchServiceMock = {
	getSearchState: ReturnType<typeof vi.fn>;
	resetSearchState: ReturnType<typeof vi.fn>;
	createNew: ReturnType<typeof vi.fn>;
	search: ReturnType<typeof vi.fn>;
};

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn>;
	error: ReturnType<typeof vi.fn>;
	warn: ReturnType<typeof vi.fn>;
};

type ProgressIndicatorServiceMock = {
	show: ReturnType<typeof vi.fn>;
	hide: ReturnType<typeof vi.fn>;
};

type ObserverSpy<T> = {
	observer: Observer<T>;
	next: ReturnType<typeof vi.fn>;
	error: ReturnType<typeof vi.fn>;
	complete: ReturnType<typeof vi.fn>;
};

describe("AbstractSearchComponent", () => {
	let component: SearchComponentHelper;
	let genericSearchService: GenericSearchServiceMock;
	let logger: LoggingServiceMock;
	let progressService: ProgressIndicatorServiceMock;
	let originalSearchCriteria: SearchCriteria;
	let getSearchStateObsTeardown: TeardownSpy;
	let searchObsTeardown: TeardownSpy;
	let mockObserver: ObserverSpy<MockResource[]>;

	beforeEach(() => {
		genericSearchService = {
			getSearchState: vi.fn(),
			resetSearchState: vi.fn(),
			createNew: vi.fn(),
			search: vi.fn()
		};
		logger = createLoggerMock();
		progressService = createProgressIndicatorServiceMock();

		component = new SearchComponentHelper(
			genericSearchService as unknown as StarkGenericSearchService<MockResource, SearchCriteria>,
			logger as any,
			progressService as unknown as StarkProgressIndicatorService
		);

		getSearchStateObsTeardown = createTeardownSpy();
		searchObsTeardown = createTeardownSpy();
		originalSearchCriteria = { uuid: "3" };
		genericSearchService.getSearchState.mockReturnValue(
			createObservableOf<StarkSearchState<SearchCriteria>>(
				{
					criteria: originalSearchCriteria,
					hasBeenSearched: false
				},
				getSearchStateObsTeardown.callback
			)
		);

		mockObserver = createObserverSpy<MockResource[]>();
	});

	describe("ngOnInit", () => {
		it("should clone the searchCriteria as originalCopy and search again if hasBeenSearched is TRUE", () => {
			const expectedResult: MockResource[] = [
				{ uuid: "1", name: "first" },
				{ uuid: "2", name: "second" }
			];

			genericSearchService.search.mockReturnValue(of(expectedResult));
			genericSearchService.getSearchState.mockReturnValue(
				of({
					criteria: originalSearchCriteria,
					hasBeenSearched: true
				})
			);

			component.ngOnInit();

			component.getResults().subscribe(mockObserver.observer);
			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.next).toHaveBeenCalledWith(expectedResult);
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();

			expect(genericSearchService.search).toHaveBeenCalledTimes(1);
			expect(component.getOriginalCopy()).toBe(originalSearchCriteria);
			expect(component.getWorkingCopy()).toEqual(originalSearchCriteria);
			expect(component.getOriginalCopy()).not.toBe(component.getWorkingCopy());
		});

		it("should set the searchCriteria as original copy and DON'T search if hasBeenSearched is FALSE", () => {
			genericSearchService.getSearchState.mockReturnValue(
				of({
					criteria: originalSearchCriteria,
					hasBeenSearched: false
				})
			);

			component.ngOnInit();

			component.getResults().subscribe(mockObserver.observer);
			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.next).toHaveBeenCalledWith([]);
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();

			expect(genericSearchService.search).not.toHaveBeenCalled();
			expect(component.getOriginalCopy()).toBe(originalSearchCriteria);
			expect(component.getWorkingCopy()).toEqual(originalSearchCriteria);
			expect(component.getOriginalCopy()).not.toBe(component.getWorkingCopy());
		});

		it("should subscribe for changes of the search state and set it as original copy whenever a change is triggered", () => {
			const searchState$ = new Subject<StarkSearchState<SearchCriteria>>();
			const mockCriteria1: SearchCriteria = { uuid: "dummy uuid" };
			const mockCriteria2: SearchCriteria = { uuid: "another uuid" };

			genericSearchService.search.mockReturnValue(of(<any>"dummy search result"));
			genericSearchService.getSearchState.mockReturnValue(searchState$.asObservable());

			component.ngOnInit();

			searchState$.next({
				criteria: mockCriteria1,
				hasBeenSearched: true
			});

			expect(component.getOriginalCopy()).not.toEqual(originalSearchCriteria);
			expect(component.getOriginalCopy()).toBe(mockCriteria1);
			expect(component.getWorkingCopy()).toEqual(mockCriteria1);
			expect(component.getOriginalCopy()).not.toBe(component.getWorkingCopy());

			mockObserver.next.mockClear();
			searchState$.next({
				criteria: mockCriteria2,
				hasBeenSearched: true
			});

			expect(component.getOriginalCopy()).not.toEqual(originalSearchCriteria);
			expect(component.getOriginalCopy()).not.toEqual(mockCriteria1);
			expect(component.getOriginalCopy()).toBe(mockCriteria2);
			expect(component.getWorkingCopy()).toEqual(mockCriteria2);
			expect(component.getOriginalCopy()).not.toBe(component.getWorkingCopy());

			searchState$.complete();
		});
	});

	describe("ngOnDestroy", () => {
		it("should cancel the subscription of the searchState", () => {
			genericSearchService.getSearchState.mockReturnValue(
				createObservableOf<StarkSearchState<SearchCriteria>>(
					{
						criteria: originalSearchCriteria,
						hasBeenSearched: false
					},
					getSearchStateObsTeardown.callback
				)
			);

			component.ngOnInit();
			component.ngOnDestroy();

			expect(getSearchStateObsTeardown.spy).toHaveBeenCalledTimes(1);
		});
	});

	describe("onSearch", () => {
		it("should call performSearch() passing the working copy if the form is valid", () => {
			const formMock: UntypedFormGroup = <any>{
				controls: {},
				invalid: false
			};
			const performSearchSpy = vi.spyOn(component, "performSearch").mockImplementation(() => undefined);

			component.ngOnInit();
			component.onSearch(formMock);

			expect(performSearchSpy).toHaveBeenCalledTimes(1);
			expect(performSearchSpy).toHaveBeenCalledWith(component.getWorkingCopy());
		});

		it("should NOT call performSearch() if the form NOT valid", () => {
			const formMock: UntypedFormGroup = <any>{
				controls: {},
				invalid: true
			};
			const performSearchSpy = vi.spyOn(component, "performSearch");

			component.ngOnInit();
			component.onSearch(formMock);

			expect(performSearchSpy).not.toHaveBeenCalled();
		});
	});

	describe("onNew", () => {
		it("should call the genericSearchService.createNew()", () => {
			component.ngOnInit();
			component.onNew();

			expect(genericSearchService.createNew).toHaveBeenCalledTimes(1);
		});
	});

	describe("onReset", () => {
		it("should call the genericSearchService.resetSearchState() and clear the results$", () => {
			const formMock: UntypedFormGroup = new UntypedFormGroup({});
			component.ngOnInit();
			component.onReset(formMock);

			component.getResults().subscribe(mockObserver.observer);

			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.next).toHaveBeenCalledWith([]);
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();

			expect(genericSearchService.resetSearchState).toHaveBeenCalledTimes(1);
		});
	});

	describe("performSearch", () => {
		it("should call genericSearchService.search() passing the working copy if no searchCriteria defined", () => {
			const expectedResult: MockResource[] = [
				{ uuid: "1", name: "first" },
				{ uuid: "2", name: "second" }
			];
			genericSearchService.search.mockReturnValue(createObservableOf<MockResource[]>(expectedResult, searchObsTeardown.callback));

			component.ngOnInit();
			component.performSearch();

			component.getResults().subscribe(mockObserver.observer);
			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.next).toHaveBeenCalledWith(expectedResult);
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();

			expect(searchObsTeardown.spy).toHaveBeenCalledTimes(1);
			expect(genericSearchService.search).toHaveBeenCalledTimes(1);
			expect(genericSearchService.search).toHaveBeenCalledWith(component.getWorkingCopy());
		});

		it("should call genericSearchService.search() passing the given searchCriteria", () => {
			const expectedResult: MockResource[] = [
				{ uuid: "1", name: "first" },
				{ uuid: "2", name: "second" }
			];
			const customCriteria: SearchCriteria = { uuid: "11" };
			genericSearchService.search.mockReturnValue(createObservableOf<MockResource[]>(expectedResult, searchObsTeardown.callback));

			component.ngOnInit();
			component.performSearch(customCriteria);

			component.getResults().subscribe(mockObserver.observer);
			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.next).toHaveBeenCalledWith(expectedResult);
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();

			expect(searchObsTeardown.spy).toHaveBeenCalledTimes(1);
			expect(genericSearchService.search).toHaveBeenCalledTimes(1);
			expect(genericSearchService.search).toHaveBeenCalledWith(customCriteria);
		});

		it("should call genericSearchService.search() ONLY ONCE if no previous search has been made regardless of searchState changes", () => {
			const searchState$ = new Subject<StarkSearchState<SearchCriteria>>();
			const pristineCriteria: SearchCriteria = { uuid: "" };
			const expectedResult: MockResource[] = [
				{ uuid: "1", name: "first" },
				{ uuid: "2", name: "second" }
			];
			const customCriteria: SearchCriteria = { uuid: "11" };

			genericSearchService.search.mockReturnValue(createObservableOf<MockResource[]>(expectedResult, searchObsTeardown.callback));
			genericSearchService.getSearchState.mockReturnValue(searchState$.asObservable());

			component.ngOnInit();

			searchState$.next({
				criteria: pristineCriteria,
				hasBeenSearched: false
			});

			component.getResults().subscribe(mockObserver.observer);
			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.next).toHaveBeenCalledWith([]);
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();

			expect(genericSearchService.search).not.toHaveBeenCalled();
			mockObserver.next.mockClear();

			component.performSearch(customCriteria);

			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.next).toHaveBeenCalledWith(expectedResult);
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();

			expect(searchObsTeardown.spy).toHaveBeenCalledTimes(1);
			expect(genericSearchService.search).toHaveBeenCalledTimes(1);
			expect(genericSearchService.search).toHaveBeenCalledWith(customCriteria);

			genericSearchService.search.mockClear();

			searchState$.next({
				criteria: customCriteria,
				hasBeenSearched: true
			});

			expect(genericSearchService.search).not.toHaveBeenCalled();
		});

		it("should call progressService show/hide methods passing the progressTopic defined before and after performing the search", () => {
			const expectedResult: MockResource[] = [
				{ uuid: "1", name: "first" },
				{ uuid: "2", name: "second" }
			];
			genericSearchService.search.mockReturnValue(of(expectedResult));

			const dummyTopic = "dummyTopic";
			component.setProgressTopic(dummyTopic);

			component.ngOnInit();
			component.performSearch();

			component.getResults().subscribe(mockObserver.observer);
			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.next).toHaveBeenCalledWith(expectedResult);
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();

			expect(progressService.show).toHaveBeenCalledTimes(1);
			expect(progressService.show).toHaveBeenCalledWith(dummyTopic);
			expect(progressService.hide).toHaveBeenCalledTimes(1);
			expect(progressService.hide).toHaveBeenCalledWith(dummyTopic);
		});

		it("should call progressService show/hide methods passing the progressTopic defined before and after performing a failing search", () => {
			genericSearchService.search.mockReturnValue(throwError(() => "search failed"));

			const dummyTopic = "dummyTopic";
			component.setProgressTopic(dummyTopic);

			component.ngOnInit();
			component.performSearch();

			component.getResults().subscribe();

			expect(progressService.show).toHaveBeenCalledTimes(1);
			expect(progressService.show).toHaveBeenCalledWith(dummyTopic);
			expect(progressService.hide).toHaveBeenCalledTimes(1);
			expect(progressService.hide).toHaveBeenCalledWith(dummyTopic);
		});

		it("should NOT call progressService show/hide methods before and after performing the search in case no progressTopic is defined", () => {
			const expectedResult: MockResource[] = [
				{ uuid: "1", name: "first" },
				{ uuid: "2", name: "second" }
			];
			genericSearchService.search.mockReturnValue(of(expectedResult));

			component.setProgressTopic("");
			component.ngOnInit();
			component.performSearch();

			component.getResults().subscribe(mockObserver.observer);
			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.next).toHaveBeenCalledWith(expectedResult);
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();

			expect(progressService.show).not.toHaveBeenCalled();
			expect(progressService.hide).not.toHaveBeenCalled();
		});
	});

	describe("latestResults", () => {
		it("should return an empty array when no search has been performed yet as long as the preserveLatestResults option is enabled", () => {
			component.enablePreserveLatestResults(true);
			component.ngOnInit();

			expect(component.latestResults).toEqual([]);
		});

		it("should return the results from the latest search that was performed as long as the preserveLatestResults option is enabled", () => {
			const expectedResult: MockResource[] = [
				{ uuid: "1", name: "first" },
				{ uuid: "2", name: "second" }
			];
			genericSearchService.search.mockReturnValue(of(expectedResult));

			component.enablePreserveLatestResults(true);
			component.ngOnInit();
			component.performSearch();

			expect(component.latestResults).toBe(expectedResult);
		});

		it("should return undefined regardless of any search that was performed when the preserveLatestResults option is disabled", () => {
			const expectedResult: MockResource[] = [
				{ uuid: "1", name: "first" },
				{ uuid: "2", name: "second" }
			];
			genericSearchService.search.mockReturnValue(of(expectedResult));

			component.enablePreserveLatestResults(false);
			component.ngOnInit();
			component.performSearch();

			expect(component.latestResults).toBeUndefined();
		});
	});
});

interface MockResource extends StarkResource {
	name?: string;
}

interface SearchCriteria {
	uuid: string;
}

function createObservableOf<T>(value: T, teardown: TeardownLogic): Observable<T> {
	return new Observable((subscriber: Subscriber<T>): TeardownLogic => {
		subscriber.next(value);
		return teardown;
	});
}

function createLoggerMock(): LoggingServiceMock {
	return {
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn()
	};
}

function createProgressIndicatorServiceMock(): ProgressIndicatorServiceMock {
	return {
		show: vi.fn(),
		hide: vi.fn()
	};
}

interface TeardownSpy {
	callback: TeardownLogic;
	spy: ReturnType<typeof vi.fn>;
}

function createObserverSpy<T>(): ObserverSpy<T> {
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

function createTeardownSpy(): TeardownSpy {
	const spy = vi.fn();
	return {
		callback: (): void => {
			spy();
		},
		spy
	};
}

class SearchComponentHelper extends AbstractStarkSearchComponent<MockResource, SearchCriteria> {
	public enablePreserveLatestResults(value: boolean): void {
		this.preserveLatestResults = value;
	}

	public getWorkingCopy(): SearchCriteria {
		return this.workingCopy;
	}

	public getOriginalCopy(): SearchCriteria {
		return this.originalCopy;
	}

	public setWorkingCopy(workingCopy: SearchCriteria): void {
		this.workingCopy = workingCopy;
	}

	public updateOriginalCopy(originalCopy: SearchCriteria): void {
		this.originalCopy = originalCopy;
	}

	public getResults(): Observable<MockResource[]> {
		return this.results$;
	}

	public getProgressTopic(): string {
		return this.progressIndicatorConfig.topic;
	}

	public setProgressTopic(topic: string): void {
		this.progressIndicatorConfig.topic = topic;
	}
}
