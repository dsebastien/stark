import { createAction, props } from "@ngrx/store";

/**
 * Action that requires to display an error message as a toast notification
 *
 * Parameter:
 *   - error - The error to display
 */
export const unhandledError = createAction("[StarkErrorHandling] Unhandled Error", props<{ error: any }>());

export type Types = ReturnType<typeof unhandledError>;
