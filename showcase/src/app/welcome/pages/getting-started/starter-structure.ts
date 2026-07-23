export const starterStructure = `|
|       angular.json                                 # Angular build/serve configuration (define, dev-server headers, generated index input)
+---config
|       index-head-config.js                         # defines additional <head> tags injected into the generated index.html
|
+---src
|   |
|   +---app
|   |   |   app.component.scss                       # application base styles
|   |   |   app.component.html                       # application template
|   |   |   app.component.spec.ts                    # unit tests for the app component
|   |   |   app.component.ts                         # app root component and controller
|   |   |   app.module.ts                            # main application module (configures Angular module, ...)
|   |   |   app.routes.ts                            # root routing configuration
|   |   |   index.ts                                 # exports the app module
|   |   |   material-icons.config.ts                 # helper functions for the Material Design icons configuration
|   |   |   routes.config.ts                         # helper functions for the routing configuration
|   |   |   translation.config.ts                    # helper functions for the translations configuration
|   |   |   
|   |   +---foo	                                     # feature module (create a folder for each feature module)
|   |   |   |   module.ts                            # module definition (exports an NgModule)
|   |   |   |   routes.ts                            # routing configuration of this module
|   |   |   |   index.ts                             # barrel: re-export all module symbols
|   |   |   |
|   |   |   +---pages                                # smart components for this module
|   |   |   |   |   index.ts                         # barrel: re-export all smart components
|   |   |   |   |
|   |   |   |   +---foo-page                         # example smart component
|   |   |   |   |       foo-page.component.scss      # styles for this smart component
|   |   |   |   |       foo-page.component.html      # template for this smart component
|   |   |   |   |       foo-page.component.spec.ts   # unit tests for this smart component
|   |   |   |   |       foo-page.component.ts        # component class for this smart component
|   |   |   |   |       index.ts                     # barrel: re-export the smart component
|   |   |   |   |
|   |   |   |   \\--...
|   |   |   |
|   |   |   +---components                           # dumb components for this module
|   |   |   |   |   index.ts                         # barrel: re-export all dumb components
|   |   |   |   |
|   |   |   |   +---baz                              # example dumb component
|   |   |   |   |       baz.component.css            # styles for this dumb component
|   |   |   |   |       baz.component.html           # template for this dumb component
|   |   |   |   |       baz.component.spec.ts        # unit tests for this dumb component
|   |   |   |   |       baz.component.ts             # component class for this dumb component
|   |   |   |   |
|   |   |   |   \\--...
|   |   |   |
|   |   |   +---actions                              # NGRX actions utility classes for this module
|   |   |   |       index.ts                         # barrel: re-export all actions
|   |   |   |       foo.actions.ts                   # defines Foo action types and all Foo related action classes
|   |   |   |       ...
|   |   |   |
|   |   |   +---effects                              # NGRX effects: classes that handle specific actions and react to those
|   |   |   |       index.ts                         # barrel: re-export all effects
|   |   |   |       foo.effects.ts                   # effects class that in reaction to actions it can interact with other services, dispatch other actions, ...
|   |   |   |       foo.effects.spec.ts              # unit tests for this effects class
|   |   |   |       ...
|   |   |   |
|   |   |   +---entities                             # domain model entities of this module
|   |   |   |       index.ts                         # barrel: re-export all entities
|   |   |   |       foo.entity.ts                    # entity definition
|   |   |   |       ...
|   |   |   |
|   |   |   +---reducers                             # NGRX reducers for this module
|   |   |   |       index.ts                         # defines the state sub-tree for this module, the state selector and the reducers in charge of updating this state sub-tree
|   |   |   |       foo.reducer.ts                   # reducer that updates the application state sub-tree for this module based on actions
|   |   |   |       foo.reducer.spec.ts              # unit tests for this reducer
|   |   |   |
|   |   |   +---repositories                         # DAOs of this module
|   |   |   |       index.ts                         # barrel: re-export all repositories
|   |   |   |       foo.repository.ts                # repository class implementation to communicate with the backend 
|   |   |   |       foo.repository.spec.ts           # unit tests for this repository class 
|   |   |   |       ...
|   |   |   |
|   |   |   \\---services                             # services of this module
|   |   |           index.ts                         # barrel: re-export all services
|   |   |           foo.service.ts                   # service class implementation
|   |   |           foo.service.spec.ts              # unit tests for this service class implementation
|   |   |           ...
|   |   |
|   |   \\--...
|   |
|   +---assets                          # static assets (fonts, images, translations, ...)
|   |   |
|   |   +---fonts                       # application-specific fonts
|   |   |   ...
|   |   |
|   |   +---images                      # application-specific images
|   |   |   |
|   |   |   +---app-icons               # application icons for mobile devices
|   |   |   |   ...
|   |   |   |
|   |   |   +---touch                   # touch icons for mobile devices
|   |   |   |   ...
|   |   |   |
|   |   |   \\--...
|   |   |
|   |   +---mock-data                   # data to mock backend responses
|   |   |       mock-data.json          # JSON file containing all mock data
|   |   |
|   |   +---translations                # application-specific translations
|   |           en.json                 # English
|   |           fr.json                 # French
|   |           nl.json                 # Dutch
|   |
|   |
|   +---assets-base                     # static assets that will be copied to the root of the application
|   |       browserconfig.xml           # application icons for Windows mobile devices
|   |       crossdomain.xml             # cross domain policies
|   |       favicon.ico                 # icon for bookmarks bar
|   |       humans.txt                  # contains information about the website (http://humanstxt.org/)
|   |       manifest.json               # application icons for Android mobile devices
|   |       robots.txt                  # the robots exclusion protocol (http://www.robotstxt.org/)
|   |       service-worker.js           # support for building Progressive Web Applications (PWA) with Service Workers
|   |
|   +---environments                    # configuration variables for each environment
|   |       environment.hmr.ts          # development with Angular dev-server HMR configuration
|   |       environment.prod.ts         # production environment configuration
|   |       environment.ts              # development environment configuration
|   |
|   +---styles                          # application-specific styles
|   |       ...
|   |
|   |   custom-typings.d.ts             # add your own type definitions that can't be found in the registry in this file
|   |   index.html                      # the main HTML page that is served when someone visits this site
|   |   main.browser.ts                 # main bundle entry point, Angular bootstrapping
|   |   polyfills.browser.ts            # polyfills needed by old browsers if needed. Should be loaded before the app
|   |   stark-app-config.json           # Stark configuration
|   \\   stark-app-metadata.json         # Stark application metadata like: name, description, version...
|
|   .dockerignore                       # files and directories to be excluded by the Docker build
|   .gitignore                          # files and directories to be excluded by git
|   .prettierignore                     # files and directories to be excluded by prettier
|   .prettierrc.js                      # prettier configuration file
|   .stylelintrc                        # stylelint configuration file
|   .travis.yml                         # YAML file to customize the Travis build (https://travis-ci.org/)
|   angular.json                        # Angular configuration file
|   base.vitest.spec.ts                 # initializes the Vitest test environment
|   Dockerfile                          # the commands that will be executed by the Docker Build command
|   package.json                        #
|   README.md                           # this document
|   tsconfig.app.json                   # typescript configuration for the application, extends tsconfig.json
|   tsconfig.json                       # typescript configuration, extends tsconfig.json from Stark-Build
|   tsconfig.spec.json                  # typescript configuration for the Vitest unit tests, extends tsconfig.json
\\   tslint.json                         # tslint configuration file`;

export const stylesheetImport = `|
+---src
|   |
|   +---app
|   |       ...
|   \\--styles                      # application-specific styles
|          styles.scss             # import all application styles as well as all external stylesheets`;

export const stylesCss = `
@import "~basscss/css/basscss.css";  /* 3rd party library */

@import "theme";
@import "stark-styles.scss";
@import "../app/app.component.scss";
`;

export const starkStylesCss = `
/* Stark styles */
@import "~@nationalbankbelgium/stark-ui/assets/styles/header";

/* Stark components */
@import "~@nationalbankbelgium/stark-ui/src/modules/app-logo/components/app-logo-theme";
@import "~@nationalbankbelgium/stark-ui/src/modules/app-logo/components/app-logo.component";
@import "~@nationalbankbelgium/stark-ui/src/modules/app-footer/components/app-footer.component";
@import "~@nationalbankbelgium/stark-ui/src/modules/app-footer/components/app-footer-theme";
@import "~@nationalbankbelgium/stark-ui/src/modules/app-menu/components/app-menu-theme";


/* Stark session-ui pages */
@import "~@nationalbankbelgium/stark-ui/src/modules/session-ui/pages/login/login-page.component";
@import "~@nationalbankbelgium/stark-ui/src/modules/session-ui/pages/preloading/preloading-page.component";
`;

export const polyfillsBrowsersContent = `
/**
 * This file includes application polyfills and is loaded before the app.
 * You can add your own extra polyfills to this file.
 *
 * This file is divided into 2 sections:
 *   1. Optional browser polyfills for APIs your application explicitly uses.
 *   2. Application imports that should be loaded before your main file.
 *
 * Angular 22 targets supported modern browsers through Angular CLI and Browserslist.
 * Learn more in https://angular.dev/reference/versions#browser-support
 */

/***************************************************************************************************
 * OPTIONAL BROWSER POLYFILLS
 */

// import "core-js/actual/structured-clone";

/***************************************************************************************************
 * Zone JS is required by this Stark setup.
 */
import "zone.js";
// async stack traces with zone.js included for dev
// import 'zone.js/plugins/long-stack-trace-zone'
`;

export const polyfillsAngularJsonAdaptation = `{
 "projects": {
    "starter": {
        ...
        "architect": {
            "build": {
                ...
                "options": {
                    ...
                    "polyfills": "src/polyfills.browser.ts"
                    ...
                }
            }
        }
    }
}
`;
