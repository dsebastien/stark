import { ChangeDetectorRef, Component, Inject, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { STARK_LOGGING_SERVICE, StarkLoggingService } from "../../logging/services";
import { STARK_ROUTING_SERVICE, StarkRoutingService, StarkRoutingTransitionHook } from "../../routing/services";
import { starkAppExitStateName, starkAppInitStateName } from "../constants";

/**
 * Name of the component
 */
const componentName = "stark-app-container";

/**
 * Component to coordinate the display of the init/exit states when the application starts or ends and hide the application content.
 * For any other state it simply displays the application content hiding any init/exit state.
 */
@Component({
	selector: "stark-app-container",
	standalone: false,
	templateUrl: "./app-container.component.html",
	encapsulation: ViewEncapsulation.None,
	host: {
		class: componentName
	}
})
export class StarkAppContainerComponent implements OnInit, OnDestroy {
	/**
	 * Whether the current routed state belongs to the init/exit shell.
	 */
	public appInitOrExitState = false;

	private removeTransitionHook?: () => void;

	/**
	 * Class constructor
	 * @param logger - The `StarkLoggingService` instance of the application.
	 * @param routingService - The `StarkRoutingService` instance of the application.
	 * @param ngZone - Angular zone used to refresh the view after `ui-router` transitions.
	 * @param changeDetectorRef - Reference to the component change detector.
	 */
	public constructor(
		@Inject(STARK_LOGGING_SERVICE) private logger: StarkLoggingService,
		@Inject(STARK_ROUTING_SERVICE) private routingService: StarkRoutingService,
		private ngZone: NgZone,
		private changeDetectorRef: ChangeDetectorRef
	) {}

	/**
	 * Component lifecycle hook
	 */
	public ngOnInit(): void {
		this.logger.debug(componentName + ": component initialized.");
		this.refreshAppInitOrExitState();

		this.removeTransitionHook = this.routingService.addTransitionHook(StarkRoutingTransitionHook.ON_SUCCESS, {}, () => {
			this.ngZone.run(() => {
				this.refreshAppInitOrExitState();
				this.changeDetectorRef.detectChanges();
			});

			return true;
		});
	}

	/**
	 * Component lifecycle hook
	 */
	public ngOnDestroy(): void {
		this.removeTransitionHook?.();
	}

	/**
	 * Check if the current state is an init or exit state (with "starkAppInit" or "starkAppExit" as parent state name)
	 */
	public isAppInitOrExitState(): boolean {
		const currentStateName = this.routingService.getCurrentStateName() || "";

		// Prefix matching is more robust here than Ui-Router glob matching and keeps the init/exit shell stable
		// across the local Angular 22 validation chain.
		return this.isChildOfState(currentStateName, starkAppInitStateName) || this.isChildOfState(currentStateName, starkAppExitStateName);
	}

	private isChildOfState(currentStateName: string, parentStateName: string): boolean {
		return currentStateName === parentStateName || currentStateName.startsWith(`${parentStateName}.`);
	}

	private refreshAppInitOrExitState(): void {
		this.appInitOrExitState = this.isAppInitOrExitState();
	}
}
