import { Observable, of } from "rxjs";
import { curseforgeApiUrl } from "../util";
import { BaseEntity, Parent } from "./base";

export class CurseForgeModFile extends BaseEntity {
	static urlPaginator = (mod: Parent, i: number) =>
		`${curseforgeApiUrl}${mod.id}/files?index=${i}`;

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

	override save(): Observable<this> {
		return of(this);
	}
}
