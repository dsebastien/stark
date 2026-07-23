import { Observable, ReplaySubject, Subject } from "rxjs";
import { TestBed, waitForAsync } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideMockActions } from "@ngrx/effects/testing";
import { EffectNotification } from "@ngrx/effects";
import { MatDialog, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { STARK_SESSION_SERVICE, StarkSessionActions, StarkSessionService } from "@nationalbankbelgium/stark-core";
import { StarkSessionTimeoutWarningDialogComponent } from "../components/session-timeout-warning-dialog/session-timeout-warning-dialog.component";
import { StarkSessionTimeoutWarningDialogEffects } from "../effects";
import { STARK_SESSION_UI_CONFIG, StarkSessionUiConfig } from "../entities";
import { vi } from "vitest";

type ObserverSpy = {
	next: ReturnType<typeof vi.fn<(value: unknown) => void>>;
	error: ReturnType<typeof vi.fn<(error: unknown) => void>>;
	complete: ReturnType<typeof vi.fn<() => void>>;
};

type SessionServiceMock = {
	pauseUserActivityTracking: ReturnType<typeof vi.fn<() => void>>;
	resumeUserActivityTracking: ReturnType<typeof vi.fn<() => void>>;
};

type MatDialogMock = {
	open: ReturnType<
		typeof vi.fn<(component: unknown, config?: unknown) => MatDialogRef<StarkSessionTimeoutWarningDialogComponent, string>>
	>;
	close: ReturnType<typeof vi.fn>;
	closeAll: ReturnType<typeof vi.fn>;
};

const createObserverSpy = (): ObserverSpy => ({
	next: vi.fn<(value: unknown) => void>(),
	error: vi.fn<(error: unknown) => void>(),
	complete: vi.fn<() => void>()
});

const createSessionServiceMock = (): SessionServiceMock => ({
	pauseUserActivityTracking: vi.fn(),
	resumeUserActivityTracking: vi.fn()
});

const createDialogMock = (): MatDialogMock => ({
	open: vi.fn<(component: unknown, config?: unknown) => MatDialogRef<StarkSessionTimeoutWarningDialogComponent, string>>(),
	close: vi.fn(),
	closeAll: vi.fn()
});

describe("Effects: StarkSessionTimeoutWarningDialogEffects", () => {
	let effectsClass: StarkSessionTimeoutWarningDialogEffects;
	let mockSessionService: SessionServiceMock;
	let mockDialogService: MatDialogMock;
	let mockSessionUiConfig: StarkSessionUiConfig;
	let actions: Observable<any>;

	beforeEach(waitForAsync(() => {
		mockSessionService = createSessionServiceMock();
		mockDialogService = createDialogMock();
		mockSessionUiConfig = new StarkSessionUiConfig();

		return TestBed.configureTestingModule({
			imports: [NoopAnimationsModule, MatDialogModule, TranslateModule.forRoot(), MatButtonModule],
			providers: [
				StarkSessionTimeoutWarningDialogEffects,
				provideMockActions(() => actions),
				TranslateService,
				{ provide: MatDialog, useValue: mockDialogService as unknown as MatDialog },
				{ provide: STARK_SESSION_SERVICE, useValue: mockSessionService as unknown as StarkSessionService },
				{ provide: STARK_SESSION_UI_CONFIG, useValue: mockSessionUiConfig }
			]
		}).compileComponents();
	}));

	beforeEach(() => {
		effectsClass = TestBed.inject(StarkSessionTimeoutWarningDialogEffects);
		mockSessionUiConfig = TestBed.inject(STARK_SESSION_UI_CONFIG);
	});

	describe("on initialization", () => {
		it("should set internal component properties", () => {
			expect(effectsClass.sessionService).not.toBeNull();
			expect(effectsClass.sessionService).toBeDefined();
			expect(effectsClass.starkSessionUiConfig).not.toBeNull();
			expect(effectsClass.starkSessionUiConfig).toBeDefined();
		});
	});

	describe("on StarkSessionTimeoutWarning$", () => {
		it("should open a dialog when the timeout countdown begins", () => {
			const afterClosedResult = "keep-logged";
			const afterClosed$: Subject<string> = new Subject();

			mockDialogService.open.mockReturnValue({
				afterClosed: (): Subject<string> => afterClosed$
			} as unknown as MatDialogRef<StarkSessionTimeoutWarningDialogComponent, string>);

			const mockObserver: ObserverSpy = createObserverSpy();
			const subject: ReplaySubject<any> = new ReplaySubject(1);
			actions = subject.asObservable();

			effectsClass.starkSessionTimeoutWarning$.subscribe({
				next: mockObserver.next,
				error: mockObserver.error,
				complete: mockObserver.complete
			});

			expect(mockSessionService.pauseUserActivityTracking).not.toHaveBeenCalled();
			expect(mockDialogService.open).not.toHaveBeenCalled();

			subject.next(StarkSessionActions.sessionTimeoutCountdownStart({ countdown: 20 }));

			expect(mockSessionService.pauseUserActivityTracking).toHaveBeenCalled();
			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();
			expect(mockDialogService.open).toHaveBeenCalledTimes(1);
			expect(mockDialogService.open).toHaveBeenCalledWith(StarkSessionTimeoutWarningDialogComponent, {
				data: 20,
				disableClose: true
			});

			expect(mockSessionService.resumeUserActivityTracking).not.toHaveBeenCalled();

			afterClosed$.next(afterClosedResult);

			expect(mockSessionService.resumeUserActivityTracking).toHaveBeenCalledTimes(1);
		});
	});

	describe("on StarkSessionTimeoutWarningClose$", () => {
		it("should close the dialog when the countdown finishes", () => {
			const mockObserver: ObserverSpy = createObserverSpy();

			const subject: ReplaySubject<any> = new ReplaySubject(1);
			actions = subject.asObservable();

			effectsClass.starkSessionTimeoutWarningClose$.subscribe({
				next: mockObserver.next,
				error: mockObserver.error,
				complete: mockObserver.complete
			});

			expect(mockDialogService.closeAll).not.toHaveBeenCalled();

			subject.next(StarkSessionActions.sessionTimeoutCountdownFinish());

			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();
			expect(mockDialogService.closeAll).toHaveBeenCalledTimes(1);
		});
	});

	describe("on ngrxOnRunEffects", () => {
		it("should stop the effects immediately when the option timeoutWarningDialogDisabled is true", () => {
			const mockObserver: ObserverSpy = createObserverSpy();

			const actions$: ReplaySubject<any> = new ReplaySubject(1);
			actions = actions$.asObservable();
			const pipeSpy = vi.spyOn(effectsClass.actions$, "pipe");

			mockSessionUiConfig.timeoutWarningDialogDisabled = true;

			const mockResolvedEffectsSubject: Subject<any> = new Subject<any>();
			const mockResolvedEffects$: Observable<any> = mockResolvedEffectsSubject.asObservable();

			const resolvedEffectsObservable: Observable<EffectNotification> = effectsClass.ngrxOnRunEffects(mockResolvedEffects$);
			expect(pipeSpy).toHaveBeenCalledTimes(1);

			resolvedEffectsObservable.subscribe({
				next: mockObserver.next,
				error: mockObserver.error,
				complete: mockObserver.complete
			});

			mockObserver.next.mockClear();

			actions$.next("dummy acton");
			actions$.next("another dummy acton");

			actions$.next(StarkSessionActions.initializeSession({ user: <any>{} }));
			mockResolvedEffectsSubject.next("this should never be emitted");

			expect(mockObserver.next).not.toHaveBeenCalled();
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();
		});

		it("should run the effects immediately when the option timeoutWarningDialogDisabled is false", () => {
			const mockObserver: ObserverSpy = createObserverSpy();

			const actions$: ReplaySubject<any> = new ReplaySubject(1);
			actions = actions$.asObservable();
			const pipeSpy = vi.spyOn(effectsClass.actions$, "pipe");

			mockSessionUiConfig.timeoutWarningDialogDisabled = false;

			const mockResolvedEffectsSubject: Subject<any> = new Subject<any>();
			const mockResolvedEffects$: Observable<any> = mockResolvedEffectsSubject.asObservable();

			const resolvedEffectsObservable: Observable<EffectNotification> = effectsClass.ngrxOnRunEffects(mockResolvedEffects$);
			expect(pipeSpy).toHaveBeenCalledTimes(1);

			resolvedEffectsObservable.subscribe({
				next: mockObserver.next,
				error: mockObserver.error,
				complete: mockObserver.complete
			});

			actions$.next("dummy initial action1");
			mockResolvedEffectsSubject.next("dummy resolved effect");

			expect(mockObserver.next).toHaveBeenCalled();
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();

			mockObserver.next.mockClear();

			// the effects should keep on running with any action
			actions$.next("dummy action1");
			mockResolvedEffectsSubject.next("another dummy resolved effect");

			expect(mockObserver.next).toHaveBeenCalled();
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();
		});

		it("should run the effects immediately when the option timeoutWarningDialogDisabled is undefined", () => {
			const mockObserver: ObserverSpy = createObserverSpy();

			const actions$: ReplaySubject<any> = new ReplaySubject(1);
			actions = actions$.asObservable();
			const pipeSpy = vi.spyOn(effectsClass.actions$, "pipe");

			mockSessionUiConfig.timeoutWarningDialogDisabled = undefined;

			const mockResolvedEffectsSubject: Subject<any> = new Subject<any>();
			const mockResolvedEffects$: Observable<any> = mockResolvedEffectsSubject.asObservable();

			const resolvedEffectsObservable: Observable<EffectNotification> = effectsClass.ngrxOnRunEffects(mockResolvedEffects$);
			expect(pipeSpy).toHaveBeenCalledTimes(1);

			resolvedEffectsObservable.subscribe({
				next: mockObserver.next,
				error: mockObserver.error,
				complete: mockObserver.complete
			});

			actions$.next("dummy initial action1");
			mockResolvedEffectsSubject.next("dummy resolved effect");

			expect(mockObserver.next).toHaveBeenCalled();
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();

			mockObserver.next.mockClear();

			// the effects should keep on running with any action
			actions$.next("dummy action1");
			mockResolvedEffectsSubject.next("another dummy resolved effect");

			expect(mockObserver.next).toHaveBeenCalled();
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled();
		});
	});
});
