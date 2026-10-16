import { vi } from "vitest";
import { StarkAppSidebarServiceImpl } from "./app-sidebar.service";
import { StarkAppSidebarOpenEvent } from "./app-sidebar-open-event.intf";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn<(message: string, ...args: unknown[]) => void>>;
};

describe("AppSidebarService", () => {
	let service: StarkAppSidebarServiceImpl;

	beforeEach(() => {
		const mockLogger: LoggingServiceMock = {
			debug: vi.fn<(message: string, ...args: unknown[]) => void>()
		};
		service = new StarkAppSidebarServiceImpl(mockLogger as any);
	});

	it("openMenu() should raise the correct event", () => {
		service.openSidebar$.subscribe((event: StarkAppSidebarOpenEvent) => {
			expect(event).toEqual({ type: "menu", sidebar: "left" });
		});
		service.openMenu();
	});

	it("openLeft() should raise the correct event", () => {
		service.openSidebar$.subscribe((event: StarkAppSidebarOpenEvent) => {
			expect(event).toEqual({ type: "regular", sidebar: "left" });
		});
		service.openLeft();
	});

	it("openRight() should raise the correct event", () => {
		service.openSidebar$.subscribe((event: StarkAppSidebarOpenEvent) => {
			expect(event).toEqual({ sidebar: "right" });
		});
		service.openRight();
	});

	it("close() should raise an event", () => {
		const closeSidebars = vi.fn<() => void>();
		service.closeSidebar$.subscribe(() => {
			closeSidebars();
		});
		service.close();
		expect(closeSidebars).toHaveBeenCalledTimes(1);
	});

	it("toggleMenu() should raise the correct event", () => {
		service.toggleSidebar$.subscribe((event: StarkAppSidebarOpenEvent) => {
			expect(event).toEqual({ type: "menu", sidebar: "left" });
		});
		service.toggleMenu();
	});
});
