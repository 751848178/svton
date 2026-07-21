import { isShellCaseStatement } from './shell-case-parser.utils';
import { isStaticForLoopStatement } from './shell-for-loop-parser.utils';
import { isShellIfStatement } from './shell-if-parser.utils';
import { isShellWhileUntilLoopStatement } from './shell-while-until-loop-parser.utils';

export function isStaticShellControlStatement(statement: string): boolean {
  return isStaticForLoopStatement(statement)
    || isShellCaseStatement(statement)
    || isShellIfStatement(statement)
    || isShellWhileUntilLoopStatement(statement);
}
