import { CommonModule } from "@angular/common";
import {
	AfterViewInit,
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	EventEmitter,
	forwardRef,
	Inject,
	Input,
	OnDestroy,
	OnInit,
	Output,
	Renderer2,
	ViewChild,
	ViewEncapsulation
} from "@angular/core";
import { MatExpansionModule, MatExpansionPanel } from "@angular/material/expansion";
import { MatIconModule } from "@angular/material/icon";
import { MatListModule } from "@angular/material/list";
import { TranslateModule } from "@ngx-translate/core";
import {
	STARK_LOGGING_SERVICE,
	STARK_ROUTING_SERVICE,
	StarkLoggingService,
	StarkRoutingService,
	StarkRoutingTransitionHook
} from "@nationalbankbelgium/stark-core";
import { AbstractStarkUiComponent } from "@nationalbankbelgium/stark-ui/src/internal-common";
import { StarkMenuGroup } from "./app-menu-group.intf";

/**
 * @ignore
 */
const componentName = "stark-app-menu-item";

/**
 *
 * Default value for MenuGroup
 */
const DEFAULT_MENU_GROUP: StarkMenuGroup = {
	id: "",
	label: "",
	isVisible: false,
	isEnabled: false
};

/**
 * Component to display app-menu-item based on the options passed as parameters.
 */
@Component({
	standalone: true,
	selector: "stark-app-menu-item",
	templateUrl: "./app-menu-item.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [CommonModule, MatExpansionModule, MatIconModule, MatListModule, TranslateModule, forwardRef(() => StarkAppMenuItemComponent)],
	// We need to use host instead of @HostBinding: https://github.com/NationalBankBelgium/stark/issues/664
	host: {
		class: componentName
	}
})
export class StarkAppMenuItemComponent extends AbstractStarkUiComponent implements OnInit, AfterViewInit, OnDestroy {
	/**
	 * Current menu level
	 */
	@Input()
	public level = 0;

	/**
	 * Data source of the component
	 */
	@Input()
	public menuGroup: StarkMenuGroup = DEFAULT_MENU_GROUP;

	/**
	 * Event to emit when the component is activated
	 */
	@Output()
	public readonly activated = new EventEmitter<void>();

	/**
	 * Event to emit when the component is deactivated
	 */
	@Output()
	public readonly deactivated = new EventEmitter<void>();

	/**
	 * ViewChild catching the extension panel in order to open/close it programmatically
	 */
	@ViewChild("menuGroupsPanel", { static: false })
	public menuGroupsPanel!: MatExpansionPanel;

	/**
	 * Active status of the component
	 */
	private _isActive = false;

	public set isActive(isActive: boolean) {
		this._isActive = isActive;
		if (isActive && this.menuGroup.entries) {
			this.menuGroupsPanel.open();
		}

		if (isActive) {
			this.cdRef.detectChanges(); // needed due to ChangeDetectionStrategy.OnPush in order to refresh the CSS classes
			this.activated.emit();
		} else {
			this.cdRef.detectChanges(); // needed due to ChangeDetectionStrategy.OnPush in order to refresh the CSS classes
			this.deactivated.emit();
		}
	}

	public get isActive(): boolean {
		return this._isActive;
	}

	/**
	 * Routing transition finish callback
	 */
	private routingTransitionFinishCallback?: VoidFunction;

	/**
	 * Routing transition success callback
	 */
	private routingTransitionSuccessCallback?: VoidFunction;

	/**
	 * Class constructor
	 * @param logger - The `StarkLoggingService` instance of the application.
	 * @param routingService - The `StarkRoutingService` instance of the application.
	 * @param renderer - Angular `Renderer2` wrapper for DOM manipulations.
	 * @param elementRef - Reference to the DOM element where this component is attached to.
	 * @param cdRef - Reference to the change detector attached to this component.
	 */
	public constructor(
		@Inject(STARK_LOGGING_SERVICE) public logger: StarkLoggingService,
		@Inject(STARK_ROUTING_SERVICE) public routingService: StarkRoutingService,
		renderer: Renderer2,
		elementRef: ElementRef,
		protected cdRef: ChangeDetectorRef
	) {
		super(renderer, elementRef);
	}

	/**
	 * Component OnInit lifecycle hook
	 */
	public override ngOnInit(): void {
		super.ngOnInit();
		this.logger.debug(componentName + ": component initialized");
	}

	/**
	 * Component AfterViewInit lifecycle hook
	 */
	public ngAfterViewInit(): void {
		this.routingTransitionSuccessCallback = this.routingService.addTransitionHook(StarkRoutingTransitionHook.ON_SUCCESS, {}, () => {
			if (this.isCurrentState()) {
				this.isActive = true;
			}
		});

		this.routingTransitionFinishCallback = this.routingService.addTransitionHook(StarkRoutingTransitionHook.ON_FINISH, {}, () => {
			this.isActive = false;
		});
	}

	/**
	 * Component OnDestroy lifecycle hook
	 */
	public ngOnDestroy(): void {
		if (this.routingTransitionFinishCallback) {
			this.routingTransitionFinishCallback();
		}
		if (this.routingTransitionSuccessCallback) {
			this.routingTransitionSuccessCallback();
		}
	}

	/**
	 * Click event handler
	 */
	public onClick(): void {
		if (this.menuGroup.isEnabled) {
			if (this.menuGroup.targetState) {
				this.routingService.navigateTo(this.menuGroup.targetState, this.menuGroup.targetStateParams);
			} else if (this.menuGroup.entries) {
				this.menuGroupsPanel.toggle();
			}
		}
	}

	/**
	 * Activate event handler
	 */
	public onActivate(): void {
		this.isActive = true;
	}

	/**
	 * Deactivate event handler
	 */
	public onDeactivate(): void {
		this.isActive = false;
	}

	/**
	 * Utility function to check if the component targetState is the current state
	 */
	public isCurrentState(): boolean {
		if (!this.menuGroup.entries) {
			return this.menuGroup.targetState ? this.routingService.isCurrentUiStateIncludedIn(this.menuGroup.targetState) : false;
		}
		return this.menuGroup.targetState ? this.routingService.isCurrentUiState(this.menuGroup.targetState) : false;
	}

	/**
	 * @ignore
	 */
	public trackMenuItem(index: number, _menuGroup: StarkMenuGroup): number {
		return index;
	}
}
