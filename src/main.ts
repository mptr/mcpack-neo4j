import { concat, concatMap, lastValueFrom, mergeMap, range, tap } from "rxjs";
import { GraphDB } from "./db";
import { CurseForgeMod } from "./entities/curse-forge-mod";
import { CurseForgePack } from "./entities/curse-forge-pack";
import {
	collectAllPagination,
	collectPagination,
	curseforgeApiUrl,
} from "./util";
import { CurseForgeModFile } from "./entities/curse-forge-mod-file";
import {
	CurseForgeCategory,
	getCategories,
} from "./entities/curse-forge-category";
import { CurseForgeVersion } from "./entities/curse-forge-version";
import { ProgressTree } from "./logging/progress-tree";

export const DbConnection = new GraphDB(
	CurseForgePack,
	CurseForgeMod,
	CurseForgeModFile,
	CurseForgeCategory,
	CurseForgeVersion,
);

const presentModIds = await CurseForgeMod.presentModIds();

const main = async () => {
	// stores the list of mods that are already present in the database

	const progressTree = new ProgressTree("CurseForge");
	progressTree.show();

	const packs = concat(
		range(1, 1).pipe(
			collectPagination(
				(i) =>
					`${curseforgeApiUrl}search?gameId=432&index=${i}&classId=4471&pageSize=50&sortField=2`,
			),
		),
	);

	const packsProcessed = packs.pipe(
		// do mergeMap to process each pack concurrently
		concatMap((p) => processPack(p, progressTree)),
	);
	await lastValueFrom(packsProcessed);
};

const processPack = async (
	p: Record<string, unknown>,
	progressTree: ProgressTree,
) => {
	const pack = await new CurseForgePack(p).save();

	const packTask = progressTree.addChildTask(pack.name);

	await Promise.all([
		...pack.categories.map((category) =>
			new CurseForgeCategory(category).save(pack),
		),
		new CurseForgeVersion(pack.gameVersion).save(pack),
	]);

	const modsProcessed = collectAllPagination(
		pack,
		CurseForgeMod.urlPaginator,
	).pipe(mergeMap((m) => processMod(m, pack, packTask)));
	await lastValueFrom(modsProcessed);

	packTask.done();
};

const processMod = async (
	m: Record<string, unknown>,
	pack: CurseForgePack,
	packTask: ProgressTree,
) => {
	const modTask = packTask.addChildTask(m?.name + "");
	const mod = await new CurseForgeMod(m).save(pack);

	if (presentModIds.has(mod.id)) {
		modTask.meta = "skipped";
		modTask.done();
		return;
	}

	const categories = getCategories(
		mod,
		(item) => `${item.categoryClass.slug}/${item.slug}`,
	).pipe(
		mergeMap((data) => new CurseForgeCategory(data).save(mod)),
		tap(() => modTask.increaseTaskCounter()),
	);
	await lastValueFrom(categories);

	const files = collectAllPagination(
		mod,
		CurseForgeModFile.urlPaginator,
		(elm) =>
			// only process recently released files
			new Date(elm.dateCreated as string).getTime() >
			new Date("2023-06-07").getTime(),
	)
		.pipe(mergeMap((data) => new CurseForgeModFile(data).save(mod)))
		.pipe(
			mergeMap((file) => file.gameVersions.map((v) => [file, v] as const)),
			mergeMap(async ([file, v]) => {
				await new CurseForgeVersion(v).save(file);
				modTask.increaseTaskCounter();
			}),
		);
	await lastValueFrom(files, { defaultValue: null });

	await mod.markDone();

	modTask.done();
};

const mgmtSession = DbConnection.getSession();
// await mgmtSession.clear();
// await mgmtSession.applyConstraints();
await main();
await mgmtSession.close();
await DbConnection.driver.close();
