import {
	MonoTypeOperatorFunction,
	Observable,
	UnaryFunction,
	concat,
	concatMap,
	endWith,
	from,
	ignoreElements,
	interval,
	last,
	map,
	mergeMap,
	pipe,
	retry,
	takeWhile,
	tap,
} from "rxjs";

export const curseforgeApiUrl = "https://www.curseforge.com/api/v1/mods/";
// export const curseForgeRateLimiter = sharedRateLimiterFactory(100, 1);

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
		// curseForgeRateLimiter(),
		concatMap((url: string) =>
			from(
				fetchRateLimited(url).then(
					(res) => res.json() as Promise<ApiResponse<T>>,
				),
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
	indexableUrl: (p: Parent, n: number) => string,
	whilePred: (elm: T) => boolean = () => true,
) =>
	pipe(
		mergeMap((p: Parent) =>
			interval(0).pipe(
				collectPagination<T>((i) => indexableUrl(p, i)),
				takeWhile(whilePred),
				map((d) => [p, d] as const), // keep track of pack id
			),
		),
	);

export const final = <T>(f: T) => {
	return pipe(endWith(f), last()) as UnaryFunction<
		Observable<unknown>,
		Observable<T>
	>;
};

export const fetchRateLimited = async (url: string) => {
	console.log("\x1b[31mfetching\x1b[0m > ", `\x1b[32m${url}\x1b[0m`);
	return fetch(url);
};

/**
 * Wait for another observable to complete before emitting the first element in the source observable.
 */
export const waitForOtherComplete = <T>(
	other: Observable<unknown>,
): MonoTypeOperatorFunction<T> => {
	return (source: Observable<T>) =>
		concat(other.pipe(ignoreElements()), source);
};
