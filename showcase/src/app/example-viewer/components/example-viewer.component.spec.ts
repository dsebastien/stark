import { Component, NgModule, NO_ERRORS_SCHEMA, ViewChild } from "@angular/core";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { MatButtonModule } from "@angular/material/button";
import { MatTabsModule } from "@angular/material/tabs";
import { MatTooltipModule } from "@angular/material/tooltip";
import { of, throwError, type Observable } from "rxjs";
import {
	STARK_LOGGING_SERVICE,
	STARK_ROUTING_SERVICE,
	type StarkLoggingService,
	type StarkRoutingService
} from "@nationalbankbelgium/stark-core";

import { ExampleFile, ExampleViewerComponent } from "./example-viewer.component";
import { FileService } from "../services";
import { vi } from "vitest";

type FileServiceMock = {
	fetchFile: ReturnType<typeof vi.fn<(path: string) => Observable<string>>>;
};

type LoggingServiceMock = Pick<StarkLoggingService, "error"> & {
	error: ReturnType<typeof vi.fn<(message: string, error: unknown) => void>>;
};

type RoutingServiceMock = Pick<StarkRoutingService, "getCurrentStateName"> & {
	getCurrentStateName: ReturnType<typeof vi.fn<() => string>>;
};

@Component({
	standalone: false,
	selector: "host-component",
	template: `
		<example-viewer [id]="id" [extensions]="extensions" [filesPath]="filesPath" [exampleTitle]="exampleTitle"></example-viewer>
	`
})
class TestHostComponent {
	@ViewChild(ExampleViewerComponent, { static: true })
	public exampleViewer!: ExampleViewerComponent;

	public id = "";
	public extensions: string[] = [];
	public filesPath?: string;
	public exampleTitle?: string;
}

@NgModule({
	declarations: [ExampleViewerComponent, TestHostComponent],
	imports: [NoopAnimationsModule, MatButtonModule, MatTabsModule, MatTooltipModule],
	schemas: [NO_ERRORS_SCHEMA]
})
class ExampleViewerTestModule {}

describe("ExampleViewerComponent", () => {
	// IMPORTANT: The official way to test components using ChangeDetectionStrategy.OnPush is to wrap it with a test host component
	// see https://github.com/angular/angular/issues/12313#issuecomment-444623173
	let hostFixture: ComponentFixture<TestHostComponent>;
	let hostComponent: TestHostComponent;
	let component: ExampleViewerComponent;
	let fileService: FileServiceMock;
	let logger: LoggingServiceMock;

	// Router config
	const mockStateName = "mock-state-name";
	const router: RoutingServiceMock = {
		getCurrentStateName: vi.fn<() => string>(() => mockStateName)
	};

	function renderHost(setup?: (host: TestHostComponent) => void): void {
		if (hostFixture) {
			hostFixture.destroy();
		}

		hostFixture = TestBed.createComponent(TestHostComponent);
		hostComponent = hostFixture.componentInstance;
		setup?.(hostComponent);
		hostFixture.detectChanges(); // trigger initial data binding
		component = hostComponent.exampleViewer;
	}

	beforeEach(waitForAsync(() => {
		logger = {
			error: vi.fn<(message: string, error: unknown) => void>()
		};
		fileService = {
			fetchFile: vi.fn<(path: string) => Observable<string>>(() => of("initial dummy file content"))
		};

		return TestBed.configureTestingModule({
			imports: [ExampleViewerTestModule],
			providers: [
				{ provide: STARK_LOGGING_SERVICE, useValue: logger },
				{ provide: STARK_ROUTING_SERVICE, useValue: router as unknown as StarkRoutingService },
				{
					provide: FileService,
					useValue: fileService as unknown as FileService
				}
			]
		}).compileComponents();
	}));

	beforeEach(() => {
		fileService.fetchFile.mockReset();
		fileService.fetchFile.mockImplementation(() => of("initial dummy file content"));
		logger.error.mockClear();

		renderHost();
	});

	describe("current state", () => {
		it("should be set on init", () => {
			expect(component.exampleState).toBe(mockStateName);
		});
	});

	describe("@Input() exampleTitle", () => {
		it("should change the exampleTitle according to the @Input", () => {
			renderHost((host) => {
				host.exampleTitle = "Test title";
			});

			const h3: HTMLHeadingElement = hostFixture.nativeElement.querySelector("mat-card-header h3");
			expect(h3.textContent).toContain(hostComponent.exampleTitle);
		});
	});

	describe("@Input() extensions", () => {
		it("should show the tabs when the file exist", () => {
			renderHost((host) => {
				host.extensions = ["CSS", "JS", "HTML", "SCSS", "TS"];
			});

			expect(component.exampleFiles.length).toBe(component.extensions.length);

			let tabs: NodeListOf<HTMLElement> = hostFixture.nativeElement.querySelectorAll('[role="tab"]');
			expect(tabs.length).toBe(0);

			const button: HTMLButtonElement = hostFixture.nativeElement.querySelector("mat-card-header button");
			button.click();
			hostFixture.detectChanges();

			tabs = hostFixture.nativeElement.querySelectorAll('[role="tab"]');
			expect(tabs.length).toBe(component.extensions.length);
		});
	});

	describe("@Input() id", () => {
		it("should not render an anchor when not set", () => {
			renderHost((host) => {
				host.id = "";
			});

			const anchorIcon = hostFixture.nativeElement.querySelector("mat-card-title a.anchor-link");
			expect(anchorIcon).toBeNull();
		});

		it("should render an anchor when set", () => {
			renderHost((host) => {
				host.id = "some-hash";
			});

			const anchorIcon = hostFixture.nativeElement.querySelector("mat-card-title a.anchor-link");
			expect(anchorIcon).not.toBeNull();
		});
	});

	describe("fetchExampleFiles()", () => {
		let addExampleFileSpy: ReturnType<typeof vi.fn<(file: ExampleFile) => void>>;

		beforeEach(() => {
			addExampleFileSpy = vi.spyOn(component, "addExampleFile") as unknown as ReturnType<typeof vi.fn<(file: ExampleFile) => void>>;
			fileService.fetchFile.mockReset();
			logger.error.mockClear();

			component.extensions = ["HTML", "TS", "CSS"];
		});

		it("should not do anything when the file doesn't exist", () => {
			fileService.fetchFile.mockReturnValue(throwError(() => "file does not exist"));
			expect(fileService.fetchFile).not.toHaveBeenCalled();
			component.fetchExampleFiles();
			expect(fileService.fetchFile).toHaveBeenCalledTimes(component.extensions.length);
			expect(logger.error).toHaveBeenCalledTimes(component.extensions.length);
			expect(addExampleFileSpy).not.toHaveBeenCalled();
		});

		it("should call addExampleFiles() when the file exists passing the data of the file and its metadata", () => {
			fileService.fetchFile.mockReturnValue(of("dummy file content"));
			component.fetchExampleFiles();
			expect(fileService.fetchFile).toHaveBeenCalledTimes(component.extensions.length);
			expect(addExampleFileSpy).toHaveBeenCalledTimes(component.extensions.length);

			component.extensions.forEach((extension: string, index: number) => {
				const exampleFile: ExampleFile = addExampleFileSpy.mock.calls[index][0] as ExampleFile;
				expect(exampleFile.data).toBeDefined();
				expect(exampleFile.extension).toBe(extension);
				expect(exampleFile.format).toBeDefined();
			});
		});

		it("should call the FileService passing the right url of the file including the base URL if any", () => {
			fileService.fetchFile.mockReturnValue(of("dummy file content"));
			component.filesPath = "dummy-example-file";
			component.appBaseHref = "";
			component.fetchExampleFiles();
			expect(fileService.fetchFile).toHaveBeenCalledTimes(component.extensions.length);

			component.extensions.forEach((extension: string, index: number) => {
				const filePath: string = fileService.fetchFile.mock.calls[index][0] as string;
				expect(filePath).toBe(component.examplesFolder + component.filesPath + "." + extension.toLowerCase());
			});

			fileService.fetchFile.mockReset();
			fileService.fetchFile.mockReturnValue(of("dummy file content"));
			component.appBaseHref = "mock-bae-href/";
			component.fetchExampleFiles();
			expect(fileService.fetchFile).toHaveBeenCalledTimes(component.extensions.length);

			component.extensions.forEach((extension: string, index: number) => {
				const filePath: string = fileService.fetchFile.mock.calls[index][0] as string;
				expect(filePath).toBe(
					component.appBaseHref + component.examplesFolder + component.filesPath + "." + extension.toLowerCase()
				);
			});
		});
	});

	describe("toggleSourceView()", () => {
		it("should toggle the showSource property", () => {
			component.showSource = true;
			component.toggleSourceView();
			expect(component.showSource).toBe(false);
			component.toggleSourceView();
			expect(component.showSource).toBe(true);
		});
	});
});
