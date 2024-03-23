import { Observable, from, map, mergeMap, of, retry } from "rxjs";
import { BaseEntity } from "./base";
import { Query } from "../db";

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
	item: T,
	typedSlugExtractor: (item: T) => string,
): Observable<Record<string, unknown>> => {
	const url = `https://www.curseforge.com/minecraft/${typedSlugExtractor(item)}`;
	return of(url).pipe(
		mergeMap((url) =>
			from(fetch(url).then(async (res) => [await res.text()] as const)).pipe(
				retry({ count: 3, delay: 1000 }),
			),
		),
		map(([txt]) => {
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

			return cs;
		}),
		mergeMap((x) => x),
	);
};
