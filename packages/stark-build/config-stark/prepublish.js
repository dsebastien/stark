"use strict";
const spawnSync = require("child_process").spawnSync;

console.log("Login to publishConfig registry for publishing...");

spawnSync("npm", ["login", "--registry=http://REGISTRY-URL"], { stdio: "inherit", shell: true });

console.log("Starting to publish...");

/*

 Here are a list of variables that are needed to publish
 _auth=aBCdEFGhIjKlMnopQ==
 always-auth=true
 registry=http://REGISTRY-URL
 email=fooBar

*/
