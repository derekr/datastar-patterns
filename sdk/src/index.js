// Light root entry: sse + bus + routes + element. Deliberately EXCLUDES
// ./http (pulls 'msw') — importing the root must never drag the worker,
// the compiler, or any heavy dependency into the consumer's graph.
export * from './sse.js';
export * from './bus.js';
export * from './routes.js';
export * from './element.js';
