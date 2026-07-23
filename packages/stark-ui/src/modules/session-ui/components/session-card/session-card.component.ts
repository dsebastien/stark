import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from "@angular/core";
import { MatCardModule } from "@angular/material/card";
import { TranslateModule } from "@ngx-translate/core";
import { StarkAppLogoModule } from "@nationalbankbelgium/stark-ui/src/modules/app-logo";

/**
 * @ignore
 */
const componentName = "stark-session-card";

/**
 * Component to display session pages
 */
@Component({
	standalone: true,
	selector: "stark-session-card",
	templateUrl: "./session-card.component.html",
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [CommonModule, MatCardModule, TranslateModule, StarkAppLogoModule],
	// We need to use host instead of @HostBinding: https://github.com/NationalBankBelgium/stark/issues/664
	host: {
		class: componentName
	}
})
export class StarkSessionCardComponent {
	/**
	 * The title shown in the header of the card
	 */
	@Input()
	public cardTitle = "";
}
