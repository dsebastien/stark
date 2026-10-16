import { createAction, props } from "@ngrx/store";
import { StarkProgressIndicatorConfig } from "../entities/progress-indicator-config.entity.intf";
import { starkProgressIndicatorStoreKey } from "../constants";

type ProgressIndicatorActionConfig = StarkProgressIndicatorConfig & {
	visible?: boolean;
	listenersCount?: number;
	pendingListenersCount?: number;
};

/**
 * Triggered by the {@link StarkProgressIndicatorService} register() method.
 *
 * Parameter:
 *   - progressIndicatorConfig - Configuration of the indicator
 */
export const register = createAction(
	`[${starkProgressIndicatorStoreKey}] Register`,
	props<{ progressIndicatorConfig: ProgressIndicatorActionConfig }>()
);

/**
 * Triggered by the {@link StarkProgressIndicatorService} deregister() method.
 *
 * Parameter:
 *   - topic - The topic of the indicator
 */
export const deregister = createAction(`[${starkProgressIndicatorStoreKey}] Deregister`, props<{ topic: string }>());

/**
 * Triggered by the {@link StarkProgressIndicatorService} hide() method.
 *
 * Parameter:
 *   - topic - The topic of the indicator
 */
export const hide = createAction(`[${starkProgressIndicatorStoreKey}] Hide`, props<{ topic: string }>());

/**
 * Triggered by the {@link StarkProgressIndicatorService} show() method.
 *
 * Parameter:
 *   - topic - The topic of the indicator
 */
export const show = createAction(`[${starkProgressIndicatorStoreKey}] Show`, props<{ topic: string }>());

export type Types = ReturnType<typeof register> | ReturnType<typeof deregister> | ReturnType<typeof hide> | ReturnType<typeof show>;
