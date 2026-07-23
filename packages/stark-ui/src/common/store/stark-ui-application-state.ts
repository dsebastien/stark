import { StarkMessageState } from "./message-state";

/**
 * Interface defining the shape of the application state of Stark Ui extending Core (i.e., what's stored in Redux by Stark)
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Preserve this public UI application-state interface.
export interface StarkUIApplicationState extends StarkMessageState {}
