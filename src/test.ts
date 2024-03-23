import { MultiProgressBars } from "multi-progress-bars";
import chalk from "chalk";
import { interval, map, mergeMap, of, take, tap } from "rxjs";

// Initialize mpb
const mpb = new MultiProgressBars({
	initMessage: " $ Example Fullstack Build ",
	anchor: "top",
	persist: true,
	border: true,
});

const s = interval(400).pipe(
	tap((i) =>
		mpb.addTask("Job " + i, {
			type: "indefinite",
		}),
	),
	mergeMap((jobId) => {
		return interval(200).pipe(
			take(5),
			tap((i) => {
				mpb.updateTask("Job " + jobId, {
					message: ["Warmup", "Compute", "Verify", "Finalize", "Done"][i],
				});
				if (i == 4) mpb.done("Job " + jobId);
				else
					mpb.updateTask("Job " + jobId, {
						message: ["Warmup", "Compute", "Verify", "Finalize", "Done"][i],
					});
			}),
		);
	}),
);

s.subscribe();
