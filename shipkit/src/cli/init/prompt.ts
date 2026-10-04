// Prompting for `ship init`: TTY questions (secrets blind-typed), non-TTY defaults-only.
// Non-TTY never waits: questions without a default are recorded as missing and the
// wizard aborts immediately with a structured list instead of blocking on stdin.

import { createInterface, type Interface as Readline } from 'node:readline';
import { Writable } from 'node:stream';

export interface Choice {
  value: string;
  label: string;
}

export interface Question {
  field: string;
  label: string;
  /** preselected answer shown as [default]; omit to force an explicit choice */
  default?: string;
  optional?: boolean;
  secret?: boolean;
  /** allow clearing a set default explicitly (TTY: type `-`); empty input keeps the default (M1-11) */
  clearable?: boolean;
  hint?: string;
  choices?: Choice[];
}

export interface MissingField {
  field: string;
  label: string;
  reason: string;
}

export const CANCEL = Symbol('cancel');

/** user aborted the wizard (EOF / Ctrl+C / explicit choice) — lowest layer owns it */
export class Cancelled extends Error {}

export interface Prompter {
  interactive: boolean;
  /** where questions/validation hints go (stderr under --json so stdout stays machine-readable) */
  out: NodeJS.WriteStream;
  /** resolved answer string, CANCEL when the user aborted (EOF / Ctrl+C) */
  ask(q: Question): Promise<string | typeof CANCEL>;
  /** missing no-default questions collected so far (non-interactive only) */
  missing(): MissingField[];
}

export function isInteractiveTty(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function renderQuestion(q: Question, out: NodeJS.WriteStream): void {
  if (q.hint) out.write(`  ${q.hint}\n`);
  if (q.choices && q.choices.length > 0) {
    q.choices.forEach((c, i) => {
      const mark = c.value === q.default ? '→' : ' ';
      out.write(` ${mark} ${i + 1}) ${c.label}\n`);
    });
    out.write(`${q.label} [编号]: `);
    return;
  }
  const def = q.default !== undefined
    ? q.secret
      ? ' [回车保留现有值]'
      : ` [${q.default === '' ? '留空' : q.default}]`
    : '';
  out.write(`${q.label}${def}: `);
}

class TtyPrompter implements Prompter {
  interactive = true as const;
  private rl: Readline | null = null;
  private rlSecret = false;
  /** pre-queued answers: under a pty, multiple lines arrive in one stdin chunk and
   *  'line' events fire synchronously before the next question attaches its listener */
  private queue: string[] = [];
  private lineWaiter: ((line: string) => void) | null = null;
  private closeWaiter: (() => void) | null = null;
  private closed = false;

  constructor(readonly out: NodeJS.WriteStream = process.stdout) {}

  private readline(secret: boolean): Readline {
    if (this.rl && this.rlSecret !== secret) {
      this.detach(this.rl);
      this.rl.close();
      this.rl = null;
    }
    if (!this.rl) {
      // blind input for secrets: answers must not appear in terminal scrollback or logs
      const output = secret
        ? new Writable({ write(_c, _e, cb) { cb(); } })
        : this.out;
      const rl = createInterface({ input: process.stdin, output, terminal: true });
      rl.on('line', (line) => {
        const w = this.lineWaiter;
        this.lineWaiter = null;
        if (w) w(line);
        else this.queue.push(line);
      });
      rl.on('close', () => {
        this.closed = true;
        const w = this.closeWaiter;
        this.closeWaiter = null;
        if (w) w();
      });
      rl.on('SIGINT', () => this.rl?.close());
      this.rl = rl;
      this.rlSecret = secret;
    }
    return this.rl;
  }

  private detach(rl: Readline): void {
    rl.removeAllListeners('line');
    rl.removeAllListeners('close');
    rl.removeAllListeners('SIGINT');
  }

  private nextLine(): Promise<string | typeof CANCEL> {
    const queued = this.queue.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    if (this.closed) return Promise.resolve(CANCEL);
    return new Promise((resolve) => {
      this.lineWaiter = (line) => resolve(line);
      this.closeWaiter = () => resolve(CANCEL);
    });
  }

  async ask(q: Question): Promise<string | typeof CANCEL> {
    renderQuestion(q, this.out);
    this.readline(q.secret === true);
    const raw = await this.nextLine();
    if (raw === CANCEL) return CANCEL;
    const answer = raw.trim();
    if (answer === '' && q.default !== undefined) return q.default; // empty = keep (M1-11)
    if (answer === '-' && q.clearable === true && q.default !== undefined) return ''; // explicit clear (M1-11)
    if (answer === '' && !q.optional) {
      this.out.write('  该项为必填，请输入内容（Ctrl+C 取消）。\n');
      return this.ask(q);
    }
    if (q.choices) {
      const picked = q.choices[Number(answer) - 1];
      if (!picked) {
        this.out.write('  请输入列表中的编号。\n');
        return this.ask(q);
      }
      return picked.value;
    }
    return answer;
  }

  missing(): MissingField[] {
    return [];
  }
}

class NonTtyPrompter implements Prompter {
  interactive = false as const;
  readonly out: NodeJS.WriteStream;

  constructor(out: NodeJS.WriteStream = process.stdout) {
    this.out = out;
  }
  private readonly gaps: MissingField[] = [];

  async ask(q: Question): Promise<string | typeof CANCEL> {
    if (q.default !== undefined) return q.default;
    if (q.optional) return ''; // optional without default: skip, not a missing input
    this.gaps.push({
      field: q.field,
      label: q.label,
      reason: q.choices
        ? `存在多个候选，需交互选择：${q.choices.map((c) => c.label).join('；')}`
        : '非交互模式下无默认值可用',
    });
    return '';
  }

  missing(): MissingField[] {
    return [...this.gaps];
  }
}

export function createPrompter(interactive: boolean, out: NodeJS.WriteStream = process.stdout): Prompter {
  return interactive ? new TtyPrompter(out) : new NonTtyPrompter(out);
}
