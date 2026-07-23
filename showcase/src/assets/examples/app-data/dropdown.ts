import { ChangeDetectorRef, Component, Inject, NgZone, OnInit } from "@angular/core";
import {
	STARK_APP_METADATA,
	STARK_USER_SERVICE,
	StarkApplicationMetadata,
	StarkUser,
	StarkUserService
} from "@nationalbankbelgium/stark-core";
import * as moment from "moment";
import { filter } from "rxjs/operators";

@Component({
	standalone: false,
	selector: "demo-app-data",
	templateUrl: "./demo-app-data.component.html",
	styleUrls: ["./demo-app-data.component.scss"]
})
export class DemoAppDataComponent implements OnInit {
	public user?: StarkUser;
	public time = moment().format("lll");

	public constructor(
		@Inject(STARK_USER_SERVICE) public userService: StarkUserService,
		@Inject(STARK_APP_METADATA) public appMetadata: StarkApplicationMetadata,
		private cdRef: ChangeDetectorRef,
		private ngZone: NgZone
	) {}

	public ngOnInit(): void {
		this.userService
			.fetchUserProfile()
			.pipe(filter<StarkUser | undefined, StarkUser>((user?: StarkUser): user is StarkUser => typeof user !== "undefined"))
			.subscribe((user: StarkUser) => {
				this.ngZone.run(() => {
					this.user = user;
					this.cdRef.markForCheck();
				});
			});
	}
}
