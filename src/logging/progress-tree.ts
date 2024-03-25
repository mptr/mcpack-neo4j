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

	protected static showInterval: Timer | null = null;
	show() {
		if (ProgressTree.showInterval) return;
		ProgressTree.showInterval = setInterval(() => {
			process.stdout.cursorTo(0, 0);
			process.stdout.clearScreenDown();
			process.stdout.write(this.toString());
		}, 500);
	}
	hide() {
		if (ProgressTree.showInterval) clearInterval(ProgressTree.showInterval);
	}

	addChildTask(
		pt: ProgressTree,
		done?: boolean,
		render?: boolean,
	): ProgressTree;
	addChildTask(name: string, done?: boolean, render?: boolean): ProgressTree;
	addChildTask(
		pt: ProgressTree | string,
		done = false,
		render = true,
	): ProgressTree {
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
			prefix +
			" " +
			counter +
			" " +
			(this._done ? grey : normal)(this.name.substring(0, 40)) +
			m
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

		const base = `${grey(branch + branchHead)}${this.nodeLabel}`;

		let subtree = cs.reduce((acc, child, index) => {
			return (
				acc +
				"\n" +
				child._toString(
					cs.length - 1 === index ? lastBranch : nextBranch,
					result,
				)
			);
		}, "");

		if (cs.length > 20 && cs.every((c) => c.children.length === 0)) {
			const COLUMN_COUNT = 6;

			const items = subtree.trim().split("\n");
			subtree = "";
			// Calculate the number of words per column
			const itemsPerColumn = Math.ceil(items.length / COLUMN_COUNT);
			const columns: string[][] = Array.from(
				{ length: COLUMN_COUNT },
				() => [],
			);

			// Assign words to each column
			items.forEach((item, index) => {
				const columnIndex = Math.floor(index / itemsPerColumn);
				columns[columnIndex].push(item);
			});

			// To print the columns
			for (let i = 0; i < itemsPerColumn; i++) {
				const row = columns
					.map((column) => {
						const c = column[i] || "";
						const invisibleChars =
							c.length - c.replace(/\x1B\[[0-9;]*m/g, "").length;
						return c.padEnd(70 + invisibleChars, " ");
					})
					.join("");
				subtree += "\n" + row;
			}
		}
		return result + base + subtree;
	}
}
