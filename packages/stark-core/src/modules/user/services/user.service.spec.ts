import { Store } from "@ngrx/store";
import { Observer, of, throwError } from "rxjs";
import { Deserialize } from "cerialize";

import { StarkUserActions } from "../actions";
import { StarkUser } from "../entities";
import { StarkUserServiceImpl } from "./user.service";
import { MockStarkLoggingService } from "@nationalbankbelgium/stark-core/testing";
import { StarkUserRepository } from "../repository";
import {
	StarkHttpError,
	StarkHttpErrorImpl,
	StarkHttpErrorWrapper,
	StarkHttpErrorWrapperImpl,
	StarkSingleItemResponseWrapper,
	StarkSingleItemResponseWrapperImpl
} from "../../http/entities";
import { StarkHttpStatusCodes } from "../../http/enumerators";
import { HttpErrorResponse } from "@angular/common/http";
import { StarkMockData } from "../../../configuration/entities/mock-data";
import { StarkCoreApplicationState } from "../../../common/store";
import { createMockObject, type VitestMockObject } from "@nationalbankbelgium/stark-core/testing";

interface StarkUserWithCustomData extends Pick<StarkUser, "uuid" | "username" | "roles"> {
	[prop: string]: any;
}

describe("Service: StarkUserService", () => {
	let userService: StarkUserServiceImpl;
	let mockStore: VitestMockObject<Store<StarkCoreApplicationState>>;
	let mockUserRepository: VitestMockObject<StarkUserRepository>;
	let mockLogger: MockStarkLoggingService;

	let mockData: StarkMockData;
	let mockUsers: StarkUserWithCustomData[];
	let mockUserCustomData: { [prop: string]: any };
	let mockUserCustomData2: { [prop: string]: any };
	let mockUserInstances: StarkUser[];
	let mockObserver: VitestMockObject<Observer<any>>;

	beforeEach(() => {
		mockLogger = new MockStarkLoggingService();
		mockUserRepository = createMockObject<StarkUserRepository>(["getUser"]);
		mockStore = createMockObject<Store<StarkCoreApplicationState>>(["dispatch"]);
		mockData = { profiles: [] };
		mockUserCustomData = {
			prop1: 1234,
			prop2: "whatever",
			prop3: "2016-03-18T18:25:43.511Z",
			prop4: ["some value", "false", "null", "", true, false, 0, { name: "Christopher", surname: "Cortes" }]
		};
		mockUserCustomData2 = {
			...mockUserCustomData,
			prop4: ["some value", "false", "null", "", true, false, 0, { name: "Alexis", surname: "Georges" }]
		};
		mockUsers = [
			{
				uuid: "1",
				username: "ccortes",
				roles: [],
				details: {
					firstName: "Christopher",
					lastName: "Cortes",
					language: "EN",
					mail: "ccortes@nbb.be",
					referenceNumber: "1234"
				},
				custom: mockUserCustomData
			},
			{
				uuid: "2",
				username: "ageorges",
				roles: [],
				details: {
					firstName: "Alexis",
					lastName: "Georges",
					language: "FR",
					mail: "ageorges@nbb.be",
					referenceNumber: "4321"
				},
				custom: mockUserCustomData2
			}
		];
		mockUserInstances = Deserialize(mockUsers, StarkUser);
		mockObserver = createMockObject<Observer<any>>(["next", "error", "complete"]);

		userService = new StarkUserServiceImpl(
			mockLogger,
			mockUserRepository as unknown as StarkUserRepository,
			mockData,
			mockStore as unknown as Store<StarkCoreApplicationState>
		);
	});

	describe("getAllUsers", () => {
		it("should return the users from the mock data and then dispatch the success action", () => {
			userService["userProfiles"] = mockUserInstances;

			const result: StarkUser[] = userService.getAllUsers();

			expect(result.length).toBe(2);

			result.forEach((userInstance: StarkUser, index: number) => {
				expect(userInstance instanceof StarkUser).toBe(true);
				expect(userInstance.uuid).toBe(mockUsers[index].uuid);
				expect(userInstance.firstName).toBe(mockUsers[index]["details"].firstName);
				expect(userInstance.lastName).toBe(mockUsers[index]["details"].lastName);
				expect(userInstance.language).toBe(mockUsers[index]["details"].language);
				expect(userInstance.email).toBe(mockUsers[index]["details"].mail);
				expect(userInstance.referenceNumber).toBe(mockUsers[index]["details"].referenceNumber);
				expect(userInstance.custom).toEqual(mockUsers[index]["custom"]);
			});

			expect(mockStore.dispatch).toHaveBeenCalledTimes(2);

			expect(mockStore.dispatch.mock.calls[0][0]).toEqual(StarkUserActions.getAllUsers());
			expect(mockStore.dispatch.mock.calls[1][0]).toEqual(StarkUserActions.getAllUsersSuccess({ users: result }));
		});

		it("should dispatch the failure action in case the mock data has no users defined", () => {
			userService["userProfiles"] = [];

			let result: StarkUser[] = userService.getAllUsers();

			expect(result).toEqual([]);

			expect(mockStore.dispatch).toHaveBeenCalledTimes(2);

			expect(mockStore.dispatch.mock.calls[0][0]).toEqual(StarkUserActions.getAllUsers());
			expect((mockStore.dispatch.mock.calls[1][0] as any).type).toBe(StarkUserActions.getAllUsersFailure.type);
			expect((mockStore.dispatch.mock.calls[1][0] as any).message).toContain("No user profiles found");

			mockStore.dispatch.mockReset();
			// eslint-disable-next-line no-null/no-null
			userService["userProfiles"] = null as any;

			result = userService.getAllUsers();

			expect(result).toEqual([]);

			expect(mockStore.dispatch).toHaveBeenCalledTimes(2);

			expect(mockStore.dispatch.mock.calls[0][0]).toEqual(StarkUserActions.getAllUsers());
			expect((mockStore.dispatch.mock.calls[1][0] as any).type).toBe(StarkUserActions.getAllUsersFailure.type);
			expect((mockStore.dispatch.mock.calls[1][0] as any).message).toContain("No user profiles found");
		});

		it("should throw an error in case any of the users defined in the mock data is not valid", () => {
			mockUserInstances[0].username = <any>undefined;
			mockUserInstances[1].firstName = <any>undefined;

			userService["userProfiles"] = mockUserInstances;

			expect(() => userService.getAllUsers()).toThrowError(/invalid/);

			expect(mockStore.dispatch).toHaveBeenCalledTimes(1);

			expect(mockStore.dispatch.mock.calls[0][0]).toEqual(StarkUserActions.getAllUsers());
		});
	});

	describe("fetchUserProfile", () => {
		it("on SUCCESS, should call userRepository and then dispatch the success action and return the user in an observable", () => {
			const mockResponseWrapper: StarkSingleItemResponseWrapper<StarkUser> = new StarkSingleItemResponseWrapperImpl(
				StarkHttpStatusCodes.HTTP_200_OK,
				new Map<string, string>(),
				mockUserInstances[0]
			);

			mockUserRepository.getUser.mockReturnValue(of(mockResponseWrapper));

			userService.fetchUserProfile().subscribe(mockObserver as Observer<any>);

			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			const result: StarkUser = mockObserver.next.mock.calls[0][0];
			expect(result).toBeDefined();
			expect(result instanceof StarkUser).toBe(true);
			expect(result.uuid).toBe(mockUsers[0].uuid);
			expect(result.firstName).toBe(mockUsers[0]["details"].firstName);
			expect(result.lastName).toBe(mockUsers[0]["details"].lastName);
			expect(result.language).toBe(mockUsers[0]["details"].language);
			expect(result.email).toBe(mockUsers[0]["details"].mail);
			expect(result.referenceNumber).toBe(mockUsers[0]["details"].referenceNumber);
			expect(result.custom).toEqual(mockUsers[0]["custom"]);

			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).toHaveBeenCalledTimes(1); // it completes because of the Store mock observable

			expect(mockUserRepository.getUser).toHaveBeenCalledTimes(1);

			expect(mockStore.dispatch).toHaveBeenCalledTimes(2);

			expect(mockStore.dispatch.mock.calls[0][0]).toEqual(StarkUserActions.fetchUserProfile());
			expect(mockStore.dispatch.mock.calls[1][0]).toEqual(StarkUserActions.fetchUserProfileSuccess({ user: mockUserInstances[0] }));
		});

		it("on SUCCESS, should throw an error in case the user profile fetched is not valid and then dispatch the failure action", () => {
			mockUserInstances[0].username = <any>undefined;

			const mockResponseWrapper: StarkSingleItemResponseWrapper<StarkUser> = new StarkSingleItemResponseWrapperImpl(
				StarkHttpStatusCodes.HTTP_200_OK,
				new Map<string, string>(),
				mockUserInstances[0]
			);

			mockUserRepository.getUser.mockReturnValue(of(mockResponseWrapper));

			userService.fetchUserProfile().subscribe(mockObserver as Observer<any>);

			expect(mockObserver.next).not.toHaveBeenCalled();
			expect(mockObserver.error).toHaveBeenCalledTimes(1);
			expect(mockObserver.complete).not.toHaveBeenCalled();

			const error: Error = mockObserver.error.mock.calls[0][0];
			expect(error.message).toContain("invalid user profile");

			expect(mockUserRepository.getUser).toHaveBeenCalledTimes(1);

			expect(mockStore.dispatch).toHaveBeenCalledTimes(2);

			expect(mockStore.dispatch.mock.calls[0][0]).toEqual(StarkUserActions.fetchUserProfile());
			expect((mockStore.dispatch.mock.calls[1][0] as any).type).toBe(StarkUserActions.fetchUserProfileFailure.type);
			expect(((mockStore.dispatch.mock.calls[1][0] as any).error as Error).message).toContain("invalid user profile");
		});

		it("on FAILURE, should call userRepository and then dispatch the failure action", () => {
			const dummyError: Error = new Error("dummy error message");

			const mockHttpError: StarkHttpError = new StarkHttpErrorImpl(dummyError);
			mockHttpError.type = "some type";
			mockHttpError.title = "a title";
			mockHttpError.titleKey = "a key";
			mockHttpError.errors = [];

			const mockHttpErrorResponse: HttpErrorResponse = new HttpErrorResponse({
				error: mockHttpError,
				status: StarkHttpStatusCodes.HTTP_404_NOT_FOUND
			});

			const mockErrorResponseWrapper: StarkHttpErrorWrapper = new StarkHttpErrorWrapperImpl(
				mockHttpErrorResponse,
				new Map<string, string>(),
				dummyError
			);

			mockUserRepository.getUser.mockReturnValue(throwError(() => mockErrorResponseWrapper));

			userService.fetchUserProfile().subscribe(mockObserver as Observer<any>);

			expect(mockObserver.next).not.toHaveBeenCalled();
			expect(mockObserver.error).toHaveBeenCalledTimes(1);
			expect(mockObserver.complete).not.toHaveBeenCalled();

			const errorWrapper: StarkHttpErrorWrapper = mockObserver.error.mock.calls[0][0];

			expect(errorWrapper).toBeDefined();
			expect(errorWrapper.httpError.type).toBe(mockHttpError.type);
			expect(errorWrapper.httpError.title).toBe(mockHttpError.title);
			expect(errorWrapper.httpError.titleKey).toBe(mockHttpError.titleKey);
			expect(errorWrapper.httpError.errors.length).toBe(mockHttpError.errors.length);
			expect(mockUserRepository.getUser).toHaveBeenCalledTimes(1);

			expect(mockStore.dispatch).toHaveBeenCalledTimes(2);

			expect(mockStore.dispatch.mock.calls[0][0]).toEqual(StarkUserActions.fetchUserProfile());
			expect(mockStore.dispatch.mock.calls[1][0]).toEqual(
				StarkUserActions.fetchUserProfileFailure({ error: mockErrorResponseWrapper })
			);
		});
	});
});
