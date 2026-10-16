import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [packageName, consumerName] = process.argv.slice(2);
const validPackages = new Set(
	fs
		.readFileSync(path.join(rootDirectory, "modules.txt"), "utf8")
		.split(/\r?\n/u)
		.map((entry) => entry.trim())
		.filter(Boolean)
);
const validConsumers = new Set(["showcase", "starter"]);

if (!validPackages.has(packageName) || !validConsumers.has(consumerName)) {
	process.stderr.write("Usage: node scripts/sync-built-package.mjs <stark-package> <showcase|starter>\n");
	process.exitCode = 1;
} else {
	const source = path.join(rootDirectory, "dist", "packages", packageName);
	const destination = path.join(rootDirectory, consumerName, "node_modules", "@nationalbankbelgium", packageName);
	if (!fs.existsSync(source)) {
		throw new Error(`Build output does not exist: ${source}`);
	}

	fs.rmSync(destination, { force: true, recursive: true });
	fs.mkdirSync(path.dirname(destination), { recursive: true });
	fs.cpSync(source, destination, { force: true, recursive: true });
	process.stdout.write(`Synchronized ${packageName} to ${consumerName}.\n`);
}
