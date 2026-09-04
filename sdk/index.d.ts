// Hand-written public types for datastar-browser-kit (0.0.1 sketch).
// Kept in sync with src/ by review — no codegen yet.

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type Resolver = (info: { request: Request; params: Record<string, string> }) => Response | Promise<Response>;

export interface RouteRecord {
  method: string;
  path: string;
  resolver: Resolver;
}

export interface RouteTable {
  add(method: string, path: string, resolver: Resolver): void;
  remove(method: string, path: string): void;
  clear(): void;
  entries(): RouteRecord[];
  resolve(method: string, path: string): Resolver | undefined;
}

export function createRoutes(): RouteTable;

export interface PatchElementsOptions {
  mode?: string | null;
  selector?: string | null;
}
export interface PatchSignalsOptions {
  onlyIfMissing?: boolean;
}
export function sse(...blocks: string[]): string;
export function esc(s: unknown): string;
export function patchElements(elements: string, opts?: PatchElementsOptions): string;
export function patchSignals(json: string, opts?: PatchSignalsOptions): string;
export function text(body: string): Response;
export function wait(ms: number): Promise<void>;
export function readSignals(req: Request): Promise<Record<string, unknown>>;
export interface StreamCtl {
  every(ms: number, fn: () => void): unknown;
  after(ms: number, fn: () => void): unknown;
  close(): void;
}
export function closeStreams(): void;
export function stream(setup: (write: (txt: string) => void, ctl: StreamCtl) => void): Response;

export interface BusMessage {
  kind: string;
  [key: string]: unknown;
}
export interface Bus {
  readonly id: string;
  send(msg: BusMessage): void;
  on(kind: string, fn: (msg: BusMessage) => void, owner?: string): () => void;
  clearOwner(owner: string): void;
  receive(kind: string, msg: BusMessage): void;
  close(): void;
}
export function createBus(name?: string): Bus;

export interface ShellLoader {
  (el: HTMLElement): unknown | Promise<unknown>;
}
export interface ShellRender {
  (stage: HTMLElement, module: unknown, el: HTMLElement): void | Promise<void>;
}
export interface ShellOptions {
  load?: ShellLoader;
  render?: ShellRender;
  observed?: string[];
}
export function defineShell(name: string, opts?: ShellOptions): CustomElementConstructor;
