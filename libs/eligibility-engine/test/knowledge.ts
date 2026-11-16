import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EligibilityEngine } from "../src/index.ts";

const KNOWLEDGE = join(import.meta.dirname, "../../../knowledge");

export const knowledgeFiles = (dir = KNOWLEDGE): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? knowledgeFiles(join(dir, entry.name))
			: entry.name.endsWith(".ttl")
				? [join(dir, entry.name)]
				: [],
	);

export const loadEngine = () => new EligibilityEngine(knowledgeFiles().map((file) => readFileSync(file, "utf8")));
