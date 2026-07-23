import { ActionReducerMap, createFeatureSelector, createSelector } from "@ngrx/store";
import { StarkProgressIndicatorActions } from "../actions";
import { StarkProgressIndicatorConfig } from "../entities/progress-indicator-config.entity.intf";
import { StarkProgressIndicatorType } from "../entities/progress-indicator-type.entity";
import { progressIndicatorReducer } from "./progress-indicator.reducer";
import { starkProgressIndicatorStoreKey } from "../constants";

type ProgressIndicatorStateConfig = StarkProgressIndicatorConfig & {
	visible?: boolean;
	listenersCount?: number;
	pendingListenersCount?: number;
	type: StarkProgressIndicatorType;
};

/**
 * Defines the part of the state assigned to the {@link StarkProgressIndicatorModule}
 */
export interface StarkProgressIndicatorState {
	/**
	 * State corresponding to the {@link StarkProgressIndicatorModule}
	 */
	progressIndicator: Map<string, ProgressIndicatorStateConfig>;
}

/**
 * Reducers assigned to the each property of the {@link StarkProgressIndicatorModule}'s state
 */
export const starkProgressIndicatorReducers: ActionReducerMap<StarkProgressIndicatorState, StarkProgressIndicatorActions.Types> = {
	/**
	 * Reducer assigned to the state's `progressIndicator` property
	 */
	progressIndicator: progressIndicatorReducer
};

/**
 * NGRX Selector for the {@link StarkProgressIndicatorModule}'s state
 */
export const selectStarkProgressIndicator = createSelector(
	createFeatureSelector<StarkProgressIndicatorState>(starkProgressIndicatorStoreKey),
	(state: StarkProgressIndicatorState) => state.progressIndicator
);
