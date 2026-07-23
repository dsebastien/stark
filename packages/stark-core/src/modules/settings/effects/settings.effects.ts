import { Inject, Injectable } from "@angular/core";
import { Actions, createEffect, CreateEffectMetadata, ofType } from "@ngrx/effects";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

import { StarkSettingsActions } from "../actions";
import { STARK_SESSION_SERVICE, StarkSessionService } from "../../session/services";

/**
 * Effects definition to modify the session's settings.
 */
@Injectable()
export class StarkSettingsEffects {
	/**
	 * Class constructor
	 * @param actions$ - The action stream.
	 * @param sessionService - The `StarkSessionService` instance of the application.
	 */
	public constructor(
		private actions$: Actions,
		@Inject(STARK_SESSION_SERVICE) private sessionService: StarkSessionService
	) {
		this.setPreferredLanguage$ = createEffect(
			() =>
				this.actions$.pipe(
					ofType(StarkSettingsActions.setPreferredLanguage),
					map((action) => this.sessionService.setCurrentLanguage(action.language))
				),
			{ dispatch: false }
		);
	}

	/**
	 * Sets the language of the current session via the `StarkSessionService` whenever the preferred language changes in the settings.
	 *
	 * `dispatch: false` => because this effect does not dispatch an action
	 */
	public setPreferredLanguage$: Observable<void> & CreateEffectMetadata;
}
