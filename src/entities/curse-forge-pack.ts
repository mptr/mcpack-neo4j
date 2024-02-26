import {
	from,
	AsyncSubject,
	Observable,
	isEmpty,
	of,
	concat,
	last,
	endWith,
} from "rxjs";
import { DbConnection } from "../main";
import { Query } from "../db";
import { BaseEntity } from "./base";

export class CurseForgePack extends BaseEntity {
	author: {
		id: number;
		name: string;
		username: string;
		isEarlyAccessAuthor: boolean;
	};
	static readonly AUTHOR_CYPHER_LABEL = "Author";
	avatarUrl: string;
	categories: {
		id: number;
		dateModified: string;
		gameId: number;
		iconUrl: string;
		name: string;
		slug: string;
		url: string;
		classId: number;
		isClass: boolean;
		parentCategoryId: number;
	}[];
	static readonly PACK_CATEGORY_CYPHER_LABEL = "PackCategory";
	class: {
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
	creationDate: number;
	downloads: number;
	gameVersion: string;
	static readonly GAME_VERSION_CYPHER_LABEL = "GameVersion";
	name: string;
	slug: string;
	summary: string;
	updateDate: number;
	releaseDate: number;
	fileSize: number;
	isClientCompatible: boolean;
	latestFileDetails: {
		id: number;
		gameVersions: string[];
		gameVersionTypeIds: number[];
	};
	hasEarlyAccessFiles: boolean;
	hasLocalization: boolean;
	status: number;
	websiteRecentFiles: {
		gameVersion: {
			id: number;
			name: string;
		};
		files: {
			fileName: string;
			id: number;
			dateCreated: string;
			dateModified: string;
			displayName: string;
			releaseType: number;
			gameVersions: string[];
			earlyAccessEndDate: string | null;
			gameVersionTypeIds: number[];
			isEarlyAccessContent: boolean;
		}[];
	}[];
	isMainFileClientCompatible: boolean;

	override save() {
		const partial: Partial<this> = { ...this };

		delete partial.author;
		delete partial.categories;
		delete partial.class;
		delete partial.latestFileDetails;
		delete partial.websiteRecentFiles;

		delete partial.gameVersion;

		const mainQuery: Query = [
			`MERGE (p:${CurseForgePack.CYPHER_LABEL} { id: $entity.id })
			SET p += $partial
			MERGE (a:${CurseForgePack.AUTHOR_CYPHER_LABEL} { id: $entity.author.id })
			SET a += $entity.author
			MERGE (p)-[:AUTHORED_BY]->(a)
			MERGE (v:${CurseForgePack.GAME_VERSION_CYPHER_LABEL} { name: $entity.gameVersion })
			MERGE (p)-[:SUPPORTS]->(v)`,
			{ entity: this, partial },
		];
		console.log(this);
		const categoryQueries: Query[] = this.categories.map((category) => [
			`MATCH (p:${CurseForgePack.CYPHER_LABEL} { id: $entity.id })
			MERGE (pc:${CurseForgePack.PACK_CATEGORY_CYPHER_LABEL} { id: $category.id })
			SET pc += $category
			MERGE (p)-[:BELONGS_TO]->(pc)`,
			{ entity: this, category },
		]);

		return DbConnection.runAll(
			concat(of(mainQuery), from(categoryQueries))
		).pipe(endWith(this), last()) as Observable<this>;
	}
}
