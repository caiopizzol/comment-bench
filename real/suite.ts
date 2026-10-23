import { resolve } from "node:path";

export type Task = {
	id: string;
	fix: string;
	ticket: string;
	installDir: string;
	testCwd: string;
	runner: "vitest" | "bun";
	expectedTests: number;
	failingAtParent: number;
};

export type Suite = {
	repo: string;
	ticketsDir: string;
	intro: string;
	install: string[];
	installDirFor: (changedFile: string) => string;
	vitest: string[];
	ticketPattern?: string;
	tasks: Task[];
};

export const ARMS = ["comments", "stripped", "references"] as const;
export type Arm = (typeof ARMS)[number];

export async function loadSuite(path: string): Promise<Suite> {
	const mod = await import(resolve(path));
	return mod.default as Suite;
}
