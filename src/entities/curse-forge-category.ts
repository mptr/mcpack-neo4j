import {
	Observable,
	UnaryFunction,
	from,
	map,
	mergeMap,
	pipe,
	retry,
	tap,
} from "rxjs";
import { BaseEntity } from "./base";
import { Query } from "../db";
import { fetchRateLimited } from "../util";

type ICategorizable = {
	CYPHER_LABEL: string;
	id: number;
	slug: string; // mc-mods/<mod-slug> or modpacks/<pack-slug> or texture-packs/<tp-slug>
};

export class CurseForgeCategory extends BaseEntity<ICategorizable> {
	static override get uniqueConstraints() {
		return super.uniqueConstraints.concat([
			[`c:${this.CYPHER_LABEL}`, "(c.id, c.slug)"],
		]);
	}

	name: string;
	slug: string;
	isClass: boolean;
	classId: number | null;
	parentCategoryId: number | null;

	constructor(d: Record<string, unknown>) {
		super(d);
		Object.assign(this, d);
	}

	override buildQuery(parent: ICategorizable) {
		return new Query(
			`MATCH (p:${parent.CYPHER_LABEL} { id: $parent.id })
			MERGE (c:${this.CYPHER_LABEL} { id: $entity.id })
			SET c += $entity
			MERGE (p)-[:BELONGS_TO]->(c)`,
			{ entity: this, parent },
		);
	}
}

export const getCategories = <T extends ICategorizable>(
	typedSlugExtractor: (item: T) => string,
): UnaryFunction<
	Observable<T>,
	Observable<readonly [T, Record<string, unknown>]>
> => {
	return pipe(
		map(
			(item: T) =>
				[
					item,
					`https://www.curseforge.com/minecraft/${typedSlugExtractor(item)}`,
				] as const,
		),
		mergeMap(([item, url]) =>
			from(
				fetchRateLimited(url).then(
					async (res) => [item, await res.text()] as const,
				),
			).pipe(retry({ count: 3, delay: 1000 })),
		),
		map(([item, txt]) => {
			let data;
			try {
				const result = txt
					.split(`<script id="__NEXT_DATA__" type="application/json">`)[1]
					.split(`</script>`)[0];
				if (result === undefined) {
					console.error(txt);
					throw new Error("Could not find __NEXT_DATA__");
				}
				data = JSON.parse(result);
			} catch (e) {
				console.error(txt);
				console.error(item);
				throw e;
			}
			if (data.props?.pageProps?.project?.categories === undefined) {
				console.error(data);
				throw new Error("Could not find categories");
			}

			const cs: Record<string, unknown>[] =
				data.props.pageProps.project.categories;

			return cs.map((categoryData) => [item, categoryData] as const);
		}),
		mergeMap((x) => x),
	);
};
