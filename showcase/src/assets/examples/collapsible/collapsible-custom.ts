import { Component } from "@angular/core";

@Component({
	standalone: false,
	selector: "demo-collapsible",
	templateUrl: "./demo-collapsible.component.html"
})
export class DemoCollapsibleComponent {
	public collapsed: boolean[] = [false, true];

	public toggleCollapsible(nb: number): void {
		this.collapsed[nb] = !this.collapsed[nb];
	}
}
