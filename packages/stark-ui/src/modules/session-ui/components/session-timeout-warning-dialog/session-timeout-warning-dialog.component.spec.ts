/* eslint-disable @angular-eslint/no-lifecycle-call */
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { STARK_LOGGING_SERVICE, type StarkLoggingService } from "@nationalbankbelgium/stark-core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { TranslateModule } from "@ngx-translate/core";
import { StarkSessionTimeoutWarningDialogComponent } from "./session-timeout-warning-dialog.component";
import { Observer } from "rxjs";
import { vi } from "vitest";

type ObserverSpy<T> = Observer<T> & {
	next: ReturnType<typeof vi.fn<(value: T) => void>>;
	error: ReturnType<typeof vi.fn<(err: unknown) => void>>;
	complete: ReturnType<typeof vi.fn<() => void>>;
};

type DialogRefMock = {
	close: ReturnType<typeof vi.fn<(result: string) => void>>;
};

type LoggingServiceMock = Pick<StarkLoggingService, "debug"> & {
	debug: ReturnType<typeof vi.fn<(message: string) => void>>;
};

function createObserverSpy<T>(): ObserverSpy<T> {
	return {
		next: vi.fn<(value: T) => void>(),
		error: vi.fn<(err: unknown) => void>(),
		complete: vi.fn<() => void>()
	};
}

function createDialogRefMock(): DialogRefMock {
	return {
		close: vi.fn<(result: string) => void>()
	};
}

function createLoggingServiceMock(): LoggingServiceMock {
	return {
		debug: vi.fn<(message: string) => void>()
	};
}

describe("SessionTimeoutWarningDialogComponent", () => {
	let component: StarkSessionTimeoutWarningDialogComponent;
	let fixture: ComponentFixture<StarkSessionTimeoutWarningDialogComponent>;
	let mockDialogRef: DialogRefMock;
	let mockLogger: LoggingServiceMock;

	beforeEach(waitForAsync(() => {
		mockDialogRef = createDialogRefMock();
		mockLogger = createLoggingServiceMock();

		return TestBed.configureTestingModule({
			imports: [TranslateModule.forRoot(), StarkSessionTimeoutWarningDialogComponent],
			providers: [
				{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger as unknown as StarkLoggingService },
				{ provide: MAT_DIALOG_DATA, useValue: 20 },
				{
					provide: MatDialogRef,
					useValue: mockDialogRef as unknown as MatDialogRef<StarkSessionTimeoutWarningDialogComponent, string>
				}
			]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(StarkSessionTimeoutWarningDialogComponent);
		component = fixture.componentInstance;
		mockLogger.debug.mockClear();
	});

	describe("ngOnInit", () => {
		it("should set the countdown and decrement it every second", () => {
			const mockObserver = createObserverSpy<number>();

			vi.useFakeTimers();

			try {
				component.ngOnInit();
				component.countdown$.subscribe({
					next: mockObserver.next,
					error: mockObserver.error,
					complete: mockObserver.complete
				});

				expect(mockLogger.debug).toHaveBeenCalledTimes(1);

				vi.advanceTimersByTime(20000);

				expect(mockObserver.next).toHaveBeenCalledTimes(21);
				expect(mockObserver.error).not.toHaveBeenCalled();
				expect(mockObserver.complete).toHaveBeenCalledTimes(1);

				expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
				expect(mockDialogRef.close).toHaveBeenCalledWith("countdown-finished");
			} finally {
				vi.useRealTimers();
			}
		});
	});

	describe("keepSession", () => {
		it("should close the windows when the button is clicked", () => {
			component.keepSession();

			expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
			expect(mockDialogRef.close).toHaveBeenCalledWith("keep-logged");
		});
	});
});
