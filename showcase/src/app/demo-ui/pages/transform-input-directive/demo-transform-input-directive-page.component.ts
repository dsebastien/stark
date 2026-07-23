import { Component, Inject } from "@angular/core";
import { STARK_LOGGING_SERVICE, StarkLoggingService } from "@nationalbankbelgium/stark-core";
import { UntypedFormControl } from "@angular/forms";
import { ReferenceLink } from "../../../shared/components";

@Component({
	standalone: false,
	selector: "showcase-demo-transform-input-directive-page",
	templateUrl: "./demo-transform-input-directive-page.component.html"
})
export class DemoTransformInputDirectivePageComponent {
	public value = "";
	public formControl = new UntypedFormControl("");
	private _emojiMap = new Map([
		[":+1:", "👍"],
		[":-1:", "👎"],
		[":smile:", "😄"],
		[":tada:", "🎉"],
		[":rocket:", "🚀"],
		[":zap:", "⚡️"]
	]);

	public simpleEmojiTransform = (value: string): string =>
		value.replace(/:[+-]?\w+:/, (match: string): string => this._emojiMap.get(match) || match);

	public referenceList: ReferenceLink[] = [
		{
			label: "Stark Transform Input directive",
			url: "https://stark.nbb.be/api-docs/stark-ui/latest/directives/StarkTransformInputDirective.html"
		}
	];

	public constructor(@Inject(STARK_LOGGING_SERVICE) private logger: StarkLoggingService) {
		this.formControl.valueChanges.subscribe((v: string) => this.logger.debug("formControl value changed: ", v));
	}
}
