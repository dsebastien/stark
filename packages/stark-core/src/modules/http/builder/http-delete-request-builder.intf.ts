import { StarkHttpBaseRequestBuilder } from "./http-abstract-base-request-builder.intf";
import { StarkResource } from "../entities/resource.entity.intf";

/**
 * Describes the different operations supported by Http request builders for resource-deleting requests
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Preserve this public request-builder interface.
export interface StarkHttpDeleteRequestBuilder<T extends StarkResource> extends StarkHttpBaseRequestBuilder<T> {}
