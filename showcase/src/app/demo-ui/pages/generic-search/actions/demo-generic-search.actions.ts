import { createAction, props } from "@ngrx/store";
import { HeroMovieSearchCriteria } from "../entities";
import { demoGenericSearchStoreKey } from "../constants";

export const setCriteria = createAction(`[${demoGenericSearchStoreKey}] Set criteria`, props<{ criteria: HeroMovieSearchCriteria }>());
export const removeCriteria = createAction(`[${demoGenericSearchStoreKey}] Remove criteria`);
export const hasSearched = createAction(`[${demoGenericSearchStoreKey}] Has searched`);
export const hasSearchedReset = createAction(`[${demoGenericSearchStoreKey}] Has searched reset`);

/**
 * @ignore
 */
export type Types =
	| ReturnType<typeof setCriteria>
	| ReturnType<typeof removeCriteria>
	| ReturnType<typeof hasSearched>
	| ReturnType<typeof hasSearchedReset>;
