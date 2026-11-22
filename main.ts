// Tiny stack VM for make.fun's tiny-stack-vm-01 ISA (see kit ISA.md).
// Runs every /input/<id>/ program and writes /output/<id>/stdout.bin + exit.txt.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function run(p, inp) {
  const s = new Int32Array(256), c = new Int32Array(64), m = new Int32Array(256);
  let sp = 0, cp = 0, pc = 0, ip = 0, st = 0;
  const o = [], n = p.length;
  const s16 = (i) => ((p[i] | (p[i + 1] << 8)) << 16) >> 16;
  let a, b, v, t;
  for (;;) {
    if (st >= 1000000) return [o, 10];
    if (pc < 0 || pc >= n) return [o, 9];
    const op = p[pc];
    const ok = op <= 7 || (op >= 16 && op <= 30) || (op >= 32 && op <= 34) ||
      (op >= 48 && op <= 53) || (op >= 64 && op <= 65) || (op >= 80 && op <= 83);
    if (!ok) return [o, 5];
    let L = op === 1 ? 2 : op === 2 ? 5 : op >= 48 && op <= 51 ? 3 : 1;
    if (pc + L > n) return [o, 9];
    st++;
    const nx = pc + L;
    switch (op) {
      case 0: return [o, 0];
      case 1:
        if (sp >= 256) return [o, 3];
        s[sp++] = (p[pc + 1] << 24) >> 24;
        pc = nx; break;
      case 2:
        if (sp >= 256) return [o, 3];
        s[sp++] = p[pc + 1] | (p[pc + 2] << 8) | (p[pc + 3] << 16) | (p[pc + 4] << 24);
        pc = nx; break;
      case 3:
        if (sp < 1) return [o, 2];
        sp--; pc = nx; break;
      case 4:
        if (sp < 1) return [o, 2];
        if (sp >= 256) return [o, 3];
        s[sp] = s[sp - 1]; sp++; pc = nx; break;
      case 5:
        if (sp < 2) return [o, 2];
        a = s[sp - 1]; s[sp - 1] = s[sp - 2]; s[sp - 2] = a; pc = nx; break;
      case 6:
        if (sp < 2) return [o, 2];
        if (sp >= 256) return [o, 3];
        s[sp] = s[sp - 2]; sp++; pc = nx; break;
      case 7:
        if (sp < 3) return [o, 2];
        a = s[sp - 3]; s[sp - 3] = s[sp - 2]; s[sp - 2] = s[sp - 1]; s[sp - 1] = a;
        pc = nx; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22:
      case 24: case 25: case 26: case 28: case 29: case 30: case 32: case 33: case 34:
        if (sp < 2) return [o, 2];
        b = s[--sp]; a = s[--sp];
        if (op === 16) v = (a + b) | 0;
        else if (op === 17) v = (a - b) | 0;
        else if (op === 18) v = Math.imul(a, b);
        else if (op === 19) { if (!b) return [o, 4]; v = (a / b) | 0; }
        else if (op === 20) { if (!b) return [o, 4]; v = (a % b) | 0; }
        else if (op === 21) { if (!(b >>> 0)) return [o, 4]; v = ((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 22) { if (!(b >>> 0)) return [o, 4]; v = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 24) v = a & b;
        else if (op === 25) v = a | b;
        else if (op === 26) v = a ^ b;
        else if (op === 28) v = a << (b & 31);
        else if (op === 29) v = a >> (b & 31);
        else if (op === 30) v = (a >>> (b & 31)) | 0;
        else if (op === 32) v = a === b ? 1 : 0;
        else if (op === 33) v = a < b ? 1 : 0;
        else v = (a >>> 0) < (b >>> 0) ? 1 : 0;
        s[sp++] = v; pc = nx; break;
      case 23: case 27:
        if (sp < 1) return [o, 2];
        s[sp - 1] = op === 23 ? (-s[sp - 1]) | 0 : ~s[sp - 1];
        pc = nx; break;
      case 48:
        pc = nx + s16(pc + 1);
        break;
      case 49: case 50:
        if (sp < 1) return [o, 2];
        v = s[--sp];
        pc = (op === 49 ? v === 0 : v !== 0) ? nx + s16(pc + 1) : nx;
        break;
      case 51:
        if (cp >= 64) return [o, 7];
        c[cp++] = nx;
        pc = p[pc + 1] | (p[pc + 2] << 8);
        break;
      case 52:
        if (cp === 0) return [o, 8];
        pc = c[--cp];
        break;
      case 64:
        if (sp < 1) return [o, 2];
        a = s[sp - 1];
        if (a < 0 || a > 255) return [o, 6];
        s[sp - 1] = m[a];
        pc = nx; break;
      case 65:
        if (sp < 2) return [o, 2];
        a = s[--sp]; b = s[--sp];
        if (a < 0 || a > 255) return [o, 6];
        m[a] = b;
        pc = nx; break;
      case 80:
        if (sp < 1) return [o, 2];
        v = s[--sp];
        t = String(v);
        if (o.length + t.length > 65536) return [o, 11];
        for (let i = 0; i < t.length; i++) o.push(t.charCodeAt(i));
        pc = nx; break;
      case 81:
        if (sp < 1) return [o, 2];
        if (o.length >= 65536) return [o, 11];
        o.push(s[--sp] & 255);
        pc = nx; break;
      case 82:
        if (sp >= 256) return [o, 3];
        s[sp++] = ip < inp.length ? inp[ip++] : -1;
        pc = nx; break;
      case 83:
        if (sp < 1) return [o, 2];
        return [o, s[--sp] & 255];
    }
  }
}

for (const id of readdirSync(I).sort()) {
  let p, inp;
  try { p = readFileSync(join(I, id, 'program.bin')); } catch { continue; }
  try { inp = readFileSync(join(I, id, 'input.bin')); } catch { inp = Buffer.alloc(0); }
  const [o, code] = run(p, inp);
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), Buffer.from(o));
  writeFileSync(join(O, id, 'exit.txt'), code + '\n');
}
