#!/usr/bin/env node

import { Command } from "commander";
import { registerCliCommands } from "./commands/register";
import { version } from "../package.json";

// 公共导出：供用户 svton.config.ts 使用
export { defineSvtonProject } from "./config/schema";
export type {
  SvtonProjectConfig,
  SvtonAppConfig,
  AppType,
} from "./config/types";

export async function cli() {
  const program = new Command();

  program
    .name("svton")
    .description(
      "Svton CLI - Scaffold, run, and operate Svton full-stack projects",
    )
    .version(version);

  registerCliCommands(program);

  await program.parseAsync();
}

if (require.main === module) {
  cli();
}
