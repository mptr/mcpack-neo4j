import {
	ReplaySubject,
	Subject,
	combineLatestWith,
	concat,
	count,
	defer,
	distinct,
	filter,
	map,
	merge,
	mergeMap,
	range,
	share,
	take,
	takeWhile,
	tap,
} from "rxjs";
import { GraphDB } from "./db";
import { CurseForgeMod } from "./entities/curse-forge-mod";
import { CurseForgePack } from "./entities/curse-forge-pack";
import {
	collectAllPagination,
	collectPagination,
	curseforgeApiUrl,
	waitForOtherComplete,
} from "./util";
import { CurseForgeModFile } from "./entities/curse-forge-mod-file";
import {
	CurseForgeCategory,
	getCategories,
} from "./entities/curse-forge-category";
import { CurseForgeVersion } from "./entities/curse-forge-version";

let gracefulShutdown = false;
// Catch ^C
process.on("SIGINT", () => {
	if (gracefulShutdown) {
		console.log("Forcing shutdown");
		process.exit(1);
	}
	console.log("Graceful shutdown");
	gracefulShutdown = true;
});

export const DbConnection = new GraphDB(
	CurseForgePack,
	CurseForgeMod,
	CurseForgeModFile,
	CurseForgeCategory,
	CurseForgeVersion,
);

const main = () => {
	// stores the list of mods that are already present in the database
	const presentModIds = new ReplaySubject<Set<number>>(1);
	CurseForgeMod.presentModIds().subscribe(presentModIds);

	const packs = concat(
		range(1, 1).pipe(
			collectPagination(
				(i) =>
					`${curseforgeApiUrl}search?gameId=432&index=${i}&classId=4471&pageSize=50&sortField=2`,
			),
		),
	).pipe(
		takeWhile(() => !gracefulShutdown),
		mergeMap((data) => new CurseForgePack(data).save()),
		tap((e) => console.log(`saved pack ${e.name}`)),
		share(),
	);

	const packCategories = packs.pipe(
		mergeMap((pack) =>
			pack.categories.map((category) => [pack, category] as const),
		),
		mergeMap(([pack, category]) => new CurseForgeCategory(category).save(pack)),
	);

	const packVersions = packs.pipe(
		mergeMap((pack) => new CurseForgeVersion(pack.gameVersion).save(pack)),
	);

	const mods = packs.pipe(
		collectAllPagination(CurseForgeMod.urlPaginator),
		waitForOtherComplete(presentModIds), // no not process any mods until we know which ones are already present
		// take while gracefulShutdown is not emitted
		takeWhile(() => !gracefulShutdown),
		mergeMap(([parent, data]) => new CurseForgeMod(data).save(parent)),
		tap((e) => console.log(`saved mod ${e.name}`)),
	);

	const newMods = mods.pipe(
		distinct((mod) => mod.id),
		combineLatestWith(presentModIds),
		filter(([value, filter]) => {
			const keep = !filter.has(value.id);
			console.log(
				keep ? `fully processing ${value.name}` : `skipping ${value.name}`,
			);
			return keep;
		}),
		map(([value, _]) => value),
		share(),
	);

	const modCategories = newMods.pipe(
		getCategories((mod) => `${mod.categoryClass.slug}/${mod.slug}`),
		mergeMap(([parent, data]) => new CurseForgeCategory(data).save(parent)),
	);

	const files = newMods.pipe(
		collectAllPagination(
			CurseForgeModFile.urlPaginator,
			(elm) =>
				// only process recently released files
				new Date(elm.dateCreated as string).getTime() >
				new Date("2023-06-07").getTime(),
		),

		mergeMap(([parent, data]) => new CurseForgeModFile(data).save(parent)),
	);

	const fileVersions = files.pipe(
		mergeMap((file) => file.gameVersions.map((v) => [file, v] as const)),
		mergeMap(([file, v]) => new CurseForgeVersion(v).save(file)),
	);

	// all the observables that are not being used are being merged here
	return merge(packCategories, packVersions, modCategories, fileVersions);
};

concat(
	DbConnection.clear(),
	DbConnection.applyConstraints(),
	defer(() =>
		main().pipe(
			count(),
			tap((count) => console.log(`Processed ${count} items`)),
		),
	),
	DbConnection.close(),
).subscribe();
