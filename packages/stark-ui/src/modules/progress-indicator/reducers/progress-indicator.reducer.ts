import { StarkProgressIndicatorActions } from "../actions";
import { StarkProgressIndicatorConfig } from "../entities/progress-indicator-config.entity.intf";
import { StarkProgressIndicatorType } from "../entities/progress-indicator-type.entity";
import cloneDeep from "lodash-es/cloneDeep";
import { createReducer, on } from "@ngrx/store";

type ProgressIndicatorStateConfig = StarkProgressIndicatorConfig & {
	visible?: boolean;
	listenersCount?: number;
	pendingListenersCount?: number;
	type: StarkProgressIndicatorType;
};

/**
 * Initial state of the reducer
 */
const INITIAL_PROGRESS_INDICATOR_STATE: Map<string, ProgressIndicatorStateConfig> = new Map<string, ProgressIndicatorStateConfig>();

/**
 * Definition of the reducer using `createReducer` method.
 */
const reducer = createReducer<Map<string, ProgressIndicatorStateConfig>, StarkProgressIndicatorActions.Types>(
	INITIAL_PROGRESS_INDICATOR_STATE,
	// on(StarkProgressIndicatorActions.register || StarkProgressIndicatorActions.deregister || StarkProgressIndicatorActions.show || StarkProgressIndicatorActions.hide, (state) => cloneDeep(state)),
	on(StarkProgressIndicatorActions.register, (_state, action) => {
		// the new state will be calculated from the data coming in the actions
		let state = cloneDeep(_state);
		const topic = action.progressIndicatorConfig.topic;

		if (state.has(topic)) {
			const progressIndicatorConfig = cloneDeep(<ProgressIndicatorStateConfig>state.get(topic));
			progressIndicatorConfig.listenersCount = <number>progressIndicatorConfig.listenersCount + 1;
			state = state.set(topic, progressIndicatorConfig);
		} else {
			state = state.set(topic, action.progressIndicatorConfig);
		}

		return state;
	}),
	on(StarkProgressIndicatorActions.deregister, (_state, action) => {
		// the new state will be calculated from the data coming in the actions
		let state = cloneDeep(_state);
		const topic = action.topic;

		if (state.has(topic)) {
			const progressIndicatorConfig = cloneDeep(<ProgressIndicatorStateConfig>state.get(topic));
			progressIndicatorConfig.listenersCount = <number>progressIndicatorConfig.listenersCount - 1;

			if (progressIndicatorConfig.listenersCount === 0) {
				state.delete(topic);
			} else {
				state = state.set(topic, progressIndicatorConfig);
			}
		}

		return state;
	}),
	on(StarkProgressIndicatorActions.show, (_state, action) => {
		// the new state will be calculated from the data coming in the actions
		let state = cloneDeep(_state);
		const topic = action.topic;

		if (state.has(topic)) {
			const progressIndicatorConfig = cloneDeep(<ProgressIndicatorStateConfig>state.get(topic));
			progressIndicatorConfig.visible = true;
			progressIndicatorConfig.pendingListenersCount = <number>progressIndicatorConfig.pendingListenersCount + 1;
			state = state.set(topic, progressIndicatorConfig);
		}

		return state;
	}),
	on(StarkProgressIndicatorActions.hide, (_state, action) => {
		// the new state will be calculated from the data coming in the actions
		let state = cloneDeep(_state);
		const topic = action.topic;

		if (state.has(topic)) {
			const progressIndicatorConfig = cloneDeep(<ProgressIndicatorStateConfig>state.get(topic));

			if (<number>progressIndicatorConfig.pendingListenersCount > 0) {
				progressIndicatorConfig.pendingListenersCount = <number>progressIndicatorConfig.pendingListenersCount - 1;
			}

			if (<number>progressIndicatorConfig.pendingListenersCount === 0) {
				progressIndicatorConfig.visible = false;
			}

			state = state.set(topic, progressIndicatorConfig);
		}

		return state;
	})
);

/**
 * Reducer for the progress indicator
 * @param state - Map<string, ProgressIndicatorStateConfig> the actual state of the progress indicator
 * @param action - StarkProgressIndicatorActions the action to perform
 * @returns Map<string, ProgressIndicatorStateConfig> the new state of the progress indicator
 */
export function progressIndicatorReducer(
	state: Map<string, ProgressIndicatorStateConfig> | undefined,
	action: StarkProgressIndicatorActions.Types
): Map<string, ProgressIndicatorStateConfig> {
	return reducer(state, action);
}
