import { BaseEntity } from "./base";
import { curseforgeApiUrl } from "../util";
import { CurseForgePack } from "./curse-forge-pack";
import { DbConnection } from "../main";
import { map, reduce } from "rxjs";
import { Query } from "../db";

export class CurseForgeMod extends BaseEntity<CurseForgePack> {
	static urlPaginator = (pack: CurseForgePack, i: number) =>
		`${curseforgeApiUrl}${pack.id}/dependencies?index=${i}`;

	static presentModIds() {
		return DbConnection.run(
			new Query(`MATCH (m:${this.CYPHER_LABEL}) RETURN m.id`),
		).pipe(
			map((x) => x.get("m.id")),
			reduce((acc, value) => acc.add(value), new Set<number>()),
		);
	}

	name: string;
	authorName: string;
	logoUrl: string;
	categoryClass: {
		id: number;
		dateModified: string;
		gameId: number;
		iconUrl: string;
		name: string;
		slug: string;
		url: string;
		classId: number | null;
		displayIndex: number;
		isClass: boolean;
		parentCategoryId: number | null;
	};
	type: string;
	slug: string;

	constructor(d: Record<string, unknown>) {
		super(d);
		Object.assign(this, d);
	}

	protected override buildQuery(relatedData: CurseForgePack) {
		return new Query(
			`MATCH (p:${relatedData.CYPHER_LABEL} { id: $parentId })
			MERGE (m:${this.CYPHER_LABEL} { id: $id })
			MERGE (p)-[:CONTAINS]->(m)
			SET m += $partial`,
			{ parentId: relatedData.id, id: this.id, partial: this.primitiveThis },
		);
	}
}
