import {
	AsyncSubject,
	Observable,
	endWith,
	from,
	isEmpty,
	last,
	map,
	mergeMap,
	of,
	pipe,
} from "rxjs";
import { BaseEntity } from "./base";
import { DbConnection } from "../main";

export class CurseForgeCategory extends BaseEntity {
	name: string;
	slug: string;
	isClass: boolean;
	classId: number | null;
	parentCategoryId: number | null;

	// override saveRelatedTo(): Observable<this> {
	// 	return DbConnection.run(
	// 		`MATCH (m:Mod { id: $parentId })
	// 		MERGE (c:Category { id: $id })
	// 		SET c += $category
	// 		MERGE (m)-[:BELONGS_TO]->(c)`,
	// 		this
	// 	).pipe(endWith(this), last()) as Observable<this>;
	// }

	override saveRelatedTo() {
		return DbConnection.run(
			`MATCH (p:Pack { id: $parentId })
			MERGE (m:Mod { id: $id })
			MERGE (p)-[:CONTAINS]->(m)`,
			this
		).pipe(endWith(this), last()) as Observable<this>;
	}

	override save() {
		const partial: Partial<this> = { ...this };

		delete partial.categoryClass;

		return DbConnection.run(
			`MERGE (m:Mod { id: $id })
			SET m += $partial`,
			{ entity: this, partial }
		).pipe(endWith(this), last()) as Observable<this>;
	}
}

type ICategorizable = {
	id: number;
	slug: string; // mc-mods/<mod-slug> or modpacks/<pack-slug> or texture-packs/<tp-slug>
};

export const getCategories = () =>
	pipe(
		map(
			(item: ICategorizable) =>
				[item.id, `https://www.curseforge.com/minecraft/${item.slug}`] as const
		),
		mergeMap(([id, url]) =>
			from(fetch(url).then(async (res) => [id, await res.text()] as const))
		),
		map(([id, txt]) => {
			const result = txt
				.split(`<script id="__NEXT_DATA__" type="application/json">`)[1]
				.split(`</script>`)[0];
			if (result === undefined) {
				console.error(txt);
				throw new Error("Could not find __NEXT_DATA__");
			}
			const data = JSON.parse(result);
			if (data.props?.pageProps?.project?.categories === undefined) {
				console.error(data);
				throw new Error("Could not find categories");
			}
			return new CurseForgeCategory(
				data.props.pageProps.project.categories,
				id
			);
		})
	);
