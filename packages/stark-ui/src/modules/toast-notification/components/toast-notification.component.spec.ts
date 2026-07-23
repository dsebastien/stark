import { Component, ViewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MAT_SNACK_BAR_DATA, MatSnackBar, MatSnackBarRef } from "@angular/material/snack-bar";
import { MatIconTestingModule } from "@angular/material/icon/testing";
import { TranslateModule } from "@ngx-translate/core";
import { STARK_LOGGING_SERVICE } from "@nationalbankbelgium/stark-core";
import { StarkMessageType } from "@nationalbankbelgium/stark-ui/src/common";
import { vi } from "vitest";
import { StarkToastNotificationComponent } from "./toast-notification.component";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
	error: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

type SnackBarRefMock = {
	dismissWithAction: ReturnType<typeof vi.fn<() => void>>;
};

type SnackBarMock = {
	_openedSnackBarRef: MatSnackBarRef<unknown>;
};

@Component({
	standalone: true,
	selector: "host-component",
	imports: [StarkToastNotificationComponent],
	template: ` <stark-toast-notification></stark-toast-notification> `
})
class TestHostComponent {
	@ViewChild(StarkToastNotificationComponent, { static: true })
	public toastNotificationComponent!: StarkToastNotificationComponent;
}

describe("ToastNotificationComponent", () => {
	let component: StarkToastNotificationComponent;
	let hostComponent: TestHostComponent;
	let fixture: ComponentFixture<TestHostComponent>;
	let mockLogger: LoggingServiceMock;
	let mockSnackBarRef: SnackBarRefMock;
	let mockSnackBar: SnackBarMock;

	const mockMatSnackBarConfig = {
		delay: 10,
		actionLabel: "action",
		actionClasses: []
	};

	beforeEach(async () => {
		mockLogger = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>(),
			error: vi.fn<(message: string, ...args: unknown[]) => void>()
		};
		mockSnackBarRef = {
			dismissWithAction: vi.fn<() => void>()
		};
		mockSnackBar = {
			_openedSnackBarRef: mockSnackBarRef as unknown as MatSnackBarRef<unknown>
		};

		await TestBed.configureTestingModule({
			imports: [TranslateModule.forRoot(), MatIconTestingModule, TestHostComponent],
			providers: [
				{ provide: STARK_LOGGING_SERVICE, useValue: mockLogger },
				{ provide: MatSnackBar, useValue: mockSnackBar as unknown as MatSnackBar },
				{ provide: MAT_SNACK_BAR_DATA, useValue: { ...mockMatSnackBarConfig } }
			]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(TestHostComponent);
		hostComponent = fixture.componentInstance;
		fixture.detectChanges();
		component = hostComponent.toastNotificationComponent;
		mockSnackBarRef.dismissWithAction.mockClear();
	});

	describe("on initialization", () => {
		it("should set internal component properties", () => {
			expect(fixture).toBeDefined();
			expect(component).toBeDefined();
			expect(component.logger).not.toBeNull();
			expect(component.logger).toBeDefined();
			expect(component.snackBar).not.toBeNull();
			expect(component.snackBar).toBeDefined();
			expect(component.data).not.toBeNull();
			expect(component.data).toBeDefined();
			expect(component.data.delay).toBe(10);
			expect(component.data.actionLabel).toBe("action");
			expect(component.data.actionClasses).toBeDefined();
			expect(component.data.type).toBeUndefined();
		});
	});

	describe("on closeToast() call", () => {
		it("should call hide service method", () => {
			component.closeToast();
			expect(mockSnackBarRef.dismissWithAction).toHaveBeenCalledTimes(1);
		});
	});

	describe("on getMessageTypeClass() call", () => {
		it("should return the correct class name", () => {
			let cssClass: string = component.getMessageTypeClass();
			expect(cssClass).toBe("");

			component.data.type = StarkMessageType.WARNING;
			cssClass = component.getMessageTypeClass();
			expect(cssClass).toBe("stark-toast-message-warning");

			component.data.type = StarkMessageType.INFO;
			cssClass = component.getMessageTypeClass();
			expect(cssClass).toBe("stark-toast-message-info");

			component.data.type = StarkMessageType.ERROR;
			cssClass = component.getMessageTypeClass();
			expect(cssClass).toBe("stark-toast-message-error");
		});
	});
});
