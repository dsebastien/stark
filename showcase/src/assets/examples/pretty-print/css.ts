import { Component } from "@angular/core";

@Component({
	selector: "demo-pretty-print",
	templateUrl: "./demo-pretty-print.component.html",
	styleUrls: ["./demo-pretty-print.component.scss"]
})
export class DemoPrettyPrintComponent {
	public rawCssData = [
		"body{background: #D2DA9C url(leftcolbg.jpg)repeat-y left top;color: #FFF;}",
		"p{margin-bottom:1em}ul{margin-left:20px;margin-bottom:1em}"
	].join("");
}
