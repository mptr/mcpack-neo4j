import neo4j, { Driver, QueryResult, RecordShape, Session } from "neo4j-driver";

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
	readonly driver: Driver;

	readonly entities: StaticUniqueConstrained[];

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

	getSession(...sessionOptions: Parameters<Driver["session"]>) {
		return new GraphDBSession(this, ...sessionOptions);
	}
}

export class GraphDBSession {
	private readonly session: Session;
	constructor(
		private readonly db: GraphDB,
		...sessionOptions: Parameters<Driver["session"]>
	) {
		this.session = db.driver.session(...sessionOptions);
	}

	async runAll(querySource: Query[]) {
		const tx = await this.session.beginTransaction();
		const r = await Promise.all(
			querySource.map((q) => tx.run(q.query, q.params).then((r) => r.records)),
		);
		await tx.commit();
		return r;
	}

	run(args: Query): Promise<QueryResult<RecordShape>["records"]>;
	run(...args: Query[]): Promise<void>;
	run(...args: Query[]): Promise<void | QueryResult<RecordShape>["records"]> {
		const r = this.runAll(args);
		if (args.length === 1) return r.then((r) => r[0]);
		else return r.then(() => {});
	}

	async clear() {
		await this.run(new Query("MATCH (n) DETACH DELETE n"));
		const dropConstraints = await this.run(
			new Query("SHOW CONSTRAINT YIELD * RETURN name"),
		).then((r) => r.map((c) => new Query(`DROP CONSTRAINT ${c.get("name")}`)));
		return this.runAll(dropConstraints);
	}

	applyConstraints() {
		const queries = this.db.entities
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
		return this.session.close();
	}
}
