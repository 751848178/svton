import type { ReadStream, WriteStream } from 'node:tty';
import { StringDecoder } from 'node:string_decoder';

/** No echo, argv/env password, or non-terminal fallback. Always restore TTY. */
export function hiddenInput(prompt: string, input = process.stdin as ReadStream, output = process.stderr as WriteStream): Promise<string> {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') throw new Error('账号初始化须在交互终端中隐藏输入密码');
  return new Promise((resolve, reject) => {
    let value = '', settled = false; const raw = input.isRaw, decoder = new StringDecoder('utf8');
    const finish = (error?: Error) => {
      if (settled) return; settled = true;
      input.off('data', consume); input.off('end', ended); input.off('error', failed);
      input.setRawMode(raw); input.pause(); output.write('\n');
      if (error) reject(error); else resolve(value);
      value = '';
    };
    const consume = (data: Buffer) => {
      for (const character of decoder.write(data)) {
        if (character === '\u0003' || character === '\u0004') return finish(new Error('账号初始化已取消'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') value = Array.from(value).slice(0, -1).join('');
        else if (character >= ' ') {
          if (Buffer.byteLength(value + character) > 256) return finish(new Error('密码输入过长'));
          value += character;
        }
      }
    };
    const ended = () => finish(new Error('密码输入已中断'));
    const failed = () => finish(new Error('密码输入已中断'));
    output.write(prompt); input.setRawMode(true); input.on('data', consume); input.once('end', ended); input.once('error', failed); input.resume();
  });
}
