// ─── Monaco TypeScript / JavaScript Configuration ─────────────────────────────
// Configures Monaco's built-in TS service: compiler options, diagnostics,
// inlay hints (parameter names, enum values, return types), and extra type
// definitions for Node.js, React, and the Electron renderer API.
// Must load after Monaco loader resolves but before IntelliSense providers.
'use strict';

window.MonacoTSConfig = (() => {

  // ── Node.js minimal type stubs ─────────────────────────────────────────────
  const NODE_STUBS = `
declare var __dirname: string;
declare var __filename: string;
declare var exports: any;
declare function require(id: string): any;
declare namespace NodeJS {
  interface ProcessEnv { [key: string]: string | undefined; }
  interface Process {
    env: ProcessEnv; argv: string[]; pid: number; ppid: number;
    platform: 'win32' | 'darwin' | 'linux' | 'freebsd' | 'openbsd' | 'android' | 'cygwin';
    version: string; versions: Record<string, string>;
    exit(code?: number): never;
    cwd(): string; chdir(directory: string): void;
    stdout: any; stderr: any; stdin: any;
    hrtime(time?: [number, number]): [number, number];
    hrtime: { bigint(): bigint };
    nextTick(fn: (...args: any[]) => void, ...args: any[]): void;
    memoryUsage(): { rss: number; heapTotal: number; heapUsed: number; external: number };
    uptime(): number; arch: string; title: string;
  }
}
declare var process: NodeJS.Process;
declare var module: {
  exports: any; id: string; filename: string; loaded: boolean;
  parent: typeof module | null; children: (typeof module)[];
  require(id: string): any;
};
declare class Buffer extends Uint8Array {
  static from(data: string | ArrayBuffer | SharedArrayBuffer | ReadonlyArray<any>, encodingOrOffset?: string | number, length?: number): Buffer;
  static alloc(size: number, fill?: string | number | Buffer, encoding?: string): Buffer;
  static allocUnsafe(size: number): Buffer;
  static isBuffer(obj: any): obj is Buffer;
  static concat(list: ReadonlyArray<Uint8Array>, totalLength?: number): Buffer;
  static byteLength(str: string, encoding?: string): number;
  toString(encoding?: string, start?: number, end?: number): string;
  write(str: string, encoding?: string): number;
  readInt8(offset?: number): number;
  readUInt8(offset?: number): number;
  readUInt16LE(offset?: number): number;
  readUInt32LE(offset?: number): number;
  readDoubleBE(offset?: number): number;
  slice(start?: number, end?: number): Buffer;
  copy(target: Buffer, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
  equals(otherBuffer: Buffer): boolean;
  indexOf(value: string | number | Buffer, byteOffset?: number, encoding?: string): number;
  fill(value: any, offset?: number, end?: number, encoding?: string): this;
  includes(value: string | number | Buffer, byteOffset?: number, encoding?: string): boolean;
}
declare var Buffer: typeof Buffer & {
  from(data: string | ArrayBuffer | SharedArrayBuffer | ReadonlyArray<any>, encodingOrOffset?: string | number, length?: number): Buffer;
  alloc(size: number, fill?: string | number | Buffer, encoding?: string): Buffer;
  isBuffer(obj: any): obj is Buffer;
};

declare module 'fs' {
  interface Stats { isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean; size: number; mtime: Date; atime: Date; ctime: Date; birthtime: Date; mode: number; }
  interface ReadOptions { encoding?: string; flag?: string; }
  function readFileSync(path: string, options: { encoding: string; flag?: string } | string): string;
  function readFileSync(path: string, options?: { encoding?: null; flag?: string } | null): Buffer;
  function writeFileSync(path: string, data: string | Buffer | NodeJS.ArrayBufferView, options?: string | { encoding?: string; mode?: number; flag?: string }): void;
  function appendFileSync(path: string, data: string | Buffer, options?: string | { encoding?: string; mode?: number; flag?: string }): void;
  function existsSync(path: string): boolean;
  function mkdirSync(path: string, options?: { recursive?: boolean; mode?: number } | number): string | undefined;
  function rmdirSync(path: string, options?: { recursive?: boolean }): void;
  function unlinkSync(path: string): void;
  function renameSync(oldPath: string, newPath: string): void;
  function copyFileSync(src: string, dest: string, mode?: number): void;
  function readdirSync(path: string, options?: { withFileTypes?: false; encoding?: string }): string[];
  function readdirSync(path: string, options: { withFileTypes: true }): any[];
  function statSync(path: string, options?: { throwIfNoEntry?: boolean }): Stats;
  function lstatSync(path: string): Stats;
  function readlinkSync(path: string): string;
  function symlinkSync(target: string, path: string, type?: string): void;
  function chmodSync(path: string, mode: string | number): void;
  function readFile(path: string, options: { encoding: string } | string, cb: (err: NodeJS.Error | null, data: string) => void): void;
  function readFile(path: string, cb: (err: NodeJS.Error | null, data: Buffer) => void): void;
  function writeFile(path: string, data: string | Buffer, options: string | { encoding?: string }, cb: (err: NodeJS.Error | null) => void): void;
  function writeFile(path: string, data: string | Buffer, cb: (err: NodeJS.Error | null) => void): void;
  function mkdir(path: string, options: { recursive?: boolean }, cb: (err: NodeJS.Error | null, made?: string) => void): void;
  function mkdir(path: string, cb: (err: NodeJS.Error | null) => void): void;
  function unlink(path: string, cb: (err: NodeJS.Error | null) => void): void;
  function rename(oldPath: string, newPath: string, cb: (err: NodeJS.Error | null) => void): void;
  function stat(path: string, cb: (err: NodeJS.Error | null, stats: Stats) => void): void;
  function readdir(path: string, cb: (err: NodeJS.Error | null, files: string[]) => void): void;
  function watch(path: string, options: { persistent?: boolean; recursive?: boolean; encoding?: string }, listener: (event: string, filename: string | null) => void): { close(): void };
  function watch(path: string, listener: (event: string, filename: string | null) => void): { close(): void };
  function createReadStream(path: string, options?: { start?: number; end?: number; highWaterMark?: number; encoding?: string }): any;
  function createWriteStream(path: string, options?: { flags?: string; encoding?: string; start?: number }): any;
  const promises: {
    readFile(path: string, options: { encoding: string } | string): Promise<string>;
    readFile(path: string): Promise<Buffer>;
    writeFile(path: string, data: string | Buffer, options?: string | { encoding?: string }): Promise<void>;
    mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
    readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[]>;
    stat(path: string): Promise<Stats>;
    unlink(path: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    copyFile(src: string, dest: string): Promise<void>;
    access(path: string, mode?: number): Promise<void>;
  };
}
declare module 'path' {
  function join(...paths: string[]): string;
  function resolve(...paths: string[]): string;
  function dirname(p: string): string;
  function basename(p: string, ext?: string): string;
  function extname(p: string): string;
  function relative(from: string, to: string): string;
  function normalize(p: string): string;
  function isAbsolute(p: string): boolean;
  function parse(p: string): { root: string; dir: string; base: string; ext: string; name: string };
  function format(pathObject: { root?: string; dir?: string; base?: string; ext?: string; name?: string }): string;
  const sep: string; const delimiter: string; const posix: typeof import('path'); const win32: typeof import('path');
}
declare module 'os' {
  function homedir(): string; function tmpdir(): string; function platform(): string;
  function arch(): string; function hostname(): string; function type(): string;
  function release(): string; function cpus(): any[]; function totalmem(): number;
  function freemem(): number; function networkInterfaces(): Record<string, any[]>;
  function userInfo(): { username: string; uid: number; gid: number; shell: string; homedir: string };
  const EOL: string;
}
declare module 'events' {
  class EventEmitter {
    static defaultMaxListeners: number;
    static listenerCount(emitter: EventEmitter, eventName: string | symbol): number;
    addListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this;
    once(eventName: string | symbol, listener: (...args: any[]) => void): this;
    removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    off(eventName: string | symbol, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string | symbol): this;
    setMaxListeners(n: number): this;
    getMaxListeners(): number;
    listeners(eventName: string | symbol): Function[];
    rawListeners(eventName: string | symbol): Function[];
    emit(eventName: string | symbol, ...args: any[]): boolean;
    listenerCount(eventName: string | symbol): number;
    prependListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    prependOnceListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    eventNames(): Array<string | symbol>;
  }
  export = EventEmitter;
}
declare module 'child_process' {
  interface SpawnOptions { cwd?: string; env?: Record<string, string>; stdio?: any; shell?: boolean; windowsHide?: boolean; }
  interface ExecOptions extends SpawnOptions { maxBuffer?: number; timeout?: number; encoding?: string; }
  interface ChildProcess {
    stdin: any | null; stdout: any | null; stderr: any | null;
    pid: number | undefined; killed: boolean; exitCode: number | null;
    on(event: 'close' | 'exit', listener: (code: number | null, signal: string | null) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    kill(signal?: string | number): boolean;
  }
  function spawn(command: string, args?: ReadonlyArray<string>, options?: SpawnOptions): ChildProcess;
  function exec(command: string, callback: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;
  function exec(command: string, options: ExecOptions, callback: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;
  function execSync(command: string, options?: ExecOptions & { encoding?: string }): Buffer | string;
  function execFile(file: string, args?: string[] | null, options?: ExecOptions, callback?: (error: Error | null, stdout: string, stderr: string) => void): ChildProcess;
  function fork(modulePath: string, args?: string[], options?: SpawnOptions & { execPath?: string; execArgv?: string[]; silent?: boolean }): ChildProcess;
}
declare module 'crypto' {
  function createHash(algorithm: string): { update(data: string | Buffer, encoding?: string): any; digest(encoding?: string): any; };
  function createHmac(algorithm: string, key: string | Buffer): { update(data: string | Buffer): any; digest(encoding?: string): any; };
  function randomBytes(size: number): Buffer;
  function randomBytes(size: number, callback: (err: Error | null, buf: Buffer) => void): void;
  function randomUUID(): string;
  function createCipheriv(algorithm: string, key: string | Buffer, iv: string | Buffer): any;
  function createDecipheriv(algorithm: string, key: string | Buffer, iv: string | Buffer): any;
  function pbkdf2Sync(password: string | Buffer, salt: string | Buffer, iterations: number, keylen: number, digest: string): Buffer;
  function scryptSync(password: string | Buffer, salt: string | Buffer, keylen: number): Buffer;
}
declare module 'http' {
  interface IncomingMessage {
    headers: Record<string, string | string[] | undefined>; rawHeaders: string[];
    method?: string; url?: string; statusCode?: number; statusMessage?: string;
    socket: any; httpVersion: string;
    on(event: 'data', listener: (chunk: Buffer | string) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }
  interface ServerResponse {
    statusCode: number; statusMessage: string;
    setHeader(name: string, value: string | number | string[]): this;
    getHeader(name: string): string | number | string[] | undefined;
    removeHeader(name: string): void;
    writeHead(statusCode: number, headers?: Record<string, string | number | string[]>): this;
    write(chunk: string | Buffer, encoding?: string, callback?: (err?: Error | null) => void): boolean;
    end(chunk?: string | Buffer, encoding?: string, callback?: () => void): this;
    finished: boolean; writableEnded: boolean;
  }
  interface Server { listen(port?: number, hostname?: string, callback?: () => void): this; close(callback?: (err?: Error) => void): this; on(event: string, listener: (...args: any[]) => void): this; }
  function createServer(requestListener?: (req: IncomingMessage, res: ServerResponse) => void): Server;
  function request(url: string | URL | any, options?: any, callback?: (res: IncomingMessage) => void): any;
  function get(url: string | URL | any, options?: any, callback?: (res: IncomingMessage) => void): any;
}
declare module 'https' { export * from 'http'; }
declare module 'url' {
  class URL {
    constructor(input: string, base?: string | URL);
    href: string; origin: string; protocol: string; username: string; password: string;
    host: string; hostname: string; port: string; pathname: string; search: string;
    searchParams: URLSearchParams; hash: string;
    toString(): string; toJSON(): string;
  }
  class URLSearchParams {
    constructor(init?: string | Record<string, string> | Iterable<[string, string]>);
    append(name: string, value: string): void; delete(name: string): void;
    get(name: string): string | null; getAll(name: string): string[];
    has(name: string): boolean; set(name: string, value: string): void;
    toString(): string; entries(): IterableIterator<[string, string]>;
    keys(): IterableIterator<string>; values(): IterableIterator<string>;
    [Symbol.iterator](): IterableIterator<[string, string]>;
  }
  function parse(urlStr: string, parseQueryString?: boolean, slashesDenoteHost?: boolean): any;
  function format(url: any): string;
  function resolve(from: string, to: string): string;
}
declare module 'util' {
  function promisify<T extends (...args: any[]) => any>(fn: T): (...args: any[]) => Promise<any>;
  function inspect(object: any, options?: { depth?: number; colors?: boolean; showHidden?: boolean; maxArrayLength?: number }): string;
  function format(format?: string, ...params: any[]): string;
  function isDeepStrictEqual(val1: any, val2: any): boolean;
  const types: { isPromise(v: any): v is Promise<any>; isRegExp(v: any): v is RegExp; isMap(v: any): v is Map<any,any>; isSet(v: any): v is Set<any>; isBuffer(v: any): v is Buffer; };
}
declare module 'stream' {
  class Readable { on(event: string, listener: (...args: any[]) => void): this; pipe<T>(dest: T): T; read(size?: number): any; }
  class Writable { write(chunk: any, encoding?: string, callback?: (err?: Error | null) => void): boolean; end(chunk?: any, encoding?: string, callback?: () => void): void; on(event: string, listener: (...args: any[]) => void): this; }
  class Transform extends Readable { write(chunk: any, encoding?: string, callback?: (err?: Error | null) => void): boolean; end(chunk?: any, encoding?: string, callback?: () => void): void; }
  class PassThrough extends Transform {}
  function pipeline(source: any, ...streams: any[]): any;
}
declare module 'assert' {
  function assert(value: any, message?: string | Error): asserts value;
  function equal(actual: any, expected: any, message?: string | Error): void;
  function deepEqual(actual: any, expected: any, message?: string | Error): void;
  function strictEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
  function deepStrictEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
  function ok(value: any, message?: string | Error): asserts value;
  function notEqual(actual: any, expected: any, message?: string | Error): void;
  function throws(fn: () => any, error?: any, message?: string): void;
  function rejects(fn: () => Promise<any>, error?: any, message?: string): Promise<void>;
  export = assert;
}
`;

  // ── React minimal type stubs ───────────────────────────────────────────────
  const REACT_STUBS = `
declare namespace React {
  type Key = string | number;
  type ReactText = string | number;
  type ReactChild = ReactElement | string | number;
  type ReactNode = ReactChild | ReactFragment | ReactPortal | boolean | null | undefined;
  type ReactFragment = {} | ReactNodeArray;
  interface ReactNodeArray extends ReadonlyArray<ReactNode> {}
  interface ReactPortal extends ReactElement { key: Key | null; children: ReactNode; }
  type ElementType<P = any> = string | JSXElementConstructor<P>;
  type JSXElementConstructor<P> = ((props: P) => ReactElement<any, any> | null) | (new (props: P) => Component<any, any>);
  type ComponentType<P = {}> = ComponentClass<P> | FunctionComponent<P>;
  type FC<P = {}> = FunctionComponent<P>;
  interface FunctionComponent<P = {}> {
    (props: PropsWithChildren<P>, context?: any): ReactElement<any, any> | null;
    propTypes?: any; contextTypes?: any; defaultProps?: Partial<P>; displayName?: string;
  }
  interface VFC<P = {}> { (props: P, context?: any): ReactElement<any, any> | null; displayName?: string; }
  type PropsWithChildren<P = unknown> = P & { children?: ReactNode };
  type PropsWithRef<P> = 'ref' extends keyof P ? P extends { ref?: infer R } ? string extends R ? PropsWithoutRef<P> & { ref?: Exclude<R, string> } : P : P : P;
  type PropsWithoutRef<P> = P extends any ? ('ref' extends keyof P ? Omit<P, 'ref'> : P) : P;
  interface ReactElement<P = any, T extends ElementType = ElementType> { type: T; props: P; key: Key | null; }
  type CSSProperties = Partial<CSSStyleDeclaration>;
  interface HTMLAttributes<T> { className?: string; id?: string; style?: CSSProperties; onClick?: MouseEventHandler<T>; onChange?: ChangeEventHandler<T>; onKeyDown?: KeyboardEventHandler<T>; onSubmit?: FormEventHandler<T>; children?: ReactNode; ref?: any; key?: Key; [key: string]: any; }
  type MouseEventHandler<T = Element> = (event: MouseEvent) => void;
  type ChangeEventHandler<T = Element> = (event: { target: T & { value: string }; currentTarget: T & { value: string } }) => void;
  type KeyboardEventHandler<T = Element> = (event: KeyboardEvent) => void;
  type FormEventHandler<T = Element> = (event: Event) => void;
  interface Component<P = {}, S = {}, SS = any> {
    constructor(props: Readonly<P>): void;
    setState<K extends keyof S>(state: Pick<S, K> | S | ((prevState: Readonly<S>, props: Readonly<P>) => Pick<S, K> | S | null), callback?: () => void): void;
    forceUpdate(callback?: () => void): void;
    render(): ReactNode;
    readonly props: Readonly<P>; state: Readonly<S>; context: any; refs: { [key: string]: any };
  }
  interface ComponentClass<P = {}, S = {}> { new(props: P, context?: any): Component<P, S>; defaultProps?: Partial<P>; displayName?: string; }
  interface RefObject<T> { readonly current: T | null; }
  interface MutableRefObject<T> { current: T; }
  type Ref<T> = RefCallback<T> | RefObject<T> | null;
  type RefCallback<T> = (instance: T | null) => void;
  interface Context<T> { Provider: Provider<T>; Consumer: Consumer<T>; displayName?: string; }
  interface Provider<T> { (props: { value: T; children?: ReactNode }): ReactElement | null; }
  interface Consumer<T> { (props: { children: (value: T) => ReactNode }): ReactElement | null; }
  type Dispatch<A> = (value: A) => void;
  type SetStateAction<S> = S | ((prevState: S) => S);
  type Reducer<S, A> = (prevState: S, action: A) => S;
  type ReducerState<R extends Reducer<any, any>> = R extends Reducer<infer S, any> ? S : never;
  type ReducerAction<R extends Reducer<any, any>> = R extends Reducer<any, infer A> ? A : never;

  function createElement<P extends {}>(type: FunctionComponent<P> | ComponentClass<P> | string, props?: (Attributes & P) | null, ...children: ReactNode[]): ReactElement;
  function cloneElement<P>(element: ReactElement<P>, props?: Partial<P> & Attributes, ...children: ReactNode[]): ReactElement<P>;
  function createContext<T>(defaultValue: T): Context<T>;
  function forwardRef<T, P = {}>(render: (props: P, ref: Ref<T>) => ReactElement | null): ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<T>>;
  interface ForwardRefExoticComponent<P> extends NamedExoticComponent<P> { defaultProps?: Partial<P>; }
  interface NamedExoticComponent<P = {}> { (props: P): ReactElement | null; displayName?: string; }
  interface RefAttributes<T> extends Attributes { ref?: Ref<T>; }
  interface Attributes { key?: Key; }
  function memo<T extends ComponentType<any>>(Component: T, propsAreEqual?: (prevProps: Readonly<ComponentPropsAndRef<T>>, nextProps: Readonly<ComponentPropsAndRef<T>>) => boolean): MemoExoticComponent<T>;
  interface MemoExoticComponent<T extends ComponentType<any>> extends NamedExoticComponent<ComponentPropsAndRef<T>> { readonly type: T; }
  type ComponentPropsAndRef<T extends ElementType> = T extends new (props: infer P) => Component<any, any> ? PropsWithRef<P> : ComponentProps<T>;
  type ComponentProps<T extends ElementType> = T extends new (props: infer P) => any ? P : T extends (props: infer P, ...args: any) => any ? P : never;
  function lazy<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>): LazyExoticComponent<T>;
  interface LazyExoticComponent<T extends ComponentType<any>> extends ExoticComponent<ComponentPropsAndRef<T>> { readonly _payload: any; readonly _init: any; }
  interface ExoticComponent<P = {}> { (props: P): ReactElement | null; readonly $$typeof: symbol; }

  // Hooks
  function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  function useEffect(effect: () => (void | (() => void | undefined)), deps?: ReadonlyArray<any>): void;
  function useLayoutEffect(effect: () => (void | (() => void | undefined)), deps?: ReadonlyArray<any>): void;
  function useCallback<T extends (...args: any[]) => any>(callback: T, deps: ReadonlyArray<any>): T;
  function useMemo<T>(factory: () => T, deps: ReadonlyArray<any> | undefined): T;
  function useRef<T>(initialValue: T): MutableRefObject<T>;
  function useRef<T>(initialValue: T | null): RefObject<T>;
  function useRef<T = undefined>(): MutableRefObject<T | undefined>;
  function useContext<T>(context: Context<T>): T;
  function useReducer<R extends Reducer<any, any>, I>(reducer: R, initializerArg: I, initializer: (arg: I) => ReducerState<R>): [ReducerState<R>, Dispatch<ReducerAction<R>>];
  function useReducer<R extends Reducer<any, any>>(reducer: R, initialState: ReducerState<R>): [ReducerState<R>, Dispatch<ReducerAction<R>>];
  function useId(): string;
  function useTransition(): [boolean, (scope: () => void) => void];
  function useDeferredValue<T>(value: T): T;
  function useImperativeHandle<T, R extends T>(ref: Ref<T> | undefined, init: () => R, deps?: ReadonlyArray<any>): void;
  function useDebugValue<T>(value: T, format?: (value: T) => any): void;
  function useInsertionEffect(effect: () => void | (() => void), deps?: ReadonlyArray<any>): void;
  function useSyncExternalStore<T>(subscribe: (onStoreChange: () => void) => () => void, getSnapshot: () => T, getServerSnapshot?: () => T): T;

  const Fragment: ExoticComponent<{ children?: ReactNode }>;
  const StrictMode: ExoticComponent<{ children?: ReactNode }>;
  const Suspense: ExoticComponent<{ children?: ReactNode; fallback?: NonNullable<ReactNode> | null }>;
  const version: string;
  function isValidElement<P>(object: {} | null | undefined): object is ReactElement<P>;
  function Children: { map<T, C>(children: C | C[], fn: (child: C, index: number) => T): C extends null | undefined ? C : Array<Exclude<T, boolean | null | undefined>>; forEach<C>(children: C | C[], fn: (child: C, index: number) => void): void; count(children: any): number; only<C>(children: C): C extends any[] ? never : C; toArray(children: ReactNode | ReactNode[]): Array<Exclude<ReactNode, boolean | null | undefined>>; };
  function createRef<T = any>(): RefObject<T>;
  function createPortal(children: ReactNode, container: Element | DocumentFragment, key?: null | string): ReactPortal;
  function startTransition(scope: () => void): void;

  namespace JSX {
    interface Element extends ReactElement<any, any> {}
    interface ElementClass extends Component<any> { render(): ReactNode; }
    interface ElementAttributesProperty { props: {}; }
    interface ElementChildrenAttribute { children: {}; }
    interface IntrinsicElements {
      [elemName: string]: any;
      div: HTMLAttributes<HTMLDivElement>; span: HTMLAttributes<HTMLSpanElement>;
      p: HTMLAttributes<HTMLParagraphElement>; h1: HTMLAttributes<HTMLHeadingElement>;
      h2: HTMLAttributes<HTMLHeadingElement>; h3: HTMLAttributes<HTMLHeadingElement>;
      a: HTMLAttributes<HTMLAnchorElement> & { href?: string; target?: string; rel?: string };
      button: HTMLAttributes<HTMLButtonElement> & { type?: string; disabled?: boolean };
      input: HTMLAttributes<HTMLInputElement> & { type?: string; value?: string; placeholder?: string; checked?: boolean; readOnly?: boolean; disabled?: boolean; name?: string };
      form: HTMLAttributes<HTMLFormElement> & { action?: string; method?: string };
      img: HTMLAttributes<HTMLImageElement> & { src?: string; alt?: string; width?: string|number; height?: string|number };
      ul: HTMLAttributes<HTMLUListElement>; ol: HTMLAttributes<HTMLOListElement>;
      li: HTMLAttributes<HTMLLIElement>; label: HTMLAttributes<HTMLLabelElement> & { htmlFor?: string };
      table: HTMLAttributes<HTMLTableElement>; thead: HTMLAttributes<HTMLTableSectionElement>;
      tbody: HTMLAttributes<HTMLTableSectionElement>; tr: HTMLAttributes<HTMLTableRowElement>;
      td: HTMLAttributes<HTMLTableDataCellElement> & { colSpan?: number; rowSpan?: number };
      th: HTMLAttributes<HTMLTableHeaderCellElement> & { colSpan?: number; rowSpan?: number; scope?: string };
      textarea: HTMLAttributes<HTMLTextAreaElement> & { rows?: number; cols?: number; readOnly?: boolean; disabled?: boolean };
      select: HTMLAttributes<HTMLSelectElement> & { multiple?: boolean; disabled?: boolean };
      option: HTMLAttributes<HTMLOptionElement> & { value?: string; disabled?: boolean; selected?: boolean };
      nav: HTMLAttributes<HTMLElement>; header: HTMLAttributes<HTMLElement>;
      footer: HTMLAttributes<HTMLElement>; main: HTMLAttributes<HTMLElement>;
      section: HTMLAttributes<HTMLElement>; article: HTMLAttributes<HTMLElement>;
      aside: HTMLAttributes<HTMLElement>; figure: HTMLAttributes<HTMLElement>;
      figcaption: HTMLAttributes<HTMLElement>; details: HTMLAttributes<HTMLElement>;
      summary: HTMLAttributes<HTMLElement>; dialog: HTMLAttributes<HTMLDialogElement> & { open?: boolean };
      canvas: HTMLAttributes<HTMLCanvasElement> & { width?: number | string; height?: number | string };
      video: HTMLAttributes<HTMLVideoElement> & { src?: string; controls?: boolean; autoPlay?: boolean; muted?: boolean; loop?: boolean; width?: number | string; height?: number | string };
      audio: HTMLAttributes<HTMLAudioElement> & { src?: string; controls?: boolean; autoPlay?: boolean; muted?: boolean; loop?: boolean };
      svg: any; path: any; circle: any; rect: any; line: any; polyline: any; polygon: any;
      pre: HTMLAttributes<HTMLPreElement>; code: HTMLAttributes<HTMLElement>;
      strong: HTMLAttributes<HTMLElement>; em: HTMLAttributes<HTMLElement>;
      br: HTMLAttributes<HTMLBRElement>; hr: HTMLAttributes<HTMLHRElement>;
      iframe: HTMLAttributes<HTMLIFrameElement> & { src?: string; width?: string|number; height?: string|number; frameBorder?: string };
      script: HTMLAttributes<HTMLScriptElement> & { src?: string; async?: boolean; defer?: boolean; type?: string };
      link: HTMLAttributes<HTMLLinkElement> & { rel?: string; href?: string; type?: string };
      meta: HTMLAttributes<HTMLMetaElement> & { name?: string; content?: string; property?: string };
      style: HTMLAttributes<HTMLStyleElement>; head: HTMLAttributes<HTMLHeadElement>; body: HTMLAttributes<HTMLBodyElement>;
    }
  }
}
declare module 'react' { export = React; export as namespace React; }
declare module 'react-dom' {
  function render(element: React.ReactElement, container: Element | DocumentFragment | null, callback?: () => void): React.Component<any> | Element | void | null;
  function hydrate(element: React.ReactElement, container: Element | DocumentFragment | null, callback?: () => void): React.Component<any> | Element | void | null;
  function unmountComponentAtNode(container: Element | DocumentFragment): boolean;
  function createPortal(children: React.ReactNode, container: Element | DocumentFragment, key?: null | string): React.ReactPortal;
  function findDOMNode(instance: React.Component<any> | Element | null | undefined): Element | null | Text;
  function flushSync<R>(fn: () => R): R;
  function createRoot(container: Element | DocumentFragment, options?: { hydrate?: boolean; identifierPrefix?: string }): { render(children: React.ReactNode): void; unmount(): void; };
  function hydrateRoot(container: Element | Document, initialChildren: React.ReactNode, options?: { identifierPrefix?: string; onRecoverableError?: (error: unknown) => void }): { render(children: React.ReactNode): void; unmount(): void; };
}
declare module 'react/jsx-runtime' { export const jsx: any; export const jsxs: any; export const Fragment: React.ExoticComponent<{ children?: React.ReactNode }>; }
declare module 'react/jsx-dev-runtime' { export const jsxDEV: any; export const Fragment: React.ExoticComponent<{ children?: React.ReactNode }>; }
`;

  // ── Electron renderer API stubs ────────────────────────────────────────────
  const ELECTRON_STUBS = `
interface ElectronAPI {
  readFileContent(path: string): Promise<string | null>;
  writeFileContent(path: string, content: string): Promise<{ ok: boolean; error?: string }>;
  listWorkspaceFiles(root: string): Promise<string[]>;
  openFile(): Promise<{ path: string; content: string } | null>;
  saveFile(path: string, content: string): Promise<{ ok: boolean; error?: string }>;
  saveFileAs(defaultPath?: string, content?: string): Promise<{ ok: boolean; path?: string; error?: string }>;
  openFolder(): Promise<string | null>;
  getRecentFiles(): Promise<string[]>;
  addRecentFile(filePath: string): Promise<void>;

  // Window controls
  minimize(): void; maximize(): void; closeWindow(): void;
  isMaximized(): Promise<boolean>; onMaximize(cb: () => void): void; onUnmaximize(cb: () => void): void;

  // LSP
  lspStart(serverId: string): Promise<{ ok: boolean; builtin?: boolean; error?: string; state?: string }>;
  lspStop(serverId: string): Promise<{ ok: boolean }>;
  lspRequest(serverId: string, method: string, params: any): Promise<{ result?: any; error?: string }>;
  lspNotify(serverId: string, method: string, params: any): void;
  lspStatus(): Promise<Record<string, { id: string; name: string; state: string; langs?: string[]; error?: string | null; installHint?: string }>>;
  lspDetect(): Promise<Record<string, boolean>>;
  onLspMessage(callback: (msg: { server: string; message: any }) => void): void;
  onLspServerStatus(callback: (status: { id: string; state: string; name?: string; error?: string }) => void): void;

  // Workspace
  openWorkspace(filePath?: string): Promise<{ ok: boolean; workspace?: any; error?: string }>;
  saveWorkspace(workspace: any, filePath?: string): Promise<{ ok: boolean; path?: string; error?: string }>;
  getRecentWorkspaces(): Promise<Array<{ name: string; path: string }>>;

  // Terminal
  spawnPty(options?: { cwd?: string; env?: Record<string, string> }): Promise<number>;
  writePty(pid: number, data: string): void;
  resizePty(pid: number, cols: number, rows: number): void;
  killPty(pid: number): void;
  onPtyData(callback: (data: { pid: number; data: string }) => void): void;
  onPtyExit(callback: (data: { pid: number; code: number | null }) => void): void;

  // Git
  gitStatus(cwd: string): Promise<any>;
  gitLog(cwd: string, n?: number): Promise<any>;
  gitDiff(cwd: string, file?: string): Promise<string>;

  // System
  platform: 'win32' | 'darwin' | 'linux';
  appVersion: string;
  shell: { openExternal(url: string): Promise<void>; openPath(path: string): Promise<{ errorMessage: string }>; };
}
declare const electronAPI: ElectronAPI;
`;

  // ── Inlay hints level cycling ──────────────────────────────────────────────
  const _LEVELS = ['none', 'literals', 'all'];
  let _levelIdx = 1;

  function _buildInlayOpts(level) {
    const all = level === 'all';
    const any = level !== 'none';
    return {
      includeInlayParameterNameHints:                        level,
      includeInlayParameterNameHintsWhenArgumentMatchesName: false,
      includeInlayFunctionParameterTypeHints:                all,
      includeInlayVariableTypeHints:                         all,
      includeInlayVariableTypeHintsWhenTypeMatchesName:      false,
      includeInlayPropertyDeclarationTypeHints:              all,
      includeInlayFunctionLikeReturnTypeHints:               all,
      includeInlayEnumMemberValueHints:                      any,
    };
  }

  // ── Configure Monaco TS/JS service ────────────────────────────────────────
  function configure() {
    if (typeof monaco === 'undefined') return;

    const tsD = monaco.languages.typescript.typescriptDefaults;
    const jsD = monaco.languages.typescript.javascriptDefaults;

    // ── Compiler options ──────────────────────────────────────────────────
    const sharedOpts = {
      allowNonTsExtensions:         true,
      allowJs:                      true,
      target:                       monaco.languages.typescript.ScriptTarget.ES2022,
      jsx:                          monaco.languages.typescript.JsxEmit.ReactJSX,
      moduleResolution:             monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module:                       monaco.languages.typescript.ModuleKind.ESNext,
      lib:                          ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts', 'lib.es2022.full.d.ts'],
      esModuleInterop:              true,
      allowSyntheticDefaultImports: true,
      resolveJsonModule:            true,
      skipLibCheck:                 true,
      noEmit:                       true,
      noImplicitAny:                false,
      strictNullChecks:             false,
      strict:                       false,
      experimentalDecorators:       true,
      emitDecoratorMetadata:        true,
      useDefineForClassFields:      true,
      isolatedModules:              false,
      forceConsistentCasingInFileNames: true,
    };

    tsD.setCompilerOptions({ ...sharedOpts });
    jsD.setCompilerOptions({ ...sharedOpts, checkJs: false });

    // ── Diagnostics ───────────────────────────────────────────────────────
    tsD.setDiagnosticsOptions({
      noSemanticValidation:    false,
      noSyntaxValidation:      false,
      noSuggestionDiagnostics: false,
      onlyVisible:             false,
    });
    jsD.setDiagnosticsOptions({
      noSemanticValidation:    true,  // less noisy for JS files
      noSyntaxValidation:      false,
      noSuggestionDiagnostics: true,
    });

    // ── Inlay hints (default: literals only) ─────────────────────────────
    const inlayOpts = _buildInlayOpts(_LEVELS[_levelIdx]);
    tsD.setInlayHintsOptions?.(inlayOpts);
    jsD.setInlayHintsOptions?.(inlayOpts);

    // ── Eager model sync for snappier completions ─────────────────────────
    tsD.setEagerModelSync(true);
    jsD.setEagerModelSync(true);

    // ── Extra type definitions ────────────────────────────────────────────
    tsD.addExtraLib(NODE_STUBS,     'ts:lib/node.d.ts');
    tsD.addExtraLib(REACT_STUBS,    'ts:lib/react.d.ts');
    tsD.addExtraLib(ELECTRON_STUBS, 'ts:lib/electron-renderer.d.ts');
    jsD.addExtraLib(NODE_STUBS,     'ts:lib/node.d.ts');
    jsD.addExtraLib(REACT_STUBS,    'ts:lib/react.d.ts');
    jsD.addExtraLib(ELECTRON_STUBS, 'ts:lib/electron-renderer.d.ts');

    // ── Editor-level inlay hints rendering ────────────────────────────────
    if (window.editor) {
      window.editor.updateOptions({
        inlayHints: { enabled: _LEVELS[_levelIdx] !== 'none' ? 'on' : 'off' },
      });
    }
  }

  // ── Cycle inlay hint level ─────────────────────────────────────────────────
  function cycleInlayHints() {
    if (typeof monaco === 'undefined') return _LEVELS[_levelIdx];
    _levelIdx = (_levelIdx + 1) % _LEVELS.length;
    const level = _LEVELS[_levelIdx];
    const opts  = _buildInlayOpts(level);
    monaco.languages.typescript.typescriptDefaults.setInlayHintsOptions?.(opts);
    monaco.languages.typescript.javascriptDefaults.setInlayHintsOptions?.(opts);
    const enabled = level !== 'none' ? 'on' : 'off';
    window.editor?.updateOptions({ inlayHints: { enabled } });
    return level;
  }

  // ── Re-apply when a new editor is created ─────────────────────────────────
  function applyEditorOptions(ed) {
    const level = _LEVELS[_levelIdx];
    ed.updateOptions({
      inlayHints: { enabled: level !== 'none' ? 'on' : 'off' },
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  document.addEventListener('monaco-ready', () => {
    configure();

    window.NoterCommands?.register({
      id:          'ts.toggleInlayHints',
      title:       'Toggle Inlay Hints',
      category:    'Editor',
      description: 'Cycle inlay hint level: none → parameter literals → all types',
      aliases:     ['inlay hints', 'parameter names', 'type hints', 'inlay'],
      handler() {
        const level = cycleInlayHints();
        typeof toast === 'function' && toast(`Inlay hints: ${level}`);
      },
    });

    window.NoterCommands?.register({
      id:          'ts.enableStrictMode',
      title:       'Enable TypeScript Strict Mode',
      category:    'TypeScript',
      description: 'Enable strict type checking in Monaco TypeScript service',
      aliases:     ['strict mode', 'typescript strict'],
      handler() {
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          ...monaco.languages.typescript.typescriptDefaults.getCompilerOptions(),
          strict: true, strictNullChecks: true, noImplicitAny: true,
        });
        typeof toast === 'function' && toast('TypeScript strict mode enabled');
      },
    });

    window.NoterCommands?.register({
      id:          'ts.checkDiagnostics',
      title:       'Check TypeScript Diagnostics',
      category:    'TypeScript',
      description: 'Toggle semantic diagnostics for TypeScript files',
      aliases:     ['ts diagnostics', 'type check'],
      handler() {
        const current = monaco.languages.typescript.typescriptDefaults.getDiagnosticsOptions();
        const next    = !current.noSemanticValidation;
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          ...current, noSemanticValidation: next,
        });
        typeof toast === 'function' && toast(`TS semantic diagnostics ${next ? 'off' : 'on'}`);
      },
    });
  });

  return { configure, cycleInlayHints, applyEditorOptions };
})();
