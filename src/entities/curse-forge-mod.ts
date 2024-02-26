import { Observable, endWith, last } from "rxjs";
import { DbConnection } from "../main";
import { BaseEntity, Parent } from "./base";
import { curseforgeApiUrl } from "../util";

export class CurseForgeMod extends BaseEntity {
	static urlPaginator = (pack: Parent, i: number) =>
		`${curseforgeApiUrl}${pack.id}/dependencies?index=${i}`;

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

// class CurseForgeModWithMeta {
// 	mod: CurseForgeMod;
// 	categories: CurseForgeCategory[];
// 	files: CurseForgeModFile[];

// save(s: GraphDbSession): GraphDbSession {
// 	const partial: Partial<CurseForgeModWithMeta> = { ...this };
// 	delete partial.categoryClass;
// 	delete partial.categories;
// 	delete partial.files;
// 	s = s.run(
// 		`MERGE (m:Mod { id: $entity.id })
// 		SET m += $partial`,
// 		{ entity: this, partial }
// 	);
// 	for (const category of this.categories)
// 		s = s.run(
// 			`MATCH (m:Mod { id: $entity.id })
// 			MERGE (c:ModCategory { id: $category.id })
// 			SET c += $category
// 			MERGE (m)-[:BELONGS_TO]->(c)`,
// 			{ entity: this, category }
// 		);
// 	for (const file of this.files) {
// 		const partialFile: Partial<CurseForgeModFile> = { ...file };
// 		delete partialFile.user;
// 		delete partialFile.gameVersionTypeIds;
// 		delete partialFile.gameVersions;
// 		s.run(
// 			`MATCH (m:Mod { id: $entity.id })
// 			MERGE (f:File {id: $file.id })
// 			SET f += $file
// 			MERGE (m)-[:HAS]->(f)`,
// 			{ entity: this, file: partialFile }
// 		);
// 		for (const version of file.gameVersions)
// 			s.run(
// 				`MATCH (f:File { id: $file.id })
// 				MERGE (v:Version { name: $version })
// 				MERGE (f)-[:FOR_VERSION]->(v)`,
// 				{ file: partialFile, version }
// 			);
// 	}
// 	return s;
// }
// }

// const enrichMod = async (
// 	mod: CurseForgeMod
// ): Promise<CurseForgeModWithMeta> => {
// 	const files = collectPagination<CurseForgeModFile>(
// 		(page) =>
// 			`${curseforgeApiUrl}${mod.id}/files?pageIndex=${page}&pageSize=50&sort=dateCreated&sortDescending=true`
// 	);
// 	const categories = getCategoriesFor(`${mod.categoryClass.slug}/${mod.slug}`);

// 	const result = new CurseForgeModWithMeta();
// 	Object.assign(result, {
// 		...mod,
// 		files: await files,
// 		categories: await categories,
// 	});
// 	return result;
// };
