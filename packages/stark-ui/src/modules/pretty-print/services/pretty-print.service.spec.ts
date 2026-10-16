import { StarkLoggingService } from "@nationalbankbelgium/stark-core";
import { firstValueFrom } from "rxjs";
import { vi } from "vitest";
import { StarkPrettyPrintFormat } from "../types";
import { StarkPrettyPrintService } from "./pretty-print.service.intf";
import { StarkPrettyPrintServiceImpl } from "./pretty-print.service";

type LoggingServiceMock = {
	debug: ReturnType<typeof vi.fn>;
	error: ReturnType<typeof vi.fn>;
	warn: ReturnType<typeof vi.fn>;
};

describe("PrettyPrintService", () => {
	let prettyPrintService: StarkPrettyPrintService;

	const classTokenSelector = 'class="token selector"';
	const classTokenFunction = 'class="token function"';
	const classTokenKeyword = 'class="token keyword"';
	const classTokenProperty = 'class="token property"';
	const marginBottom = "margin-bottom";

	beforeEach(() => {
		prettyPrintService = new StarkPrettyPrintServiceImpl(createLoggerMock() as unknown as StarkLoggingService);
	});

	describe("xml", () => {
		const rawXmlData = [
			'<menu id="file" value="File"><menuitem value="New" onclick="CreateNewDoc()" />',
			'<menuitem value="Open" onclick="OpenDoc()" />',
			'<menuitem value="Close" onclick="CloseDoc()" /></menu>'
		].join("");

		const formattedXmlData = [
			'<menu id="file" value="File">',
			'  <menuitem value="New" onclick="CreateNewDoc()" />',
			'  <menuitem value="Open" onclick="OpenDoc()" />',
			'  <menuitem value="Close" onclick="CloseDoc()" />',
			"</menu>",
			""
		].join("\n");

		it("should nicely format raw XML data", async () => {
			await expect(formatData(rawXmlData, "xml")).resolves.toBe(formattedXmlData);
		});

		it("should nicely format and highlight raw XML data", async () => {
			const formattedData = await formatData(rawXmlData, "xml", true);

			expect(formattedData).toContain("class='language-markup'");
			expect(formattedData).toContain('class="token tag"');
			expect(formattedData).toContain("<span");
			expect(formattedData).toContain("menu");
			expect(formattedData).toContain("CreateNewDoc");
			expect(formattedData).toContain("menuitem");
			expect(formattedData).not.toBe(formattedXmlData);
		});
	});

	describe("html", () => {
		const rawHtmlData = [
			"<!DOCTYPE html><html><head>",
			"<style>body {background-color: powderblue;}h1{color: blue;}flashy{color: red;}</style>",
			"</head><body><h1>This is a heading</h1>",
			'<p class="flashy">This is a flashy paragraph.</p>',
			"</body></html>"
		].join("");

		const formattedHtmlData = [
			"<!DOCTYPE html>",
			"<html>",
			"  <head>",
			"    <style>",
			"      body {",
			"        background-color: powderblue;",
			"      }",
			"      h1 {",
			"        color: blue;",
			"      }",
			"      flashy {",
			"        color: red;",
			"      }",
			"    </style>",
			"  </head>",
			"  <body>",
			"    <h1>This is a heading</h1>",
			'    <p class="flashy">This is a flashy paragraph.</p>',
			"  </body>",
			"</html>",
			""
		].join("\n");

		const rawAngularHtmlData = [
			"<!DOCTYPE html><html><head>",
			"<style>body {background-color: powderblue;}h1{color: blue;}flashy{color: red;}</style>",
			"</head><body><h1>This is a {{heading|uppercase}}</h1>",
			'<p class="flashy">This is a flashy paragraph.</p>',
			'<button class="dummy-class" [class.active]="isActive" color="primary" (click)=triggerAction($event)>Click me</button>',
			"</body></html>"
		].join("");

		const formattedAngularHtmlData = [
			"<!DOCTYPE html>",
			"<html>",
			"  <head>",
			"    <style>",
			"      body {",
			"        background-color: powderblue;",
			"      }",
			"      h1 {",
			"        color: blue;",
			"      }",
			"      flashy {",
			"        color: red;",
			"      }",
			"    </style>",
			"  </head>",
			"  <body>",
			"    <h1>This is a {{ heading | uppercase }}</h1>",
			'    <p class="flashy">This is a flashy paragraph.</p>',
			"    <button",
			'      class="dummy-class"',
			'      [class.active]="isActive"',
			'      color="primary"',
			'      (click)="triggerAction($event)"',
			"    >",
			"      Click me",
			"    </button>",
			"  </body>",
			"</html>",
			""
		].join("\n");

		it("should nicely format raw HTML data", async () => {
			await expect(formatData(rawHtmlData, "html")).resolves.toBe(formattedHtmlData);
		});

		it("should nicely format raw Angular HTML data", async () => {
			await expect(formatData(rawAngularHtmlData, "html")).resolves.toBe(formattedAngularHtmlData);
		});

		it("should nicely format and highlight raw HTML data", async () => {
			const formattedData = await formatData(rawHtmlData, "html", true);

			expect(formattedData).toContain("class='language-markup'");
			expect(formattedData).toContain('class="token tag"');
			expect(formattedData).toContain("<p");
			expect(formattedData).toContain("flashy");
			expect(formattedData).not.toBe(formattedHtmlData);
		});
	});

	describe("CSS", () => {
		const rawCssData = [
			"body{background: #D2DA9C url(leftcolbg.jpg)repeat-y left top;color: #FFF;}",
			"p{margin-bottom:1em}ul{margin-left:20px;margin-bottom:1em}"
		].join("");

		const formattedCssData = [
			"body {",
			"  background: #d2da9c url(leftcolbg.jpg) repeat-y left top;",
			"  color: #fff;",
			"}",
			"p {",
			"  margin-bottom: 1em;",
			"}",
			"ul {",
			"  margin-left: 20px;",
			"  margin-bottom: 1em;",
			"}\n"
		].join("\n");

		it("should nicely format raw CSS data", async () => {
			await expect(formatData(rawCssData, "css")).resolves.toBe(formattedCssData);
		});

		it("should simply display the unformatted raw CSS data in case it is not valid CSS", async () => {
			const invalidRawCssData = rawCssData + "}";
			await expect(formatData(invalidRawCssData, "html")).rejects.toBe(invalidRawCssData);
		});

		it("should nicely format and highlight raw CSS data ", async () => {
			const formattedData = await formatData(rawCssData, "css", true);

			expect(formattedData).toContain("class='language-css'");
			expect(formattedData).toContain(classTokenSelector);
			expect(formattedData).toContain("<span");
			expect(formattedData).toContain("background");
			expect(formattedData).toContain("color");
			expect(formattedData).toContain(marginBottom);
		});
	});

	describe("SCSS", () => {
		const rawScssData = [
			"$font-stack: Helvetica, sans-serif; $primary-color: #333; body { font: 100% $font-stack; color: $primary-color; }"
		].join("");

		const formattedScssData = [
			"$font-stack: Helvetica, sans-serif;",
			"$primary-color: #333;",
			"body {",
			"  font: 100% $font-stack;",
			"  color: $primary-color;",
			"}\n"
		].join("\n");

		it("should nicely format raw SCSS data", async () => {
			await expect(formatData(rawScssData, "scss")).resolves.toBe(formattedScssData);
		});

		it("should simply display the unformatted raw SCSS data in case it is not valid SCSS", async () => {
			const invalidRawScssData = rawScssData + "}";
			await expect(formatData(invalidRawScssData, "scss")).rejects.toBe(invalidRawScssData);
		});

		it("should nicely format and highlight raw SCSS data ", async () => {
			const formattedData = await formatData(rawScssData, "scss", true);

			expect(formattedData).toContain("class='language-scss'");
			expect(formattedData).toContain(classTokenSelector);
			expect(formattedData).toContain("<span");
			expect(formattedData).toContain("$primary-color");
			expect(formattedData).toContain("$font-stack");
			expect(formattedData).toContain("Helvetica");
		});
	});

	describe("SQL", () => {
		const rawSqlData = [
			"SELECT DISTINCT Name FROM Production.Product AS p WHERE EXISTS (SELECT * ",
			"FROM Production.ProductModel AS pm WHERE p.ProductModelID = pm.ProductModelID ",
			"AND pm.Name LIKE 'Long-Sleeve Logo Jersey%')"
		].join("");

		const formattedSqlData = [
			"SELECT DISTINCT Name",
			"FROM Production.Product AS p",
			"WHERE EXISTS (",
			"    SELECT *",
			"    FROM Production.ProductModel AS pm",
			"    WHERE p.ProductModelID = pm.ProductModelID",
			"      AND pm.Name LIKE 'Long-Sleeve Logo Jersey%'",
			"  )"
		].join("\n");

		it("should nicely format raw SQL data", async () => {
			await expect(formatData(rawSqlData, "sql")).resolves.toBe(formattedSqlData);
		});

		it("should nicely format and highlight raw SQL data ", async () => {
			const formattedData = await formatData(rawSqlData, "sql", true);

			expect(formattedData).toContain("class='language-sql'");
			expect(formattedData).toContain(classTokenKeyword);
			expect(formattedData).toContain("<span");
			expect(formattedData).toContain("SELECT");
			expect(formattedData).toContain("FROM");
			expect(formattedData).toContain("WHERE");
		});
	});

	describe("JSON", () => {
		const rawJsonData = [
			'{"menu": { "id": "file", "value": "File",',
			'"menuitem": [{"value": "New", "onclick": "CreateNewDoc()"},',
			'{"value": "Open", "onclick": "OpenDoc()"},',
			'{"value": "Close", "onclick": "CloseDoc()"}]}}'
		].join("");

		const formattedJsonData = [
			"{",
			'  "menu": {',
			'    "id": "file",',
			'    "value": "File",',
			'    "menuitem": [',
			'      { "value": "New", "onclick": "CreateNewDoc()" },',
			'      { "value": "Open", "onclick": "OpenDoc()" },',
			'      { "value": "Close", "onclick": "CloseDoc()" }',
			"    ]",
			"  }",
			"}\n"
		].join("\n");

		it("should nicely format raw JSON data", async () => {
			await expect(formatData(rawJsonData, "json")).resolves.toBe(formattedJsonData);
		});

		it("should simply display the unformatted raw JSON data in case it is not valid JSON", async () => {
			const invalidRawJsonData = rawJsonData.replace(":", "oops");
			await expect(formatData(invalidRawJsonData, "json")).rejects.toBe(invalidRawJsonData);
		});

		it("should nicely format and highlight raw JSON data ", async () => {
			const formattedData = await formatData(rawJsonData, "json", true);

			expect(formattedData).toContain("class='language-json'");
			expect(formattedData).toContain(classTokenProperty);
			expect(formattedData).toContain("<span");
			expect(formattedData).toContain("menu");
			expect(formattedData).toContain("CreateNewDoc");
			expect(formattedData).toContain("menuitem");
		});
	});

	describe("JavaScript", () => {
		const rawJavascriptData = [
			"function calculateData(seed, operationFn) {",
			"var data = operationFn(seed);",
			"if (!data){",
			"data = 'could not calculate data';",
			"}",
			"return data;",
			"}"
		].join("");

		const formattedJavascriptData = [
			"function calculateData(seed, operationFn) {",
			"  var data = operationFn(seed);",
			"  if (!data) {",
			'    data = "could not calculate data";',
			"  }",
			"  return data;",
			"}\n"
		].join("\n");

		it("should nicely format raw javascript data", async () => {
			await expect(formatData(rawJavascriptData, "javascript")).resolves.toBe(formattedJavascriptData);
		});

		it("should simply display the unformatted raw javascript data in case it is not valid javascript", async () => {
			const invalidRawJavascriptData = rawJavascriptData + "}";
			await expect(formatData(invalidRawJavascriptData, "javascript")).rejects.toBe(invalidRawJavascriptData);
		});

		it("should nicely format and highlight raw JavaScript data ", async () => {
			const formattedData = await formatData(rawJavascriptData, "javascript", true);

			expect(formattedData).toContain("class='language-javascript'");
			expect(formattedData).toContain(classTokenKeyword);
			expect(formattedData).toContain("<span");
			expect(formattedData).toContain(classTokenFunction);
			expect(formattedData).toContain("calculateData");
			expect(formattedData).toContain("var");
			expect(formattedData).toContain("operationFn");
			expect(formattedData).toContain("seed");
			expect(formattedData).toContain("return");
		});
	});

	describe("TypeScript", () => {
		const rawTypescriptData = [
			"function calculateData(seed:any, operationFn:Function):any {",
			"var data:any = operationFn(seed);",
			"if (!data){",
			"data = 'could not calculate data';",
			"}",
			"return data;",
			"}"
		].join("");

		const formattedTypescriptData = [
			"function calculateData(seed: any, operationFn: Function): any {",
			"  var data: any = operationFn(seed);",
			"  if (!data) {",
			'    data = "could not calculate data";',
			"  }",
			"  return data;",
			"}\n"
		].join("\n");

		it("should nicely format raw typescript data", async () => {
			await expect(formatData(rawTypescriptData, "typescript")).resolves.toBe(formattedTypescriptData);
		});

		it("should nicely format and highlight raw TypeScript data ", async () => {
			const formattedData = await formatData(rawTypescriptData, "typescript", true);

			expect(formattedData).toContain("class='language-typescript'");
			expect(formattedData).toContain(classTokenKeyword);
			expect(formattedData).toContain("<span");
			expect(formattedData).toContain(classTokenFunction);
			expect(formattedData).toContain("calculateData");
			expect(formattedData).toContain("var");
			expect(formattedData).toContain("operationFn");
			expect(formattedData).toContain("seed");
			expect(formattedData).toContain("return");
		});
	});

	function formatData(data: string, format: StarkPrettyPrintFormat, highlightingEnabled = false): Promise<string> {
		return firstValueFrom(prettyPrintService.format(data, format, highlightingEnabled));
	}
});

function createLoggerMock(): LoggingServiceMock {
	return {
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn()
	};
}
