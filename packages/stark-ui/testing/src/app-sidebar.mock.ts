import { StarkAppSidebarOpenEvent, StarkAppSidebarService } from "@nationalbankbelgium/stark-ui";
import { Subject } from "rxjs";
import { vi } from "vitest";

/**
 * Mock class of the {@link StarkAppSidebarService} interface.
 */
export class MockStarkAppSidebarService {
	/**
	 * See [StarkAppSidebarService closeSidebar$]{@link StarkAppSidebarService#closeSidebar$} property
	 */
	public closeSidebar$: Subject<void> = new Subject<void>();

	/**
	 * See [StarkAppSidebarService openSidebar$]{@link StarkAppSidebarService#openSidebar$} property
	 */
	public openSidebar$: Subject<StarkAppSidebarOpenEvent> = new Subject<StarkAppSidebarOpenEvent>();

	/**
	 * See [StarkAppSidebarService toggleSidebar$]{@link StarkAppSidebarService#toggleSidebar$} property
	 */
	public toggleSidebar$: Subject<StarkAppSidebarOpenEvent> = new Subject<StarkAppSidebarOpenEvent>();

	/**
	 * See [StarkAppSidebarService close()]{@link StarkAppSidebarService#close} method
	 */
	public close = vi.fn<StarkAppSidebarService["close"]>();

	/**
	 * See [StarkAppSidebarService openMenu()]{@link StarkAppSidebarService#openMenu} method
	 */
	public openMenu = vi.fn<StarkAppSidebarService["openMenu"]>();

	/**
	 * See [StarkAppSidebarService openLeft()]{@link StarkAppSidebarService#openLeft} method
	 */
	public openLeft = vi.fn<StarkAppSidebarService["openLeft"]>();

	/**
	 * See [StarkAppSidebarService openRight()]{@link StarkAppSidebarService#openRight} method
	 */
	public openRight = vi.fn<StarkAppSidebarService["openRight"]>();

	/**
	 * See [StarkAppSidebarService toggleMenu()]{@link StarkAppSidebarService#toggleMenu} method
	 */
	public toggleMenu = vi.fn<StarkAppSidebarService["toggleMenu"]>();
}
