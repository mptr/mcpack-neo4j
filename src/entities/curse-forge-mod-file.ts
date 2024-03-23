import { curseforgeApiUrl } from "../util";
import { BaseEntity } from "./base";
import { CurseForgeMod } from "./curse-forge-mod";
import { Query } from "../db";

export class CurseForgeModFile extends BaseEntity<CurseForgeMod> {
	static urlPaginator = (mod: CurseForgeMod, i: number) =>
		`${curseforgeApiUrl}${mod.id}/files?pageIndex=${i}`;

	dateCreated: string;
	dateModified: string;
	displayName: string;
	fileLength: number;
	fileName: string;
	status: number;
	gameVersions: string[];
	gameVersionTypeIds: number[];
	releaseType: number;
	totalDownloads: number;
	user: {
		username: string;
		id: number;
		twitchAvatarUrl: string;
		displayName: string;
	};
	additionalFilesCount: number;
	hasServerPack: boolean;
	additionalServerPackFilesCount: number;
	isEarlyAccessContent: boolean;
	isCompatibleWithClient: boolean;

	constructor(d: Record<string, unknown>) {
		super(d);
		Object.assign(this, d);
	}

	protected override buildQuery(relatedData: CurseForgeMod) {
		return new Query(
			`MATCH (p:${relatedData.CYPHER_LABEL} { id: $parentId })
			MERGE (f:${this.CYPHER_LABEL} { id: $id })
			MERGE (p)-[:HAS]->(f)
			SET f += $partial`,
			{ parentId: relatedData.id, id: this.id, partial: this.primitiveThis },
		);
	}
}
