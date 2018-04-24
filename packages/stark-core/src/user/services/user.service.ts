import { Inject, Injectable } from "@angular/core";
import { Store } from "@ngrx/store";
import { validateSync } from "class-validator";
import { Observable } from "rxjs/Observable";
import { map } from "rxjs/operators/map";
import { catchError } from "rxjs/operators/catchError";
import { _throw as observableThrow } from "rxjs/observable/throw";

import { StarkHttpErrorWrapper, StarkSingleItemResponseWrapper } from "../../http/entities/index";
import { StarkUser } from "../../user/entities/index";
import {
	FetchUserProfile,
	FetchUserProfileSuccess,
	FetchUserProfileFailure,
	SetUser,
	GetAllUsers,
	GetAllUsersSuccess,
	GetAllUsersFailure
} from "../actions/index";
import { StarkLoggingService, starkLoggingServiceName } from "../../logging/services/index";
import { StarkSessionService, starkSessionServiceName } from "../../session/services/index";
import { StarkUserService, starkUserServiceName } from "./user.service.intf";
import { StarkUserRepository, starkUserRepositoryName } from "../repository/index";
import { STARK_MOCK_DATA, StarkMockData } from "../../configuration/entities/mock-data/index";
import { StarkCoreApplicationState } from "../../common/store/index";
import { StarkValidationErrorsUtil } from "../../util/index";
import { selectStarkUser } from "../reducers/index";

const userErrorMessagePrefix: string = starkUserServiceName + ": User defined is incorrect.";

/**
 * @ngdoc service
 * @name stark-core.service:StarkUserService
 * @description Service to fetch the user profile from the REST API. In Development, it can also be used to
 * set the user profile manually and to retrieve a list of profiles from a mock data file.
 *
 * @requires StarkLoggingService
 * @requires StarkSessionService
 * @requires ngrx-store.Store
 * @requires StarkUserRepository
 * @requires starkMockData the mock data to retrieve the profiles from
 */
@Injectable()
export class StarkUserServiceImpl implements StarkUserService {
	public user$: Observable<StarkUser | undefined>;
	private sessionService: StarkSessionService;
	public userProfiles: StarkUser[];

	public constructor(
		@Inject(starkLoggingServiceName) public logger: StarkLoggingService,
		@Inject(starkSessionServiceName) sessionService: StarkSessionService,
		public store: Store<StarkCoreApplicationState>,
		@Inject(starkUserRepositoryName) public userRepository: StarkUserRepository,
		// FIXME Use starkMockData
		@Inject(STARK_MOCK_DATA) _starkMockData: StarkMockData
	) {
		this.sessionService = sessionService;
		// the user is stored in the StarkSession
		this.user$ = store.select(selectStarkUser);

		this.logger.debug(starkUserServiceName + " loaded");

		// FIXME Where does DEVELOPMENT Variable come from ???
		// if (DEVELOPMENT) {
		// 	this.logger.debug(starkUserServiceName + ": Retrieving the user profiles from the mock data");
		// 	this.userProfiles = Deserialize(starkMockData.profiles, StarkUser);
		// }
	}

	public getUser(): Observable<StarkUser | undefined> {
		return this.user$;
	}

	public fetchUserProfile(): Observable<StarkUser> {
		// dispatch corresponding actions to allow the dev to trigger his own effects if needed
		this.store.dispatch(new FetchUserProfile());

		return this.userRepository.getUser().pipe(
			map((response: StarkSingleItemResponseWrapper<StarkUser>) => {
				// Use class-validator ton validate the object based on the entity StarkUser
				StarkValidationErrorsUtil.throwOnError(validateSync(response.data), userErrorMessagePrefix);
				// user deserialization logic is defined in StarkUser entity
				this.store.dispatch(new FetchUserProfileSuccess(response.data));
				this.sessionService.login(response.data);

				return response.data;
			}),
			catchError((error: StarkHttpErrorWrapper | Error) => {
				this.store.dispatch(new FetchUserProfileFailure(error));

				return observableThrow(error);
			})
		);
	}

	public setUser(user: StarkUser): void {
		// use class-validator to validate the object based on the entity StarkUser
		StarkValidationErrorsUtil.throwOnError(validateSync(user), userErrorMessagePrefix);

		// goal: define the new user profile to use in the app
		// useful for local development (login page == user profile selection)
		this.store.dispatch(new SetUser(user));
		this.sessionService.login(user);
	}

	public getAllUsers(): StarkUser[] {
		this.store.dispatch(new GetAllUsers());

		const allUsers: StarkUser[] = this.userProfiles;

		if (!allUsers || allUsers.length === 0) {
			this.store.dispatch(new GetAllUsersFailure(starkUserServiceName + ": No user profiles found in mock data!"));
		} else {
			for (const user of allUsers) {
				// Use class-validator ton validate the object based on the entity StarkUser
				StarkValidationErrorsUtil.throwOnError(validateSync(user), userErrorMessagePrefix);
			}

			this.store.dispatch(new GetAllUsersSuccess(allUsers));
		}

		return allUsers;
	}
}
