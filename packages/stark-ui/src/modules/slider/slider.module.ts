import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { StarkSliderComponent } from "./components";

@NgModule({
	imports: [CommonModule, StarkSliderComponent],
	exports: [StarkSliderComponent]
})
export class StarkSliderModule {}
