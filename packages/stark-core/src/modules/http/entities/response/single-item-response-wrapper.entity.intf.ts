import { StarkResponseWrapper } from "./response-wrapper.entity.intf";
import { StarkResource } from "../resource.entity.intf";

/**
 * This class is used by the {@link StarkHttpService} in order to wrap the Http response from all requests aimed to return a single item.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Preserve this public response-wrapper interface.
export interface StarkSingleItemResponseWrapper<T extends StarkResource> extends StarkResponseWrapper<T> {}
