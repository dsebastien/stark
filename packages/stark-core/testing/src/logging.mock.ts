import { StarkLoggingService } from "@nationalbankbelgium/stark-core";
import { vi } from "vitest";

/**
 * Mock class of the {@link StarkLoggingService} interface.
 */
export class MockStarkLoggingService {
	/**
	 * See [StarkLoggingService correlationId]{@link StarkLoggingService#correlationId} property
	 */
	public correlationId: StarkLoggingService["correlationId"];

	/**
	 * See [StarkLoggingService correlationIdHttpHeaderName]{@link StarkLoggingService#correlationIdHttpHeaderName} property
	 */
	public correlationIdHttpHeaderName: StarkLoggingService["correlationIdHttpHeaderName"];

	/**
	 * See [StarkLoggingService generateNewCorrelationId()]{@link StarkLoggingService#generateNewCorrelationId} method
	 */
	public generateNewCorrelationId = vi.fn<StarkLoggingService["generateNewCorrelationId"]>();

	/**
	 * See [StarkLoggingService debug()]{@link StarkLoggingService#debug} method
	 */
	public debug = vi.fn<StarkLoggingService["debug"]>();

	/**
	 * See [StarkLoggingService info()]{@link StarkLoggingService#info} method
	 */
	public info = vi.fn<StarkLoggingService["info"]>();

	/**
	 * See [StarkLoggingService warn()]{@link StarkLoggingService#warn} method
	 */
	public warn = vi.fn<StarkLoggingService["warn"]>();

	/**
	 * See [StarkLoggingService error()]{@link StarkLoggingService#error} method
	 */
	public error = vi.fn<StarkLoggingService["error"]>();

	/**
	 * Creates a new mock instance.
	 * @param mockCorrelationId - Correlation id to set to this instance
	 * @param mockCorrelationIdHeaderName - Correlation header name to set to this instance
	 */
	public constructor(
		mockCorrelationId: string = "dummyCorrelationId",
		mockCorrelationIdHeaderName: string = "Correlation-Id-HttpHeaderName"
	) {
		this.correlationId = mockCorrelationId;
		this.correlationIdHttpHeaderName = mockCorrelationIdHeaderName;
	}
}
