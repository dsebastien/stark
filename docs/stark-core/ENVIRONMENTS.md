# Environments support

Stark provides 2 different ways to get environment information depending on your needs:

- at runtime by importing the environment.ts file
- at compilation time by checking the global/ambient variables set by the build configuration

## Environment information at runtime (environment.ts)

Stark provides the `StarkEnvironment` interface that describes which information you can get from the current environment.
It follows Angular's current guidance for [application environments](https://angular.dev/tools/cli/environments) and the dev-server [HMR configuration](https://angular.dev/cli/serve).

Such environment interface is defined as follows:

```typescript
import { NgModuleRef } from "@angular/core";

export interface StarkEnvironment {
  /**
   * Whether the current environment is production (as described in Angular docs)
   * @link https://angular.dev/tools/cli/environments
   */
  production: boolean;
  /**
   * Whether the current environment has Angular dev-server Hot Module Replacement enabled
   * @link https://angular.dev/cli/serve
   */
  hmr: boolean;
  /**
   * Array of providers to be included only in this environment.
   * For example: you might want to add a detailed logging provider only in development.
   */
  ENV_PROVIDERS: any[];
  /**
   * Function to modify/decorate the NgModule Instance created by Angular for a given platform.
   * Useful to enable/disable some Angular specifics such as the debug tools.
   * @param moduleRef - NgModule instance created by Angular for a given platform.
   */
  decorateModule(moduleRef: NgModuleRef<any>): NgModuleRef<any>;
}
```

In your project, the files to define the different environments will be located in `src/environments`:

```txt
|
+---src
|   |
|   +---environments                    # configuration variables for each environment
|   |   |                               #
|   |   |   environment.hmr.ts          # development with Angular dev-server HMR configuration
|   |   |   environment.prod.ts         # production configuration
|   |   \   environment.ts              # development configuration
|   |
|   \   ...
|
\   ...
```

Then in each file, an `environment` constant of type `StarkEnvironment` should be exported providing the values needed for each environment:

```typescript
// environment.prod.ts

import { NgModuleRef } from "@angular/core";
import { StarkEnvironment } from "@nationalbankbelgium/stark-core";

export const environment: StarkEnvironment = {
  production: true,
  hmr: false,
  ENV_PROVIDERS: [ProductionOnlyProvider],

  decorateModule(moduleRef: NgModuleRef<any>): NgModuleRef<any> {
    // perform any module customization needed for this specific environment here
    // and make sure to invoke this function by passing it the NgModule created by Angular
    return moduleRef;
  }
};
```

When `hmr` is enabled, Angular's dev server now handles the runtime HMR wiring. Stark no longer requires the older Webpack-specific `module.hot` bootstrap path.

### How to get environment variables in your application?

All you have to do is to import the `environment.ts` constant anywhere you want in your application.

**You should always import from `environments/environment` because the Angular build system will internally replace such file with the right environment file as defined in the `fileReplacements` option in the `angular.json` file.**

This way, you will be able to programmatically read the different environment variables you need.
For example, you can determine which providers you will include for a specific environment in your AppModule:

```typescript
import { NgModule } from "@angular/core";
// the environment file should always be imported from this path
import { environment } from "environments/environment";

@NgModule({
	bootstrap: [AppComponent],
	declarations: [AppComponent],
	imports: [...],
	providers: [
		environment.ENV_PROVIDERS,
		...
	]
})
export class AppModule { ... }
```

You can also determine on which environment your app is currently running with this simple check:

```typescript
// the environment file should always be imported from this path
import { environment } from "environments/environment";

// if true, your app is running in production environment
if (environment.production) {
  /* the code in this block will be executed only in production */
}
```

### How to add a new environment?

First, create your new environment.ts file in the `src/environments` folder.

Then, make sure your new environment implements the `StarkEnvironment` interface. For example, the `environment.dummy-env.ts` file:

```typescript
import { NgModuleRef } from "@angular/core";
import { StarkEnvironment } from "@nationalbankbelgium/stark-core";

export const environment: StarkEnvironment = {
  production: false / true,
  hmr: false,
  ENV_PROVIDERS: [],

  decorateModule(moduleRef: NgModuleRef<any>): NgModuleRef<any> {
    // perform any module customization needed for this specific environment here
    // and make sure to invoke this function by passing it the NgModule created by Angular
    return moduleRef;
  }
};
```

Finally, define the file replacement of your new environment in the `angular.json` file so that the Angular build system can replace the default file `environments/environment` with your new file:

```text
{
    ...
    "dummyEnv": {
        "fileReplacements": [
            {
                "replace": "src/environments/environment.ts",
                "with": "src/environments/environment.dummy-env.ts"
            }
        ]
    }
}
```

### How to add more properties to the environment file?

In case you want to add more properties, you should first create your own interface which should extend the `StarkEnvironment` interface.
For example:

```typescript
import { StarkEnvironment } from "@nationalbankbelgium/stark-core";

export interface YourOwnEnvironment extends StarkEnvironment {
  someProperty: any;
}
```

Then adapt the different environment files to add the new properties:

```typescript
import { NgModuleRef } from "@angular/core";
import { StarkEnvironment } from "@nationalbankbelgium/stark-core";

export const environment: StarkEnvironment = {
  production: false / true,
  hmr: false,
  ENV_PROVIDERS: [],
  someProperty: "some value", // your new property

  decorateModule(moduleRef: NgModuleRef<any>): NgModuleRef<any> {
    // perform any module customization needed for this specific environment here
    // and make sure to invoke this function by passing it the NgModule created by Angular
    return moduleRef;
  }
};
```

## Environment information at compilation time (build-time global variables)

Stark exposes `ENV` and `HMR` as build-time globals.
In the Angular 22 path validated in this repository, those globals are injected through the native Angular `define` option.
See the [Stark 13 migration guide](../MIGRATION_GUIDE_STARK_13.md#define-env-and-hmr-without-webpack) for the supported downstream configuration.

### Why do you need the target environment at compilation time?

Sometimes you might need to add some logic or import some files only when your application is running in development or production.

**In this case, when the application is built, the final bundle will contain also that code and/or imports that will only be used on a specific environment.
For example, the specific code related to development will never be executed in production and yet it will be included in your production build which will increase the size of your bundle.**

This is why knowing the target environment at compilation time is useful. You can put the logic inside an if block and then such code will be tree-shaken during the build once the global is replaced with a literal value:

```typescript
// this check is translated to "if (false)" when ENV is "production"
// allowing the build optimizer to identify it as dead code and so remove it
if (ENV === "development") {
  /* the code inside this block will only be included in development */
}
```
