import {
	Observable,
	UnaryFunction,
	concatMap,
	endWith,
	from,
	interval,
	last,
	map,
	mergeMap,
	pipe,
	retry,
	takeWhile,
} from "rxjs";

export const curseforgeApiUrl = "https://www.curseforge.com/api/v1/mods/";

type ApiResponse<T = unknown> = {
	data: T[];
	pagination: {
		page: number;
		pageSize: number;
		totalPages: number;
	};
};

export const collectPagination = <T = Record<string, unknown>>(
	indexableUrl: (n: number) => string,
): UnaryFunction<Observable<number>, Observable<T>> =>
	pipe(
		map((n: number) => indexableUrl(n)),
		concatMap((url: string) =>
			from(
				fetch(url).then((res) => res.json() as Promise<ApiResponse<T>>),
			).pipe(
				retry({
					count: 5,
					delay: 15000,
				}),
			),
		),
		takeWhile((res) => res.data.length > 0, true),
		mergeMap((res) => from(res.data)),
	);

export const collectAllPagination = <Parent, T = Record<string, unknown>>(
	p: Parent,
	indexableUrl: (p: Parent, n: number) => string,
	whilePred: (elm: T) => boolean = () => true,
) =>
	interval(0).pipe(
		collectPagination<T>((i) => indexableUrl(p, i)),
		takeWhile(whilePred),
	);
