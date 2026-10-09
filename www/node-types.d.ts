// PawnStudio - deklarasi tipe Node.js (ringkas, bukan @types/node lengkap)
declare var process: NodeJS.Process;
declare var Buffer: BufferConstructor;
declare var require: NodeRequire;
declare var module: NodeModule;
declare var exports: any;
declare var __dirname: string;
declare var __filename: string;
declare var global: any;
declare function setImmediate(cb: (...args: any[]) => void, ...args: any[]): any;
declare function clearImmediate(handle: any): void;

declare namespace NodeJS {
  interface ProcessEnv { [key: string]: string | undefined }
  interface WritableLike { write(chunk: string | Uint8Array): boolean; end(): void }
  interface Process {
    env: ProcessEnv; argv: string[]; platform: string; arch: string; pid: number; version: string; versions: { [k: string]: string };
    exitCode?: number;
    cwd(): string; chdir(dir: string): void; exit(code?: number): never; uptime(): number;
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    nextTick(cb: (...args: any[]) => void, ...args: any[]): void;
    memoryUsage(): { rss: number; heapTotal: number; heapUsed: number; external: number };
    hrtime: { (time?: [number, number]): [number, number]; bigint(): bigint };
    stdout: WritableLike; stderr: WritableLike; stdin: any;
  }
}
interface NodeRequire { (id: string): any; resolve(id: string): string; cache: any; main: NodeModule | undefined }
interface NodeModule { exports: any; id: string; filename: string; loaded: boolean; children: NodeModule[]; paths: string[]; require: NodeRequire }
interface BufferConstructor {
  from(data: string | ArrayBuffer | number[] | Uint8Array, encoding?: string): Buffer;
  alloc(size: number, fill?: string | number): Buffer;
  allocUnsafe(size: number): Buffer;
  concat(list: Uint8Array[], totalLength?: number): Buffer;
  isBuffer(obj: any): boolean;
  byteLength(s: string, encoding?: string): number;
}
interface Buffer extends Uint8Array {
  toString(encoding?: string, start?: number, end?: number): string;
  toJSON(): { type: string; data: number[] };
  equals(other: Uint8Array): boolean;
  write(s: string, offset?: number, encoding?: string): number;
  readUInt8(offset?: number): number;
  readUInt16LE(offset?: number): number;
  readUInt32LE(offset?: number): number;
  readInt32LE(offset?: number): number;
  writeUInt8(value: number, offset?: number): number;
  writeUInt32LE(value: number, offset?: number): number;
}

declare module "events" {
  class EventEmitter {
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;
    off(event: string | symbol, listener: (...args: any[]) => void): this;
    addListener(event: string | symbol, listener: (...args: any[]) => void): this;
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string | symbol): this;
    emit(event: string | symbol, ...args: any[]): boolean;
    listenerCount(event: string | symbol): number;
    listeners(event: string | symbol): Function[];
    setMaxListeners(n: number): this;
  }
  namespace EventEmitter { export { EventEmitter }; }
  export = EventEmitter;
}

declare module "fs" {
  import { EventEmitter } from "events";
  interface Stats { size: number; mtimeMs: number; mtime: Date; birthtime: Date; isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean }
  interface Dirent { name: string; isFile(): boolean; isDirectory(): boolean }
  interface ReadStream extends EventEmitter { pipe<T>(dest: T): T; setEncoding(enc: string): this; close(): void }
  interface WriteStream extends EventEmitter { write(chunk: string | Uint8Array): boolean; end(chunk?: string | Uint8Array): void }
  type Enc = string | { encoding?: string | null; flag?: string } | null;
  type Cb<T = void> = (err: Error | null, data: T) => void;
  function readFileSync(path: string, options: string | { encoding: string; flag?: string }): string;
  function readFileSync(path: string, options?: { encoding?: null; flag?: string } | null): Buffer;
  function writeFileSync(path: string, data: string | Uint8Array, options?: Enc): void;
  function appendFileSync(path: string, data: string | Uint8Array, options?: Enc): void;
  function existsSync(path: string): boolean;
  function mkdirSync(path: string, options?: { recursive?: boolean; mode?: number } | number): string | undefined;
  function readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
  function readdirSync(path: string, options?: any): string[];
  function statSync(path: string): Stats;
  function lstatSync(path: string): Stats;
  function unlinkSync(path: string): void;
  function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  function rmdirSync(path: string, options?: { recursive?: boolean }): void;
  function renameSync(oldPath: string, newPath: string): void;
  function copyFileSync(src: string, dest: string): void;
  function readFile(path: string, options: string | { encoding: string; flag?: string }, cb: Cb<string>): void;
  function readFile(path: string, cb: Cb<Buffer>): void;
  function writeFile(path: string, data: string | Uint8Array, cb: (err: Error | null) => void): void;
  function writeFile(path: string, data: string | Uint8Array, options: Enc, cb: (err: Error | null) => void): void;
  function appendFile(path: string, data: string | Uint8Array, cb: (err: Error | null) => void): void;
  function readdir(path: string, cb: Cb<string[]>): void;
  function mkdir(path: string, options: { recursive?: boolean } | number, cb: (err: Error | null) => void): void;
  function mkdir(path: string, cb: (err: Error | null) => void): void;
  function stat(path: string, cb: Cb<Stats>): void;
  function unlink(path: string, cb: (err: Error | null) => void): void;
  function access(path: string, cb: (err: Error | null) => void): void;
  function watch(path: string, listener?: (event: string, filename: string | null) => void): EventEmitter & { close(): void };
  function createReadStream(path: string, options?: string | { encoding?: string; start?: number; end?: number }): ReadStream;
  function createWriteStream(path: string, options?: string | { encoding?: string; flags?: string }): WriteStream;
  namespace promises {
    function readFile(path: string, options: string | { encoding: string; flag?: string }): Promise<string>;
    function readFile(path: string, options?: { encoding?: null; flag?: string } | null): Promise<Buffer>;
    function writeFile(path: string, data: string | Uint8Array, options?: Enc): Promise<void>;
    function appendFile(path: string, data: string | Uint8Array, options?: Enc): Promise<void>;
    function readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]>;
    function readdir(path: string, options?: any): Promise<string[]>;
    function mkdir(path: string, options?: { recursive?: boolean } | number): Promise<string | undefined>;
    function stat(path: string): Promise<Stats>;
    function unlink(path: string): Promise<void>;
    function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
    function rename(oldPath: string, newPath: string): Promise<void>;
    function copyFile(src: string, dest: string): Promise<void>;
    function access(path: string): Promise<void>;
  }
}
declare module "fs/promises" { import { promises } from "fs"; export = promises; }

declare module "path" {
  interface ParsedPath { root: string; dir: string; base: string; ext: string; name: string }
  function join(...paths: string[]): string;
  function resolve(...paths: string[]): string;
  function normalize(p: string): string;
  function relative(from: string, to: string): string;
  function dirname(p: string): string;
  function basename(p: string, ext?: string): string;
  function extname(p: string): string;
  function isAbsolute(p: string): boolean;
  function parse(p: string): ParsedPath;
  function format(obj: Partial<ParsedPath>): string;
  const sep: string;
  const delimiter: string;
}

declare module "os" {
  function platform(): string; function arch(): string; function type(): string; function release(): string;
  function hostname(): string; function homedir(): string; function tmpdir(): string; function uptime(): number;
  function totalmem(): number; function freemem(): number;
  function cpus(): { model: string; speed: number }[];
  function networkInterfaces(): { [name: string]: { address: string; family: string; internal: boolean; mac: string }[] | undefined };
  const EOL: string;
}

declare module "http" {
  import { EventEmitter } from "events";
  interface IncomingMessage extends EventEmitter { method?: string; url?: string; statusCode?: number; headers: { [k: string]: string | string[] | undefined }; setEncoding(enc: string): this; pipe<T>(dest: T): T }
  interface ServerResponse extends EventEmitter {
    statusCode: number; statusMessage: string;
    setHeader(name: string, value: string | number | string[]): this;
    getHeader(name: string): string | number | string[] | undefined;
    writeHead(status: number, headers?: { [k: string]: string | number | string[] }): this;
    write(chunk: string | Uint8Array): boolean;
    end(data?: string | Uint8Array, cb?: () => void): this;
  }
  interface Server extends EventEmitter {
    listen(port: number, host?: string, cb?: () => void): this;
    listen(port: number, cb?: () => void): this;
    close(cb?: (err?: Error) => void): this;
  }
  interface RequestOptions { hostname?: string; host?: string; port?: number; path?: string; method?: string; headers?: { [k: string]: string | number | string[] }; timeout?: number }
  function createServer(listener?: (req: IncomingMessage, res: ServerResponse) => void): Server;
  function request(options: RequestOptions | string | URL, cb?: (res: IncomingMessage) => void): EventEmitter & { write(d: string | Uint8Array): boolean; end(d?: string | Uint8Array): void };
  function get(options: RequestOptions | string | URL, cb?: (res: IncomingMessage) => void): EventEmitter & { end(): void };
  const STATUS_CODES: { [code: number]: string | undefined };
  const METHODS: string[];
}
declare module "https" { export * from "http"; }

declare module "util" {
  function promisify(fn: Function): (...args: any[]) => Promise<any>;
  function format(fmt: any, ...args: any[]): string;
  function inspect(obj: any, options?: { depth?: number | null; colors?: boolean; showHidden?: boolean }): string;
  function inherits(ctor: Function, superCtor: Function): void;
  function isDeepStrictEqual(a: any, b: any): boolean;
}

declare module "child_process" {
  import { EventEmitter } from "events";
  interface ChildProcess extends EventEmitter { pid?: number; stdout: EventEmitter | null; stderr: EventEmitter | null; stdin: { write(d: string | Uint8Array): boolean; end(): void } | null; kill(signal?: string | number): boolean }
  interface ExecOptions { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number; encoding?: string; shell?: string; maxBuffer?: number }
  function exec(command: string, cb?: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;
  function exec(command: string, options: ExecOptions, cb?: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;
  function execSync(command: string, options?: ExecOptions): string;
  function spawn(command: string, args?: string[], options?: ExecOptions & { stdio?: any; detached?: boolean }): ChildProcess;
  function spawnSync(command: string, args?: string[], options?: ExecOptions): { status: number | null; stdout: string; stderr: string; error?: Error };
  function fork(modulePath: string, args?: string[], options?: ExecOptions): ChildProcess;
}

declare module "url" {
  function fileURLToPath(url: string | URL): string;
  function pathToFileURL(path: string): URL;
  function parse(urlStr: string, parseQuery?: boolean): { protocol: string | null; host: string | null; hostname: string | null; port: string | null; pathname: string | null; search: string | null; query: any; hash: string | null; href: string };
  const URL: typeof globalThis.URL;
  const URLSearchParams: typeof globalThis.URLSearchParams;
}

declare module "crypto" {
  interface Hash { update(data: string | Uint8Array, inputEncoding?: string): Hash; digest(): Buffer; digest(encoding: string): string }
  function createHash(algorithm: string): Hash;
  function createHmac(algorithm: string, key: string | Uint8Array): Hash;
  function randomBytes(size: number): Buffer;
  function randomUUID(): string;
  function randomInt(max: number): number;
  function randomInt(min: number, max: number): number;
}

declare module "readline" {
  import { EventEmitter } from "events";
  interface Interface extends EventEmitter { question(query: string, cb: (answer: string) => void): void; close(): void; prompt(): void; setPrompt(p: string): void }
  function createInterface(options: { input: any; output?: any; terminal?: boolean }): Interface;
}

declare module "node:events" { import e = require("events"); export = e; }
declare module "node:fs" { export * from "fs"; }
declare module "node:fs/promises" { import p = require("fs/promises"); export = p; }
declare module "node:path" { export * from "path"; }
declare module "node:os" { export * from "os"; }
declare module "node:http" { export * from "http"; }
declare module "node:https" { export * from "http"; }
declare module "node:util" { export * from "util"; }
declare module "node:child_process" { export * from "child_process"; }
declare module "node:url" { export * from "url"; }
declare module "node:crypto" { export * from "crypto"; }
declare module "node:readline" { export * from "readline"; }
