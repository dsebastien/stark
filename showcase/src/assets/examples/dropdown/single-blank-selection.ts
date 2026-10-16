import { Component } from "@angular/core";

@Component({
	standalone: false,
	selector: "demo-dropdown",
	templateUrl: "./demo-dropdown.component.html"
})
export class DemoDropdownComponent {
	public selectedNumber = "";

	public numberDropdownOnChange(selectedValue: string): void {
		this.selectedNumber = selectedValue;
	}
}
