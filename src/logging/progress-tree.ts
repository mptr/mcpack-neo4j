const green = (str: string) => `\x1b[32m${str}\x1b[0m`;
const yellow = (str: string) => `\x1b[33m${str}\x1b[0m`;
const grey = (str: string) => `\x1b[90m${str}\x1b[0m`;
const blue = (str: string) => `\x1b[34m${str}\x1b[0m`;
const normal = (str: string) => str;

export class ProgressTree {
	protected _done = false;
	protected readonly children: ProgressTree[] = [];
	protected _taskCounter = 0;
	protected _meta: string;

	constructor(protected readonly name: string) {}

	protected showInterval: Timer | null = null;
	show() {
		if (this.showInterval) return;
		this.showInterval = setInterval(() => {
			console.clear();
			console.log(this.toString());
		}, 100);
	}
	hide() {
		if (this.showInterval) clearInterval(this.showInterval);
	}

	addChildTask(pt: ProgressTree, done?: boolean): ProgressTree;
	addChildTask(name: string, done?: boolean): ProgressTree;
	addChildTask(pt: ProgressTree | string, done = false): ProgressTree {
		const insert = pt instanceof ProgressTree ? pt : new ProgressTree(pt);
		if (done) insert.done();
		this.children.push(insert);
		return insert;
	}

	increaseTaskCounter() {
		this._taskCounter++;
	}

	done() {
		this._done = true;
	}

	set meta(meta: string) {
		this._meta = meta;
	}

	toString() {
		return this._toString();
	}

	protected get nodeLabel() {
		const doneCount = (
			this.children.filter((c) => c._done).length +
			this._taskCounter +
			""
		).padStart(3, " ");
		const prefix = grey("[") + green(this._done ? "✔" : " ") + grey("]");

		const counter = this._done
			? normal("[") + yellow(doneCount) + normal("]")
			: grey(`[${doneCount}]`);

		const m = this._meta ? ` (${blue(this._meta)})` : "";

		return (
			prefix + " " + counter + " " + (this._done ? grey : normal)(this.name) + m
		);
	}

	protected _toString(branch = "", result = ""): string {
		const isGraphHead = branch.length === 0;
		const cs = this._done ? [] : this.children;

		let branchHead = "";

		if (!isGraphHead) {
			branchHead = cs && cs.length !== 0 ? "┬ " : "─ ";
		}

		let baseBranch = branch;

		if (!isGraphHead) {
			const isChildOfLastBranch = branch.slice(-2) === "└─";
			baseBranch = branch.slice(0, -2) + (isChildOfLastBranch ? "  " : "│ ");
		}

		const nextBranch = baseBranch + "├─";
		const lastBranch = baseBranch + "└─";

		return cs.reduce(
			(acc, child, index) => {
				return (
					acc +
					"\n" +
					child._toString(
						cs.length - 1 === index ? lastBranch : nextBranch,
						result,
					)
				);
			},
			`${grey(branch + branchHead)}${this.nodeLabel}`,
		);
	}
}
