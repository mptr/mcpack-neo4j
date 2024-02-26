import {
	AsyncSubject,
	Observable,
	OperatorFunction,
	endWith,
	isEmpty,
	last,
	map,
	mergeMap,
	of,
	pipe,
	take,
} from "rxjs";
import { filterAsync } from "../util";
import { DbConnection } from "../main";

export class Parent {
	constructor(
		public id: number,
		public cypherLabel: string,
		public relationName: string
	) {}
}

export abstract class BaseEntity {
	id: number;

	static readonly CYPHER_LABEL = this.constructor.name;

	isMissingFromDatabase(): AsyncSubject<boolean> {
		const subject = new AsyncSubject<boolean>();
		DbConnection.run(
			`MATCH (m:${BaseEntity.CYPHER_LABEL} { id: $id }) RETURN m`,
			{ id: this.id }
		)
			.pipe(isEmpty())
			.subscribe(subject);
		return subject;
	}

	abstract save(): Observable<this>;

	saveRelatedTo() {
		if (!this.parent) return of(this);

		return DbConnection.run(
			`MATCH (p:${this.parent.cypherLabel} { id: $parentId })
			MERGE (m:Mod { id: $id })
			MERGE (p)-[:${this.parent.relationName}]->(m)`,
			{ id: this.id, parentId: this.parent.id }
		).pipe(endWith(this), last()) as Observable<this>;
	}

	constructor(d: Record<string, unknown>, public readonly parent?: Parent) {
		Object.assign(this, d);
	}
}

type ClassType<T> = new (...args: any[]) => T;

export const processEntity = <T extends BaseEntity>(
	classRef: ClassType<T>
): OperatorFunction<
	Record<string, unknown> | readonly [Parent, Record<string, unknown>],
	T
> =>
	pipe(
		map((x) => {
			const r = Array.isArray(x) ? x : [undefined, x];
			return r as [Parent, Record<string, unknown>];
		}),
		map(
			([parent, data]: readonly [
				Parent | undefined,
				Record<string, unknown>
			]) => {
				const r = new classRef(data, parent) as T;
				Object.assign(r, data);
				console.log(r);
				console.log(classRef);
				return r;
			}
		),
		// tap(x => x),
		// tap((x) => console.log(x.constructor.name, x.i)),
		mergeMap((child) => child.saveRelatedTo()),
		take(1), // TEMPORARY
		filterAsync((child) => child.isMissingFromDatabase()),
		mergeMap((child) => child.save())
	);
