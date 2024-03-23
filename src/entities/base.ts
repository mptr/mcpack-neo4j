import { DbConnection } from "../main";
import { Query } from "../db";

export abstract class BaseEntity<S = void> {
	id: number;

	static get CYPHER_LABEL(): string {
		return this.name;
	}

	// allow access to static prop from instance
	get CYPHER_LABEL(): string {
		// @ts-ignore
		return this.constructor.CYPHER_LABEL;
	}

	static get uniqueConstraints(): [string, string][] {
		if (this.CYPHER_LABEL === BaseEntity.name)
			throw new Error("Cannot call uniqueConstraints on BaseEntity");
		return [[`v:${this.CYPHER_LABEL}`, "v.id"]];
	}

	get primitiveThis(): Partial<this> {
		const partial: Partial<this> = { ...this };
		// delete all non-primitive properties
		for (const key of Object.keys(partial) as (keyof this)[])
			if (typeof partial[key] === "object") delete partial[key];
		return partial;
	}

	protected buildQuery(relatedData: S): Query[] | Query {
		return [];
	}

	async save(relatedData: S) {
		const session = DbConnection.getSession();
		const qs = this.buildQuery(relatedData);
		const queries = Array.isArray(qs) ? qs : [qs];
		await session.runAll(queries);
		await session.close();
		return this;
	}

	constructor(d: Record<string, unknown>) {
		this.id = d.id as number;
	}
}
