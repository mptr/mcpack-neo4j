import { Query } from "../db";
import { BaseEntity } from "./base";

export class CurseForgePack extends BaseEntity {
	static override get uniqueConstraints() {
		return super.uniqueConstraints.concat([
			[`p:${this.CYPHER_LABEL}`, "p.slug"],
			[`a:${this.AUTHOR_CYPHER_LABEL}`, "a.id"],
		]);
	}

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

	constructor(d: Record<string, unknown>) {
		super(d);
		Object.assign(this, d);
	}

	override buildQuery() {
		return new Query(
			`MERGE (p:${CurseForgePack.CYPHER_LABEL} { id: $entity.id })
			SET p += $partial
			MERGE (a:${CurseForgePack.AUTHOR_CYPHER_LABEL} { id: $entity.author.id })
			SET a += $entity.author
			MERGE (p)-[:AUTHORED_BY]->(a)`,
			{ entity: this, partial: this.primitiveThis },
		);
	}
}
