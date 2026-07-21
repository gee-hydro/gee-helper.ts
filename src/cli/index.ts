#!/usr/bin/env node
/**
 * CLI 入口：ee <command>
 */
import { HELP, parseArgs } from './args';
import {
  cmdCancel,
  cmdJobs,
  cmdList,
  cmdStatus,
  cmdSubmit,
} from './export';
import { cmdAdd, cmdConfig, cmdRun } from './local';

export async function run(argv: string[] = process.argv.slice(2)): Promise<number> {
  let cli;
  try {
    cli = parseArgs(argv);
  } catch (e) {
    console.error(`参数错误: ${e instanceof Error ? e.message : e}`);
    console.log(HELP);
    return 2;
  }

  switch (cli.cmd) {
    case 'help': console.log(HELP); return 0;
    case 'submit': return cmdSubmit(cli);
    case 'status': return cmdStatus(cli);
    case 'list': return cmdList(cli);
    case 'jobs': return cmdJobs(cli);
    case 'cancel': return cmdCancel(cli);
    case 'run': return cmdRun(cli);
    case 'add': return cmdAdd(cli);
    case 'config': return cmdConfig(cli);
    default: console.log(HELP); return 2;
  }
}

if (require.main === module) {
  void run()
    .then((code) => process.exit(code))
    .catch((e) => { console.error(e); process.exit(1); });
}
