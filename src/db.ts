import neo4j, { Driver } from "neo4j-driver";
import {
	from,
	tap,
	concat,
	Observable,
	concatMap,
	finalize,
	map,
	of,
	retry,
} from "rxjs";

export class Query {
	constructor(
		public readonly query: string,
		public readonly params: Record<string, unknown> = {},
	) {}
	get asArray(): [string, Record<string, unknown>] {
		return [this.query, this.params];
	}
}

type StaticUniqueConstrained = {
	readonly name: string;
	readonly uniqueConstraints: [string, string][];
};

export class GraphDB {
	protected driver: Driver;

	private readonly entities: StaticUniqueConstrained[];

	constructor(...entities: StaticUniqueConstrained[]) {
		this.entities = entities;
		this.driver = neo4j.driver(
			"bolt://localhost:7687",
			neo4j.auth.basic("neo4j", "changeme"),
			{
				connectionAcquisitionTimeout: 10 * 60 * 1000, // 10 minutes
				maxTransactionRetryTime: 10 * 60 * 1000, // 15 minutes
			},
		);
	}

	runAll(querySource: Observable<Query>) {
		const session = this.driver.rxSession();
		return querySource.pipe(
			tap(({ query, params }) => {
				const q = query
					.split("\n")
					.map((line) => line.trim())
					// .join("\n           ")
					.join(" ")
					.replace(/;?$/g, ";");
				// console.log("\x1b[30mrunning\x1b[0m  > ", `\x1b[34m${q}\x1b[0m`);
			}),
			map((query) => query.asArray),
			concatMap((params) =>
				session
					.run(...params)
					.records()
					.pipe(retry({ count: 3, delay: 1000 })),
			),
			finalize(() => session.close()),
		);
	}

	run(...args: Query[]) {
		return this.runAll(from(args));
	}

	clear() {
		const constraintDrops = this.run(
			new Query("SHOW CONSTRAINT YIELD * RETURN name"),
		).pipe(
			map((result) => result.get("name") as string),
			map((name) => new Query(`DROP CONSTRAINT ${name}`)),
		);

		return this.runAll(
			concat(of(new Query("MATCH (n) DETACH DELETE n")), constraintDrops),
		);
	}

	applyConstraints() {
		const queries = this.entities
			.map((cls) =>
				cls.uniqueConstraints.map(
					([obj, key], i) =>
						new Query(
							`CREATE CONSTRAINT ${cls.name}_${i} IF NOT EXISTS FOR (${obj}) REQUIRE ${key} IS UNIQUE`,
						),
				),
			)
			.flat();

		return this.run(...queries);
	}

	close() {
		return new Observable<void>((subscriber) => {
			this.driver.close().then(() => subscriber.complete());
		});
	}
}
