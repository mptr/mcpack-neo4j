import { concat, defer, map, mergeMap, of, range, take, tap } from "rxjs";
import { GraphDB } from "./db";
import {
	collectAllPagination,
	collectPagination,
	curseforgeApiUrl,
} from "./util";
import { CurseForgePack } from "./entities/curse-forge-pack";
import { CurseForgeMod } from "./entities/curse-forge-mod";
import { CurseForgeModFile } from "./entities/curse-forge-mod-file";
import { Parent, processEntity } from "./entities/base";

export const DbConnection = new GraphDB();

const main = () => {
	const packs = concat(
		range(1, 1).pipe(
			collectPagination(
				(i) =>
					`${curseforgeApiUrl}search?gameId=432&index=${i}&classId=4471&pageSize=50&sortField=2`
			)
		)
	).pipe(processEntity(CurseForgePack));

	const mods = packs.pipe(
		map((pack) => new Parent(pack.id, CurseForgePack.CYPHER_LABEL, "CONTAINS")),
		collectAllPagination(CurseForgeMod.urlPaginator),
		processEntity(CurseForgeMod)
	);

	return mods;

	// const categories = mods.pipe();

	// const files = mods.pipe(
	// 	map((mod) => ({
	// 		cypherLabel: "CurseForgeMod",
	// 		relationName: "HAS",
	// 		id: mod.id,
	// 	})),
	// 	collectAllPagination(CurseForgeModFile.urlPaginator),
	// 	processEntity(CurseForgeModFile)
	// );

	// return of();
};

concat(
	DbConnection.clear(),
	DbConnection.applyConstraints(),
	defer(() => main()),
	DbConnection.close()
).subscribe();
