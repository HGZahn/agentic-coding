import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { realpathSync } from "node:fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Lightweight planning/build mode.
 *
 * Planning mode keeps every tool available, but blocks the built-in edit and
 * write tools when their target is inside the current project directory.
 */
export default function planBuildMode(pi: ExtensionAPI): void {
	let planningMode = false;

	function isWithin(root: string, target: string): boolean {
		const path = relative(root, target);
		return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
	}

	function canonicalPath(path: string): string {
		try {
			return realpathSync(path);
		} catch {
			// A new file may not exist yet. Resolve an existing parent so symlinked
			// project directories are still handled conservatively.
			try {
				return resolve(realpathSync(dirname(path)), path.slice(dirname(path).length + 1));
			} catch {
				return path;
			}
		}
	}

	function isProjectPath(cwd: string, inputPath: string): boolean {
		const projectRoot = canonicalPath(resolve(cwd));
		const requestedPath = resolve(cwd, inputPath.replace(/^@/, ""));
		const resolvedPath = canonicalPath(requestedPath);

		// Check both forms: this blocks paths lexically in the project and paths
		// outside it that resolve through a symlink into the project.
		return isWithin(projectRoot, requestedPath) || isWithin(projectRoot, resolvedPath);
	}

	function updateStatus(ctx: ExtensionContext): void {
		ctx.ui.setStatus(
			"plan-build-mode",
			ctx.ui.theme.fg(planningMode ? "warning" : "accent", planningMode ? "mode: plan" : "mode: build"),
		);
	}

	function setPlanningMode(enabled: boolean, ctx: ExtensionContext): void {
		planningMode = enabled;
		updateStatus(ctx);
		pi.appendEntry("plan-build-mode", { planningMode });
		ctx.ui.notify(
			planningMode
				? "Planning mode enabled: project files cannot be edited."
				: "Build mode enabled: full tool access restored.",
			"info",
		);
	}

	function toggleMode(ctx: ExtensionContext): void {
		setPlanningMode(!planningMode, ctx);
	}

	pi.registerCommand("plan", {
		description: "Switch to planning mode (blocks edits inside the project)",
		handler: async (_args, ctx) => setPlanningMode(true, ctx),
	});

	pi.registerCommand("build", {
		description: "Switch to build mode (full tool access)",
		handler: async (_args, ctx) => setPlanningMode(false, ctx),
	});

	pi.registerShortcut("shift+tab", {
		description: "Toggle planning/build mode",
		handler: async (ctx) => toggleMode(ctx),
	});

	pi.on("tool_call", async (event, ctx) => {
		if (!planningMode || (event.toolName !== "edit" && event.toolName !== "write")) return;

		const inputPath = typeof event.input.path === "string" ? event.input.path : "";
		if (!inputPath || isProjectPath(ctx.cwd, inputPath)) {
			return {
				block: true,
				reason: `Planning mode: editing project files is disabled (${inputPath || "missing path"}). Press Shift+Tab to enter build mode.`,
			};
		}
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const modeInstructions = planningMode
			? `## Planning mode\nYou are in planning mode for project ${ctx.cwd}. You have full tool access for inspection, research, and commands, but do not edit or write files inside this project. Do not use shell commands to modify project files. Explain the proposed changes and implementation plan instead.`
			: "## Build mode\nYou are in build mode. You have full tool access and may implement the requested changes.";

		return { systemPrompt: `${event.systemPrompt}\n\n${modeInstructions}` };
	});

	pi.on("session_start", async (_event, ctx) => {
		const state = ctx.sessionManager
			.getEntries()
			.filter((entry) => entry.type === "custom" && entry.customType === "plan-build-mode")
			.pop();
		const saved = state?.type === "custom" ? state.data : undefined;
		if (saved && typeof saved === "object" && "planningMode" in saved) {
			planningMode = saved.planningMode === true;
		}
		updateStatus(ctx);
	});
}
