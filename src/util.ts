import {
	MonoTypeOperatorFunction,
	Observable,
	UnaryFunction,
	concatMap,
	filter,
	from,
	interval,
	map,
	mergeMap,
	pipe,
	takeWhile,
} from "rxjs";
import { Parent } from "./entities/base";

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
	indexableUrl: (n: number) => string
): UnaryFunction<Observable<number>, Observable<T>> =>
	pipe(
		map((n: number) => indexableUrl(n)),
		concatMap((url: string) =>
			from(fetch(url).then((res) => res.json() as Promise<ApiResponse<T>>))
		),
		takeWhile((res) => res.data.length > 0, true),
		mergeMap((res) => from(res.data))
	);

export const collectAllPagination = <T = Record<string, unknown>>(
	indexableUrl: (p: Parent, n: number) => string
) =>
	pipe(
		mergeMap((p: Parent) =>
			interval(0).pipe(
				collectPagination<T>((i) => indexableUrl(p, i)),
				map((d) => [p, d] as const) // keep track of pack id
			)
		)
	);

export const filterAsync = <T>(
	predicate: (value: T) => Observable<boolean>
): MonoTypeOperatorFunction<T> =>
	pipe(
		// Convert the predicate Promise<boolean> to an observable (which resolves the promise,
		// Then combine the boolean result of the promise with the input data to a container object
		concatMap((data: T) =>
			predicate(data).pipe(
				map((isValid) => ({ filterResult: isValid, entry: data }))
			)
		),
		// Filter the container object synchronously for the value in each data container object
		filter((data) => data.filterResult === true),
		// remove the data container object from the observable chain
		map((data) => data.entry)
	);
