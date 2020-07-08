# Quartermaster

A formalization of graceful degradation techniques, and framework to simulate their behavior.

## Table of Contents

**[1. Formalization](#Formalization)**

**[2. Framework](#Framework)**

**[3. Examples](#Examples)**

**[4. Tests](#Tests)**

## Formalization

A system that is fault tolerant is resistant to faults, often by allowing the system to degrade gracefully instead of failing immediately. There are certain techniques that are commonly used in industry, such as caching, retries, short timeouts, and the circuit breaker pattern.

Quartermaster describes these techniques as various configurations of single unit: the stage. A stage contains a queue and several methods which can be overwritten: `add()`, `workOn()`, `success()`, and `fail()`. Events are the basic units that pass through stages. In a web system, these events are analogous be http requests.

`add()` An admission control function, called before the event enters the queue.
\
`workOn()` Called when the event has left the queue and has been picked up by a worker.
\
`success()` Called when `workOn()` did not throw an error or returned a rejected promise.
\
`fail()` Called when `workOn()` did throw an error or returned a rejected promise.

[Read more about the formalization of Quartermaster.](docs/formalization.md)

## Framework

A framework is provided to implement these methods and simulate their behavior. Provided with this code is a set of prebuilt code, is some simulation tools. Since this repository is a typescript implementation of the framework, we've included a brief overview here. You can [read more in-depth about the Quartermaster framework](docs/framework.md) in our docs.

### Installation

`npm i ....`

### Usage

A sample usage, representing a call to a remote dependency with a cache:

```typescript
import {
  TimedDependency,
  stageSummary,
  simulation,
  LRUCache,
  eventSummary,
} from "../src";

/**
 * The timed example is the basic unit of several other examples. It features
 * a timed dependency, which might represent a database and a cache that sits
 * in front of the dependency.
 */

const live = new TimedDependency();
live.availability = 0.995;
live.mean = 150;
live.std = 20;

const cache = new LRUCache(live);
cache.ttl = 30000;
cache.capacity = 500;

simulation.keyspaceMean = 999;
simulation.keyspaceStd = 90;
simulation.eventsPer1000Ticks = 40;

work();
async function work() {
  const events = await simulation.run(cache, 20000);
  eventSummary(events);
  stageSummary([cache, live]);
}
```

### Rich Output

The framework's `eventSummary([...events])` displays a quick summary of statistics of the events.

```
Overview of Events
┌─────────┬───────────┬───────┬─────────┬──────────────┬─────────────┐
│ (index) │   type    │ count │ percent │ mean_latency │ std_latency │
├─────────┼───────────┼───────┼─────────┼──────────────┼─────────────┤
│    0    │ 'success' │   4   │ '0.800' │  '153.500'   │  '10.874'   │
│    1    │  'fail'   │   1   │ '0.200' │  '144.000'   │   '0.000'   │
└─────────┴───────────┴───────┴─────────┴──────────────┴─────────────┘
```

The framework also comes bundled with `stageSummary([...stages])` methods, which displays rich output of a set of stages.

```
Overview of event time spent in stage
┌─────────┬─────────────┬───────────┬──────────┐
│ (index) │    stage    │ queueTime │ workTime │
├─────────┼─────────────┼───────────┼──────────┤
│    0    │ 'LRUCache'  │     7     │   604    │
│    1    │ 'TimedLive' │    10     │   592    │
└─────────┴─────────────┴───────────┴──────────┘

Overview of event behavior in stage
┌─────────┬─────────────┬─────┬────────┬─────────┬──────┐
│ (index) │    stage    │ add │ workOn │ success │ fail │
├─────────┼─────────────┼─────┼────────┼─────────┼──────┤
│    0    │ 'LRUCache'  │  5  │   5    │    4    │  1   │
│    1    │ 'TimedLive' │  5  │   5    │    4    │  1   │
└─────────┴─────────────┴─────┴────────┴─────────┴──────┘
```

### Prebuilt Techniques

You don't need to code your system up in the framework to use it. Quartermaster comes with a set of prebuilt techniques that are easily configured. If they don't cover all of your requirements, we've provided examples to help build your own techniques.

- Caching
  - Unbounded: An unlimited size cache
  - LRU: A fixed capacity cache, that evicts the least-recently-used elements.
  - Background Cache: A cache which serves inbound requests strictly from cached data, and refreshes the requested data in the background.
- Circuit Breaker Pattern: Don't wait for an operation that will (or is likely to) fail.
- Retry: Attempt multiple times upon a failure.
- Timeout: Limit how much time is being spent working on an event.

Additionally, we've included some prebuilt stages to simulate the actual dependency (such as a database, another remote dependency, or even a 3rd party API) that is being called.

- AvailableDependency: Responds immediately with some availability.
- TimedDependency: Responds with some availability and latency distributions.

Our [examples](docs/examples.md) show you many of these in action.

### Custom Statistics

While the quartermaster framework looks at measuring and evaluating graceful degradation, it is possible that you want to measure additional properties or analyze other behavior of the system. The framework is flexible enough to support doing this, and we've provided an example which includes a few ways to do so. See [the custom statistics example](docs/examples.md).

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
- [x] Stats:
  - System wide stats? (snapshots)
    - Heap snapshot
    - CPU utilization
    - Cache hit rate
    - Latency stats
- [ ] QoS????

## TODO:

- [ ] Readme
  - [x] Main
  - [x] Formalization
  - [x] Framework
  - [ ] Examples
- [x] finish simulation
- [ ] Tests
  - [x] Queues
  - [x] Caches
  - [ ] Stages
  - [ ] Simulator
  - [ ] Metronome

* [ ] tool for calculating gamma distribution from 50, 90, 95th percentiles
