import { HttpClient, HttpErrorResponse, HttpRequest, HttpResponse } from "@angular/common/http";
import { Injector } from "@angular/core";
import { Observable, of, Subject, throwError } from "rxjs";
import { StarkHttpHeaders } from "../../http/constants";
import { StarkXSRFServiceImpl } from "./xsrf.service";
import { StarkXSRFConfig } from "./xsrf-config.intf";
import { StarkApplicationConfig, StarkApplicationConfigImpl } from "../../../configuration/entities";
import { StarkBackend, StarkBackendAuthenticationTypes } from "../../http/entities";
import { MockStarkLoggingService, createMockObject, type VitestMockObject } from "@nationalbankbelgium/stark-core/testing";
import { vi } from "vitest";

// this type is necessary due to the overloads of the HttpClient.get, so this refines the type to the one we use in StarkHttpService
type HttpClientGet = (...args: any[]) => Observable<HttpResponse<string>>;

describe("Service: StarkXSRFService", () => {
	let xsrfService: StarkXSRFServiceHelper;
	let appConfig: StarkApplicationConfig;
	let mockDocument: Pick<Document, "cookie">;
	let mockInjectorService: VitestMockObject<Injector>;
	let mockXsrfConfig: StarkXSRFConfig;

	const mockLogger: MockStarkLoggingService = new MockStarkLoggingService();
	const httpMock: VitestMockObject<HttpClient> = createMockObject<HttpClient>(["get"]);
	const mockXSRFToken = "dummy xsrf token";
	const dummyHeader = "X-DUMMY-HEADER";

	const mockBackend1: StarkBackend = {
		name: "dummy backend 1",
		url: "dummy/url",
		authenticationType: StarkBackendAuthenticationTypes.PUBLIC,
		devAuthenticationEnabled: false,
		devAuthenticationRolePrefix: ""
	};
	const mockBackend2: StarkBackend = { ...mockBackend1, name: "dummy backend 2", url: "other/url" };
	const mockBackend3: StarkBackend = { ...mockBackend1, name: "dummy backend 3", url: "another/url" };

	beforeEach(() => {
		appConfig = new StarkApplicationConfigImpl();
		appConfig.backends = new Map<string, StarkBackend>();
		appConfig.backends.set(mockBackend1.name, mockBackend1);
		appConfig.backends.set(mockBackend2.name, mockBackend2);
		appConfig.backends.set(mockBackend3.name, mockBackend3);
		mockDocument = { cookie: "" };
		mockInjectorService = createMockObject<Injector>(["get"]);
		mockXsrfConfig = {};

		mockLogger.error.mockReset();
		mockLogger.warn.mockReset();
		httpMock.get.mockReset();

		xsrfService = new StarkXSRFServiceHelper(
			appConfig,
			mockLogger,
			httpMock as unknown as HttpClient,
			<any>mockDocument,
			mockInjectorService as unknown as Injector,
			mockXsrfConfig
		);
	});

	describe("configureXHR", () => {
		it("should add the necessary options to the XHR object in order to enable XSRF protection", () => {
			const getXSRFTokenSpy = vi.spyOn(xsrfService, "getXSRFToken").mockReturnValue(mockXSRFToken);

			const mockXHR: XMLHttpRequest = new XMLHttpRequest();
			mockXHR.open("GET", "some/url");

			const setRequestHeaderSpy = vi.spyOn(mockXHR, "setRequestHeader");

			xsrfService.configureXHR(mockXHR);

			expect(getXSRFTokenSpy).toHaveBeenCalledTimes(1);
			expect(setRequestHeaderSpy).toHaveBeenCalledTimes(1);
			expect(setRequestHeaderSpy).toHaveBeenCalledWith(StarkHttpHeaders.XSRF_TOKEN, mockXSRFToken);
			expect(mockXHR.withCredentials).toBe(true);
		});

		it("should NOT add any options to the XHR object if the XSRF token is not yet stored", () => {
			const getXSRFTokenSpy = vi.spyOn(xsrfService, "getXSRFToken").mockReturnValue(undefined);

			const mockXHR: XMLHttpRequest = new XMLHttpRequest();
			mockXHR.open("GET", "some/url");

			const setRequestHeaderSpy = vi.spyOn(mockXHR, "setRequestHeader");

			xsrfService.configureXHR(mockXHR);

			expect(getXSRFTokenSpy).toHaveBeenCalledTimes(1);
			expect(setRequestHeaderSpy).not.toHaveBeenCalled();
			expect(mockXHR.withCredentials).toBe(false);
		});

		it("should THROW an error when it was called without calling the XHE open() method before", () => {
			const mockXHR: XMLHttpRequest = new XMLHttpRequest();

			expect(() => xsrfService.configureXHR(mockXHR)).toThrowError(/open\(\) method has not been invoked/);
		});
	});

	// eslint-disable-next-line sonarjs/cognitive-complexity
	describe("configureHttpRequest", () => {
		it("should create a new Angular HttpRequest with the XSRF protection enabled if the HTTP method is POST, PUT, PATCH or DELETE", () => {
			const getXSRFTokenSpy = vi.spyOn(xsrfService, "getXSRFToken").mockReturnValue(mockXSRFToken);

			const stateChangingMethods: string[] = ["POST", "PUT", "PATCH", "DELETE"];

			function headersShouldBeInitialized(httpMethod: string): boolean {
				return httpMethod === "PUT" || httpMethod === "PATCH";
			}

			for (const stateChangingMethod of stateChangingMethods) {
				getXSRFTokenSpy.mockClear();

				let mockHttpRequest: HttpRequest<any> = new HttpRequest<any>(<any>stateChangingMethod, "dummy/url");

				if (headersShouldBeInitialized(stateChangingMethod)) {
					mockHttpRequest = mockHttpRequest.clone({ headers: mockHttpRequest.headers.set(dummyHeader, "dummy value") });
				}

				const protectedConfig: HttpRequest<any> = xsrfService.configureHttpRequest(mockHttpRequest);

				expect(getXSRFTokenSpy).toHaveBeenCalledTimes(1);
				expect(protectedConfig).not.toBe(mockHttpRequest);
				expect(protectedConfig).not.toEqual(mockHttpRequest);
				expect(protectedConfig.withCredentials).toBe(true);
				expect(protectedConfig.headers).toBeDefined();
				expect(protectedConfig.headers.get(StarkHttpHeaders.XSRF_TOKEN)).toBe(mockXSRFToken);

				if (headersShouldBeInitialized(stateChangingMethod)) {
					expect(protectedConfig.headers.get(dummyHeader)).toBe("dummy value");
				}
			}
		});

		it("should leave the HttpRequest 'as is' if the XSRF token is not yet stored", () => {
			const getXSRFTokenSpy = vi.spyOn(xsrfService, "getXSRFToken").mockReturnValue(undefined);

			const stateChangingMethods: string[] = ["POST", "PUT", "PATCH", "DELETE"];

			for (const stateChangingMethod of stateChangingMethods) {
				getXSRFTokenSpy.mockClear();

				const mockHttpRequest: HttpRequest<any> = new HttpRequest<any>(<any>stateChangingMethod, "dummy/url");

				const protectedRequest: HttpRequest<any> = xsrfService.configureHttpRequest(mockHttpRequest);

				expect(getXSRFTokenSpy).toHaveBeenCalledTimes(1);
				expect(protectedRequest).toEqual(mockHttpRequest.clone({ withCredentials: true }));
				expect(protectedRequest.withCredentials).toBe(true);
				expect(protectedRequest.headers.keys().length).toBe(0);
			}
		});

		it("should only add 'withCredentials: true' if the HTTP method is not POST, PUT, PATCH nor DELETE", () => {
			const getXSRFTokenSpy = vi.spyOn(xsrfService, "getXSRFToken");

			const nonStateChangingMethods: string[] = ["GET", "HEAD", "CONNECT", "OPTIONS", "TRACE"];

			function headersShouldBeInitialized(httpMethod: string): boolean {
				return httpMethod === "GET" || httpMethod === "OPTIONS";
			}

			for (const nonStateChangingMethod of nonStateChangingMethods) {
				let mockHttpRequest: HttpRequest<any> = new HttpRequest<any>(<any>nonStateChangingMethod, "dummy/url");

				if (headersShouldBeInitialized(nonStateChangingMethod)) {
					mockHttpRequest = mockHttpRequest.clone({ headers: mockHttpRequest.headers.set(dummyHeader, "some value") });
				}

				const protectedRequest: HttpRequest<any> = xsrfService.configureHttpRequest(mockHttpRequest);

				expect(getXSRFTokenSpy).not.toHaveBeenCalled();
				expect(protectedRequest).toEqual(mockHttpRequest.clone({ withCredentials: true }));
				expect(protectedRequest.withCredentials).toBe(true);

				if (headersShouldBeInitialized(nonStateChangingMethod)) {
					expect(protectedRequest.headers.keys().length).toBeGreaterThan(0);
					expect(protectedRequest.headers.get(dummyHeader)).toBe("some value");
					expect(protectedRequest.headers.get(StarkHttpHeaders.XSRF_TOKEN)).toBeNull();
				} else {
					expect(protectedRequest.headers.keys().length).toBe(0);
				}
			}
		});
	});

	describe("getXSRFToken", () => {
		describe("with `httpOnly === true`", () => {
			beforeEach(() => {
				mockXsrfConfig = {
					httpOnly: true
				};

				xsrfService = new StarkXSRFServiceHelper(
					appConfig,
					mockLogger,
					httpMock as unknown as HttpClient,
					<any>mockDocument,
					mockInjectorService as unknown as Injector,
					mockXsrfConfig
				);
			});

			it("should return the XSRF token in case there is one already stored in cookie", () => {
				const expectedToken = "dummy xsrf cookie token";
				xsrfService.setCurrentToken(mockXSRFToken);
				const getXSRFCookieSpy = vi.spyOn(xsrfService, "getXSRFCookie").mockReturnValue(expectedToken);

				const xsrfToken: string = <string>xsrfService.getXSRFToken();

				expect(xsrfToken).toBe(expectedToken);
				expect(getXSRFCookieSpy).toHaveBeenCalledTimes(1);
				expect(mockLogger.warn).not.toHaveBeenCalled();
			});

			it("should return undefined and log a warning in case there is no XSRF token yet", () => {
				xsrfService.setCurrentToken(mockXSRFToken);
				const getXSRFCookieSpy = vi.spyOn(xsrfService, "getXSRFCookie").mockReturnValue(undefined);

				const xsrfToken: undefined = <undefined>xsrfService.getXSRFToken();

				expect(xsrfToken).toBeUndefined();
				expect(getXSRFCookieSpy).toHaveBeenCalledTimes(1);
				expect(mockLogger.warn).toHaveBeenCalledTimes(1);
				const warningMessage: string = mockLogger.warn.mock.calls[0][0];
				expect(warningMessage).toContain("no XSRF token found");
			});
		});

		it("should return the XSRF token in case there is one already stored", () => {
			xsrfService.setCurrentToken(mockXSRFToken);

			const xsrfToken: string = <string>xsrfService.getXSRFToken();

			expect(xsrfToken).toBe(mockXSRFToken);
			expect(mockLogger.warn).not.toHaveBeenCalled();
		});

		it("should overwrite the XSRF cookie with the XSRF token that is already stored", () => {
			xsrfService.setCurrentToken(mockXSRFToken);
			const setXSRFCookieSpy = vi.spyOn(xsrfService, "setXSRFCookie");

			const xsrfToken: string = <string>xsrfService.getXSRFToken();

			expect(xsrfToken).toBe(mockXSRFToken);
			expect(setXSRFCookieSpy).toHaveBeenCalledTimes(1);
			expect(setXSRFCookieSpy).toHaveBeenCalledWith(xsrfToken);
			expect(mockDocument.cookie.length).toBeGreaterThan(0);
			const cookieOptions: any[] = mockDocument.cookie.split(";");
			expect(cookieOptions.length).toBe(3);
			expect(cookieOptions[0]).toBe(xsrfService.getXsrfCookieName() + "=" + mockXSRFToken);
			expect(cookieOptions[1]).toBe("path='/'");
			expect(cookieOptions[2]).toMatch(new RegExp(`expires=.*(${new Date().getFullYear()})`));
		});

		it("should return undefined and log a warning in case there is no XSRF token yet", () => {
			xsrfService.setCurrentToken(undefined);

			const xsrfToken: undefined = <undefined>xsrfService.getXSRFToken();

			expect(xsrfToken).toBeUndefined();
			expect(mockLogger.warn).toHaveBeenCalledTimes(1);
			const warningMessage: string = mockLogger.warn.mock.calls[0][0];
			expect(warningMessage).toContain("no XSRF token found");
		});
	});

	describe("storeXSRFToken", () => {
		it("should store the XSRF token coming in the XSRF cookie if it has not been stored yet", () => {
			xsrfService.setCurrentToken(undefined);
			const getXSRFCookieSpy = vi.spyOn(xsrfService, "getXSRFCookie").mockReturnValue(mockXSRFToken);

			xsrfService.storeXSRFToken();

			expect(getXSRFCookieSpy).toHaveBeenCalledTimes(1);
			expect(xsrfService.getCurrentToken()).toBe(mockXSRFToken);
		});

		it("should store an undefined value if it has not been stored yet and the XSRF cookie does not exist or it is empty", () => {
			xsrfService.setCurrentToken(undefined);
			const getXSRFCookieSpy = vi.spyOn(xsrfService, "getXSRFCookie").mockReturnValueOnce(undefined).mockReturnValueOnce("");

			xsrfService.storeXSRFToken();

			expect(getXSRFCookieSpy).toHaveBeenCalledTimes(1);
			expect(xsrfService.getCurrentToken()).toBeUndefined();

			getXSRFCookieSpy.mockReset();
			getXSRFCookieSpy.mockReturnValue("");
			xsrfService.storeXSRFToken();

			expect(getXSRFCookieSpy).toHaveBeenCalledTimes(1);
			expect(xsrfService.getCurrentToken()).toBeUndefined();
		});

		it("should just overwrite the XSRF cookie with the XSRF token that is already stored", () => {
			xsrfService.setCurrentToken(mockXSRFToken);
			const setXSRFCookieSpy = vi.spyOn(xsrfService, "setXSRFCookie");

			xsrfService.storeXSRFToken();

			expect(setXSRFCookieSpy).toHaveBeenCalledTimes(1);
			expect(setXSRFCookieSpy).toHaveBeenCalledWith(<string>xsrfService.getCurrentToken());
			expect(mockDocument.cookie.length).toBeGreaterThan(0);
			const cookieOptions: any[] = mockDocument.cookie.split(";");
			expect(cookieOptions.length).toBe(3);
			expect(cookieOptions[0]).toBe(xsrfService.getXsrfCookieName() + "=" + mockXSRFToken);
			expect(cookieOptions[1]).toBe("path='/'");
			expect(cookieOptions[2]).toMatch(new RegExp(`expires=.*(${new Date().getFullYear()})`));
		});

		it("should not overwrite the XSRF cookie by the XSRF token that is already stored if `httpOnly !== true`", () => {
			mockXsrfConfig = {
				httpOnly: true
			};

			xsrfService = new StarkXSRFServiceHelper(
				appConfig,
				mockLogger,
				httpMock as unknown as HttpClient,
				<any>mockDocument,
				mockInjectorService as unknown as Injector,
				mockXsrfConfig
			);

			xsrfService.setCurrentToken(mockXSRFToken);
			const setXSRFCookieSpy = vi.spyOn(xsrfService, "setXSRFCookie");
			const getXSRFCookieSpy = vi.spyOn(xsrfService, "getXSRFCookie");

			xsrfService.storeXSRFToken();

			expect(setXSRFCookieSpy).not.toHaveBeenCalled();
			expect(getXSRFCookieSpy).not.toHaveBeenCalled();
		});
	});

	describe("pingBackends", () => {
		it("should trigger an HTTP call to every backend defined in the application configuration", () => {
			httpMock.get.mockReturnValue(of(new HttpResponse({ body: "ping OK" })));

			xsrfService.pingBackends();

			expect(httpMock.get).toHaveBeenCalledTimes(appConfig.backends.size);
			const httpCalls = httpMock.get.mock.calls;
			let callIndex = 0;

			appConfig.backends.forEach((backendConfig: StarkBackend) => {
				expect(httpCalls[callIndex][0]).toBe(backendConfig.url);
				expect(httpCalls[callIndex][1]).toEqual({ observe: "response", responseType: "text" });
				callIndex++;
			});

			expect(mockLogger.error).not.toHaveBeenCalled();
		});

		it("should log an error when the HTTP call to a backend failed", () => {
			const failingBackends: StarkBackend[] = [mockBackend1, mockBackend3];

			httpMock.get.mockImplementation(((url: string) => {
				if (failingBackends.map((failingBackend: StarkBackend) => failingBackend.url).indexOf(url) !== -1) {
					return throwError(() => new HttpErrorResponse({ error: "ping failed" }));
				}

				return of(new HttpResponse({ body: "ping OK" }));
			}) as HttpClientGet);

			xsrfService.pingBackends();

			expect(httpMock.get).toHaveBeenCalledTimes(appConfig.backends.size);
			const httpCalls = httpMock.get.mock.calls;
			let httpCallIdx = 0;

			appConfig.backends.forEach((backendConfig: StarkBackend) => {
				expect(httpCalls[httpCallIdx][0]).toBe(backendConfig.url);
				expect(httpCalls[httpCallIdx][1]).toEqual({ observe: "response", responseType: "text" });
				httpCallIdx++;
			});

			expect(mockLogger.error).toHaveBeenCalledTimes(failingBackends.length);
			const logErrorCalls = mockLogger.error.mock.calls;
			let logErrorCallIdx = 0;

			for (const failingBackend of failingBackends) {
				expect(logErrorCalls[logErrorCallIdx][0]).toContain(failingBackend.name);
				logErrorCallIdx++;
			}
		});

		it("should NOT trigger any HTTP call until the waitBeforePinging observable emits", () => {
			httpMock.get.mockReturnValue(of(new HttpResponse({ body: "ping OK" })));
			const mockWaitBeforePinging$: Subject<any> = new Subject<any>();
			vi.spyOn(xsrfService, "getWaitBeforePingingObs").mockReturnValue(mockWaitBeforePinging$);

			xsrfService.pingBackends();

			expect(httpMock.get).not.toHaveBeenCalled();

			mockWaitBeforePinging$.next("stop waiting");
			mockWaitBeforePinging$.complete();

			expect(httpMock.get).toHaveBeenCalledTimes(appConfig.backends.size);
		});
	});

	class StarkXSRFServiceHelper extends StarkXSRFServiceImpl {
		public constructor(
			applicationConfig: StarkApplicationConfig,
			logger: MockStarkLoggingService,
			httpClient: HttpClient,
			document: Document,
			injector: Injector,
			config: StarkXSRFConfig
		) {
			super(applicationConfig, logger, httpClient, document, injector, config);
		}

		public override getXSRFCookie(): string | undefined {
			return super.getXSRFCookie();
		}

		public override setXSRFCookie(xsrfToken: string): void {
			super.setXSRFCookie(xsrfToken);
		}

		public override getWaitBeforePingingObs(): Observable<any> {
			return super.getWaitBeforePingingObs();
		}

		public getXsrfCookieName(): string {
			return this.xsrfCookieName;
		}

		public getCurrentToken(): string | undefined {
			return this.currentToken;
		}

		public setCurrentToken(token: string | undefined): void {
			this.currentToken = token;
		}
	}
});
