export function isSnapshotUpdateOption(argument) {
	return (
		argument === "-u" ||
		argument.startsWith("-u=") ||
		argument === "--update-snapshots" ||
		argument.startsWith("--update-snapshots=")
	);
}
