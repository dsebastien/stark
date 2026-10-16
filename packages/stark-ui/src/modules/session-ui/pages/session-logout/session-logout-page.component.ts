import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject, OnInit, ViewEncapsulation } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { TranslateModule } from "@ngx-translate/core";

import { STARK_APP_CONFIG, STARK_LOGGING_SERVICE, StarkApplicationConfig, StarkLoggingService } from "@nationalbankbelgium/stark-core";
import { StarkSessionCardComponent } from "../../components/session-card/session-card.component";

/**
 * @ignore
 */
const componentName = "stark-session-logout-page";

/**
 * Session Logout Page smart component.
 *
 * This page will be shown when the user logs out from the application (i.e. clicking the {@link StarkAppLogoComponent} button).
 * In this page, the user has the ability to reload and log in again into the application by clicking the Login button.
 */
@Component({
	standalone: true,
	selector: "stark-session-logout-page",
	templateUrl: "./session-logout-page.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [CommonModule, MatButtonModule, TranslateModule, StarkSessionCardComponent],
	host: {
		class: componentName
	}
})
export class StarkSessionLogoutPageComponent implements OnInit {
	/**
	 * Class constructor
	 * @param logger - The `StarkLoggingService` instance of the application.
	 * @param appConfig - The application configuration
	 */
	public constructor(
		@Inject(STARK_LOGGING_SERVICE) public logger: StarkLoggingService,
		@Inject(STARK_APP_CONFIG) public appConfig: StarkApplicationConfig
	) {}

	/**
	 * Component lifecycle hook
	 */
	public ngOnInit(): void {
		this.logger.debug(componentName + ": component initialized");
	}

	/**
	 * Open baseUrl page (defined in the appConfig) in the current window.
	 */
	public logon(): void {
		// reload app base URL (stark will redirect to the Login/Preloading page)
		window.open(this.appConfig.baseUrl, "_self");
	}
}
