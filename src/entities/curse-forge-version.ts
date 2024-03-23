import { BaseEntity } from "./base";
import { Query } from "../db";

type IVersionSupportable = {
	CYPHER_LABEL: string;
	id: number;
};

export class CurseForgeVersion extends BaseEntity<IVersionSupportable> {
	static override get uniqueConstraints() {
		return super.uniqueConstraints.concat([
			[`v:${this.CYPHER_LABEL}Mc`, "v.name"],
			[`v:${this.CYPHER_LABEL}Loader`, "v.name"],
		]);
	}

	name: string;

	get labelSuffix() {
		if (this.name.includes("Java")) return null;
		if (this.name.match(/\d+\d+.*/)) return "Mc";
		return "Loader";
	}

	constructor(name: string) {
		super({});
		this.name = name;
	}

	override buildQuery(parent: IVersionSupportable) {
		if (!this.labelSuffix) return [];
		return new Query(
			`MATCH (p:${parent.CYPHER_LABEL} { id: $parent.id })
			MERGE (v:${this.CYPHER_LABEL}${this.labelSuffix} { name: $name })
			MERGE (p)-[:SUPPORTS]->(v)`,
			{ name: this.name, parent },
		);
	}
}
