# Quartermaster

A formalization of graceful degradation techniques, and framework to simulate their behavior.

## Table of Contents

**[1. Formalization](#Formalization)**

**[2. Framework](#Framework)**

**[3. Examples](#Examples)**

**[4. Tests](#Tests)**

## Formalization

A system that is fault tolerant is resistant to faults, often by allowing the system to degrade gracefully instead of failing immediately. There are certain techniques that are commonly used in industry, such as caching, retries, short timeouts, and the circuit breaker pattern.

Quartermaster describes these techniques as various configurations of single unit: the stage. A stage contains a queue and several methods which can be overwritten: `add()`, `workOn()`, `tick()`, `success()`, and `fail()`. Events are the basic units that pass through stages. In a web system, these events are analogous be http requests.

`add()` An admission control function, called before the event enters the queue.
\
`workOn()` Called when the event has left the queue and has been picked up by a worker.
\
`success()` Called when `workOn()` did not throw an error or returned a rejected promise.
\
`fail()` Called when `workOn()` did throw an error or returned a rejected promise.

[Read more about the formalization of Quartermaster.](docs/formalization.md)

## Framework

A framework is provided to implement these methods and simulate their behavior. Provided with this code is a set of prebuilt code, is some simulation tools.

### Installation

`npm i ....`

### Usage

A sample usage, representing a call to a remote dependency with a cache:

```typescript
import { TimedLive, Cache, run, summary } from "....";

const live = new TimedLive();
live.mean = 150;
live.std = 20;

const cache = new Cache(live);

work();
async function work() {
  await run(cache, 30, 5);
  summary([cache, live]);
}
```

### Rich Output

The framework's `run()` includes an overview of the events that were simulated.

```
Overview of Events
┌─────────┬───────────┬───────┬─────────┬──────────────┬─────────────┐
│ (index) │   type    │ count │ percent │ mean_latency │ std_latency │
├─────────┼───────────┼───────┼─────────┼──────────────┼─────────────┤
│    0    │ 'success' │   4   │ '0.800' │  '153.500'   │  '10.874'   │
│    1    │  'fail'   │   1   │ '0.200' │  '144.000'   │   '0.000'   │
└─────────┴───────────┴───────┴─────────┴──────────────┴─────────────┘
```

The framework also comes bundled with a `summary()` method, which displays rich output of a set of stages.

```
Overview of event time spent in stage
┌─────────┬─────────────┬───────────┬──────────┐
│ (index) │    stage    │ queueTime │ workTime │
├─────────┼─────────────┼───────────┼──────────┤
│    0    │   'Cache'   │     7     │   604    │
│    1    │ 'TimedLive' │    10     │   592    │
└─────────┴─────────────┴───────────┴──────────┘

Overview of event behavior in stage
┌─────────┬─────────────┬─────┬────────┬─────────┬──────┐
│ (index) │    stage    │ add │ workOn │ success │ fail │
├─────────┼─────────────┼─────┼────────┼─────────┼──────┤
│    0    │   'Cache'   │  5  │   5    │    4    │  1   │
│    1    │ 'TimedLive' │  5  │   5    │    4    │  1   │
└─────────┴─────────────┴─────┴────────┴─────────┴──────┘
```

### Prebuilt Techniques

Some common techniques have been prebuilt using this framework for ease of use.

- Caching
  - Unbounded
  - LRU
  - Background Cache
- Retry
- Circuit Breaker pattern
- Timeout

### Custom Statistics

## Examples

The `./examples` directory includes some interesting examples with documentation and descriptions.

[Read more about examples provided with Quartermaster.](docs/examples.md)

## Tests

Tests can be run with `npm test`.

All prebuilt components have been placed under tests, located in the `./tests` directory.

### Notes:

Confusing:

- [x] Should we keep event and request separated? XXXXX
- [x] Combine stats in event and request?
- [ ] Stats:
  - System wide stats? (snapshots)
    - Heap snapshot
    - CPU utilization
    - Cache hit rate
    - Latency stats

## TODO:

- [ ] Finish readme,
- [ ] finish simulation
- [ ] write tests
- [ ] tool for calculating gamma distribution from 50, 90, 95th percentiles
