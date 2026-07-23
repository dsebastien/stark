import { StarkSettingsEffects } from "./settings.effects";
import { StarkSettingsActions } from "../actions";
import { STARK_SESSION_SERVICE } from "../../session/services";
import { MockStarkSessionService, createMockObject } from "@nationalbankbelgium/stark-core/testing";
import { TestBed } from "@angular/core/testing";
import { Observer, ReplaySubject } from "rxjs";
import { provideMockActions } from "@ngrx/effects/testing";

describe("Effect: StarkSettingsEffects", () => {
	let settingsEffects: StarkSettingsEffects;

	let mockSessionService: MockStarkSessionService;
	let actions: ReplaySubject<any>;

	// Inject module dependencies
	beforeEach(() => {
		actions = new ReplaySubject(1);

		TestBed.configureTestingModule({
			providers: [
				StarkSettingsEffects,
				provideMockActions(() => actions.asObservable()),
				{
					provide: STARK_SESSION_SERVICE,
					useFactory: (): MockStarkSessionService => new MockStarkSessionService()
				}
			],
			imports: []
		});

		settingsEffects = TestBed.inject(StarkSettingsEffects);
		mockSessionService = TestBed.inject<MockStarkSessionService>(STARK_SESSION_SERVICE);
	});

	describe("On setPreferredLanguage$", () => {
		it("should set the language successfully", () => {
			const mockObserver = createMockObject<Observer<any>>(["next", "error", "complete"]);
			mockSessionService.setCurrentLanguage.mockReturnValue(undefined);

			settingsEffects.setPreferredLanguage$.subscribe(mockObserver as Observer<any>);

			actions.next(StarkSettingsActions.setPreferredLanguage({ language: "NL" }));

			expect(mockSessionService.setCurrentLanguage).toHaveBeenCalledWith("NL");
			expect(mockObserver.next).toHaveBeenCalledTimes(1);
			expect(mockObserver.next).toHaveBeenCalledWith(undefined);
			expect(mockObserver.error).not.toHaveBeenCalled();
			expect(mockObserver.complete).not.toHaveBeenCalled(); // effects should never complete!
		});
	});
});
