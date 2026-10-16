import { ApplicationRef } from "@angular/core";
import { MatSnackBar, MatSnackBarConfig, MatSnackBarDismiss, MatSnackBarRef } from "@angular/material/snack-bar";
import { StarkMessageType } from "@nationalbankbelgium/stark-ui/src/common";
import { Observable, Observer } from "rxjs";
import { vi } from "vitest";
import { StarkToastMessage, StarkToastNotificationComponent } from "../components";
import { StarkToastNotificationResult } from "./toast-notification-result.intf";
import { StarkToastNotificationServiceImpl } from "./toast-notification.service";

type MatSnackBarRefMock = {
	afterDismissed: ReturnType<typeof vi.fn<() => Observable<MatSnackBarDismiss>>>;
	dismissWithAction: ReturnType<typeof vi.fn<() => void>>;
	dismiss: ReturnType<typeof vi.fn<() => void>>;
};

type MatSnackBarMock = {
	openFromComponent: ReturnType<
		typeof vi.fn<
			(
				component: typeof StarkToastNotificationComponent,
				config: MatSnackBarConfig
			) => MatSnackBarRef<StarkToastNotificationComponent>
		>
	>;
	dismiss: ReturnType<typeof vi.fn<() => void>>;
};

type ApplicationRefMock = {
	tick: ReturnType<typeof vi.fn<() => void>>;
};

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

describe("ToastNotificationService", () => {
	const message: StarkToastMessage = {
		key: "testMessage",
		id: "1",
		code: "abc",
		type: StarkMessageType.ERROR,
		actionLabel: "testAction",
		delay: 4321
	};

	let service: StarkToastNotificationServiceImpl;
	let mockLogger: LoggingServiceMock;
	let snackBarDismissObserver!: Observer<MatSnackBarDismiss>;
	let mockApplicationRef: ApplicationRefMock;
	let mockSnackBar: MatSnackBarMock;
	let mockSnackBarRef: MatSnackBarRefMock;

	beforeEach(() => {
		const afterDismissedObs = new Observable<MatSnackBarDismiss>((observer: Observer<MatSnackBarDismiss>): void => {
			snackBarDismissObserver = observer;
		});

		mockLogger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};
		mockSnackBarRef = {
			afterDismissed: vi.fn(() => afterDismissedObs),
			dismissWithAction: vi.fn(),
			dismiss: vi.fn()
		};
		mockSnackBar = {
			openFromComponent: vi.fn(() => mockSnackBarRef as unknown as MatSnackBarRef<StarkToastNotificationComponent>),
			dismiss: vi.fn()
		};
		mockApplicationRef = {
			tick: vi.fn()
		};

		service = new StarkToastNotificationServiceImpl(
			mockSnackBar as unknown as MatSnackBar,
			mockLogger as any,
			mockApplicationRef as unknown as ApplicationRef,
			{
				delay: 3000,
				position: "top right",
				actionClasses: []
			}
		);
	});

	describe("on initialization", () => {
		it("should set internal component properties", () => {
			expect(service.snackBar).not.toBeNull();
			expect(service.snackBar).toBeDefined();
			expect(service.logger).not.toBeNull();
			expect(service.logger).toBeDefined();
		});
	});

	describe("on getConfig", () => {
		it("should return default configuration", () => {
			const conf: MatSnackBarConfig = service.getConfig(message);
			expect(conf).not.toBeNull();
			expect(conf).toBeDefined();

			expect(conf.data).not.toBeNull();
			expect(conf.data).toBeDefined();
			expect(conf.data).toBe(message);

			expect(conf.duration).not.toBeNull();
			expect(conf.duration).toBeDefined();
			expect(conf.duration).toBe(4321);

			expect(conf.horizontalPosition).not.toBeNull();
			expect(conf.horizontalPosition).toBeDefined();
			expect(conf.horizontalPosition).toBe("right");

			expect(conf.verticalPosition).not.toBeNull();
			expect(conf.verticalPosition).toBeDefined();
			expect(conf.verticalPosition).toBe("top");

			expect(conf.panelClass).toBe("stark-toast-notification-panel");
		});
	});

	describe("on show", () => {
		it("should display the snack bar", () => {
			const firstResults: StarkToastNotificationResult[] = [];
			const secondResults: StarkToastNotificationResult[] = [];
			let showObs: Observable<StarkToastNotificationResult> = service.show(message);
			expect(showObs).not.toBeNull();
			expect(showObs).toBeDefined();

			expect(mockSnackBar.openFromComponent).toHaveBeenCalledTimes(0);
			expect((service as any).currentToastResult$).not.toBeDefined();

			showObs.subscribe((ret: StarkToastNotificationResult) => {
				firstResults.push(ret);
			});

			expect(mockSnackBar.openFromComponent).toHaveBeenCalledTimes(1);
			expect((service as any).currentToastResult$).not.toBeNull();
			expect((service as any).currentToastResult$).toBeDefined();

			showObs = service.show(message);

			expect(firstResults).toEqual([StarkToastNotificationResult.CLOSED_BY_NEW_TOAST]);
			expect(showObs).not.toBeNull();
			expect(showObs).toBeDefined();
			expect((service as any).currentToastResult$).not.toBeDefined();
			expect(mockSnackBar.openFromComponent).toHaveBeenCalledTimes(1);

			showObs.subscribe((ret: StarkToastNotificationResult) => {
				secondResults.push(ret);
			});

			expect(mockSnackBar.openFromComponent).toHaveBeenCalledTimes(2);
			expect((service as any).currentToastResult$).not.toBeNull();
			expect((service as any).currentToastResult$).toBeDefined();

			snackBarDismissObserver.next({ dismissedByAction: false });

			expect(secondResults).toEqual([StarkToastNotificationResult.CLOSED_ON_DELAY_TIMEOUT]);
			expect(mockApplicationRef.tick).toHaveBeenCalledTimes(1);
			expect((service as any).currentToastResult$).not.toBeDefined();
		});
	});

	describe("on hide", () => {
		it("should hide the snackbar", () => {
			const results: StarkToastNotificationResult[] = [];

			service.show(message).subscribe((ret: StarkToastNotificationResult) => {
				results.push(ret);
			});

			const privateObserver: Observer<StarkToastNotificationResult> = (service as any).currentToastResult$;
			const completeSpy = vi.spyOn(privateObserver, "complete");

			expect(completeSpy).not.toHaveBeenCalled();

			service.hide();

			expect(results).toEqual([StarkToastNotificationResult.HIDDEN]);
			expect(mockSnackBarRef.dismiss).toHaveBeenCalledTimes(1);
			expect(completeSpy).toHaveBeenCalled();
			expect((service as any).currentToastResult$).not.toBeDefined();

			snackBarDismissObserver.next({ dismissedByAction: true });

			expect(results).toEqual([StarkToastNotificationResult.HIDDEN]);
			expect(completeSpy).toHaveBeenCalled();
		});
	});
});
