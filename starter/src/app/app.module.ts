import { APP_INITIALIZER, Inject, NgModule } from "@angular/core";
import { BrowserModule, DomSanitizer } from "@angular/platform-browser";
import { FormsModule } from "@angular/forms";
import { UIRouter, UIRouterModule } from "@uirouter/angular";
import { ActionReducerMap, StoreModule } from "@ngrx/store";
import { StoreDevtoolsModule } from "@ngrx/store-devtools";
import { EffectsModule } from "@ngrx/effects";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { OVERLAY_DEFAULT_CONFIG } from "@angular/cdk/overlay";
import { MatIconModule, MatIconRegistry } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatCardModule } from "@angular/material/card";
import { MatTooltipModule } from "@angular/material/tooltip";
import { DateAdapter } from "@angular/material/core";
import { filter } from "rxjs/operators";

import {
	STARK_APP_CONFIG,
	STARK_APP_METADATA,
	STARK_MOCK_DATA,
	STARK_SESSION_SERVICE,
	STARK_SETTINGS_SERVICE,
	StarkApplicationConfig,
	StarkApplicationConfigImpl,
	StarkApplicationMetadata,
	StarkApplicationMetadataImpl,
	StarkErrorHandlingModule,
	StarkHttpModule,
	StarkLoggingModule,
	StarkMockData,
	StarkRoutingModule,
	StarkSessionModule,
	StarkSessionService,
	StarkSettingsModule,
	StarkSettingsService,
	StarkUser,
	StarkUserModule
} from "@nationalbankbelgium/stark-core";

import {
	StarkAppFooterModule,
	StarkAppLogoModule,
	StarkAppLogoutModule,
	StarkAppMenuModule,
	StarkAppSidebarModule,
	StarkDatePickerModule,
	StarkLanguageSelectorModule,
	StarkSessionUiModule,
	StarkToastNotificationModule
} from "@nationalbankbelgium/stark-ui";
import { HomeModule } from "./home/home.module";
import { logRegisteredStates, routerConfigFn } from "./router.config";
import { registerMaterialIconSet } from "./material-icons.config";
import { Deserialize } from "cerialize";
/*
 * Translations
 */
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { initializeTranslation } from "./translation.config";
/*
 * DEV Authentication
 */
import { getAuthenticationHeaders } from "./authentication.config";
/*
 * Platform and Environment providers/directives/pipes
 */
import { environment } from "environments/environment";
import appConfigJson from "../stark-app-config.json";
import appMetadataJson from "../stark-app-metadata.json";
import mockDataJson from "../../config/json-server/data.json";
import { APP_STATES } from "./app.routes";
// App is our top level component
import { AppComponent } from "./app.component";

// TODO: where to put this factory function?
/* eslint-disable-next-line jsdoc/require-jsdoc */
export function starkAppConfigFactory(): StarkApplicationConfig {
	const applicationConfig: StarkApplicationConfig = Deserialize(appConfigJson, StarkApplicationConfigImpl);

	applicationConfig.rootStateUrl = "/";
	applicationConfig.rootStateName = "";
	applicationConfig.homeStateName = "home";
	applicationConfig.errorStateName = "otherwise";
	applicationConfig.angularDebugInfoEnabled = !environment.production; // DEVELOPMENT;
	applicationConfig.debugLoggingEnabled = !environment.production; // DEVELOPMENT;
	applicationConfig.routerLoggingEnabled = !environment.production; // DEVELOPMENT;

	return applicationConfig;
}

// TODO: where to put this factory function?
/* eslint-disable-next-line jsdoc/require-jsdoc */
export function starkAppMetadataFactory(): StarkApplicationMetadata {
	return Deserialize(appMetadataJson, StarkApplicationMetadataImpl);
}

// TODO: where to put this factory function?
/* eslint-disable-next-line jsdoc/require-jsdoc */
export function starkMockDataFactory(): StarkMockData {
	if (ENV === "development") {
		return mockDataJson;
	}

	return {};
}

/* eslint-disable-next-line jsdoc/require-jsdoc */
export function initRouterLog(router: UIRouter): () => void {
	return (): void => logRegisteredStates(router.stateService.get());
}

// Application Redux State
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Empty application reducer extension point.
export interface State {
	// reducer interfaces
}

export const reducers: ActionReducerMap<State> = {
	// reducers
};

/**
 * `AppModule` is the main entry point into Angular's bootstrapping process
 */
@NgModule({
	bootstrap: [AppComponent],
	declarations: [AppComponent],
	/**
	 * Import Angular's modules.
	 */
	imports: [
		BrowserModule,
		BrowserAnimationsModule,
		FormsModule,
		MatButtonModule,
		MatButtonToggleModule,
		MatCardModule,
		MatIconModule,
		MatTooltipModule,
		StoreModule.forRoot(reducers, {
			runtimeChecks: {
				strictActionImmutability: true,
				strictStateImmutability: true
			}
		}),
		// store dev tools instrumentation must be imported AFTER StoreModule
		StoreDevtoolsModule.instrument({
			maxAge: 50, // retains last 50 states
			name: "Stark Starter - NgRx Store DevTools", // shown in the monitor page
			logOnly: environment.production // restrict extension to log-only mode (setting it to false enables all extension features)
		}),
		EffectsModule.forRoot([]), // needed to set up the providers required for effects
		UIRouterModule.forRoot({
			states: APP_STATES,
			useHash: false, // to use Angular's PathLocationStrategy in order to support HTML5 Push State
			otherwise: "otherwise",
			config: routerConfigFn
		}),
		TranslateModule.forRoot(),
		StarkHttpModule.forRoot(),
		StarkLoggingModule.forRoot(),
		StarkSessionModule.forRoot(),
		StarkSettingsModule.forRoot(),
		StarkRoutingModule.forRoot(),
		StarkUserModule.forRoot(),
		StarkAppFooterModule,
		StarkAppLogoModule,
		StarkAppLogoutModule,
		StarkAppMenuModule,
		StarkAppSidebarModule.forRoot(),
		StarkDatePickerModule,
		StarkErrorHandlingModule.forRoot(),
		StarkLanguageSelectorModule,
		StarkToastNotificationModule.forRoot({
			delay: 5000,
			position: "top right",
			actionClasses: []
		}),
		StarkSessionUiModule.forRoot(),
		HomeModule
	],
	/**
	 * Expose our Services and Providers into Angular's dependency injection.
	 */
	providers: [
		environment.ENV_PROVIDERS,
		{ provide: OVERLAY_DEFAULT_CONFIG, useValue: { usePopover: false } },
		{ provide: STARK_APP_CONFIG, useFactory: starkAppConfigFactory },
		{ provide: STARK_APP_METADATA, useFactory: starkAppMetadataFactory },
		{ provide: STARK_MOCK_DATA, useFactory: starkMockDataFactory },
		...(ENV === "development" ? [{ provide: APP_INITIALIZER, useFactory: initRouterLog, multi: true, deps: [UIRouter] }] : [])
	]
})
export class AppModule {
	public constructor(
		private translateService: TranslateService,
		private dateAdapter: DateAdapter<any>,
		@Inject(STARK_SESSION_SERVICE) private sessionService: StarkSessionService,
		@Inject(STARK_SETTINGS_SERVICE) private settingsService: StarkSettingsService,
		matIconRegistry: MatIconRegistry,
		domSanitizer: DomSanitizer
	) {
		initializeTranslation(this.translateService, this.dateAdapter);
		registerMaterialIconSet(matIconRegistry, domSanitizer);

		this.settingsService.initializeSettings();

		this.sessionService
			.getCurrentUser()
			.pipe(filter((user: StarkUser | undefined): user is StarkUser => user !== undefined))
			.subscribe((user: StarkUser) => {
				const devAuthenticationHeaders: Map<string, string> = getAuthenticationHeaders(user);
				this.sessionService.setDevAuthenticationHeaders(devAuthenticationHeaders);
			});
	}
}
