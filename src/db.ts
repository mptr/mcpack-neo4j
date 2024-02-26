import neo4j, { Driver, RxSession } from "neo4j-driver";
import {
	from,
	tap,
	concat,
	Observable,
	concatMap,
	finalize,
	map,
	of,
} from "rxjs";
import { CurseForgePack } from "./entities/curse-forge-pack";
import { CurseForgeCategory } from "./entities/curse-forge-category";
import { CurseForgeMod } from "./entities/curse-forge-mod";
import { CurseForgeModFile } from "./entities/curse-forge-mod-file";

const constraints = {
	pack_slug_unique: [`p:${CurseForgePack.constructor.name}`, "p.slug"],
	author_unique: [
		`a:${CurseForgePack.AUTHOR_CYPHER_LABEL}`,
		"(a.id, a.name, a.username)",
	],
	pack_category_unique: [
		`pc:${CurseForgePack.PACK_CATEGORY_CYPHER_LABEL}`,
		"(pc.id, pc.slug)",
	],
	version_unique: [`v:${CurseForgePack.GAME_VERSION_CYPHER_LABEL}`, "v.name"],
	mod_unique: [`m:${CurseForgeMod.CYPHER_LABEL}`, "m.id"],
	file_unique: [`f:${CurseForgeModFile.CYPHER_LABEL}`, "f.id"],
};

export type Query = Parameters<RxSession["run"]>;

export class GraphDB {
	protected driver: Driver;

	constructor() {
		this.driver = neo4j.driver(
			"bolt://localhost:7687",
			neo4j.auth.basic("neo4j", "changeme")
		);
	}

	runAll(querySource: Observable<Query>) {
		const session = this.driver.rxSession();
		return querySource.pipe(
			tap(([query]) => {
				const q = query
					.split("\n")
					.map((line) => line.trim())
					// .join("\n           ")
					.join(" ")
					.replace(/;?$/g, ";");
				console.log("\x1b[30mrunning\x1b[0m > ", `\x1b[34m${q}\x1b[0m`);
			}),
			concatMap((params) => session.run(...params).records()),
			finalize(() => session.close())
		);
	}

	run(...args: Query) {
		return this.runAll(from([args]));
	}

	clear() {
		const constraintDrops = this.run(
			"SHOW CONSTRAINT YIELD * RETURN name"
		).pipe(
			map((result) => result.get("name") as string),
			map((name) => [`DROP CONSTRAINT ${name}`] as [string])
		);

		return this.runAll(
			concat(of(["MATCH (n) DETACH DELETE n"] as [string]), constraintDrops)
		);
	}

	applyConstraints() {
		const queries = from(Object.entries(constraints)).pipe(
			map(
				([name, [obj, key]]) =>
					[
						`CREATE CONSTRAINT ${name} IF NOT EXISTS FOR (${obj}) REQUIRE ${key} IS UNIQUE`,
					] as [string]
			)
		);
		return this.runAll(queries);
	}

	close() {
		return new Observable<void>((subscriber) => {
			this.driver.close().then(() => subscriber.complete());
		});
	}
}
