import { Stage, Event, Response, TimeStats, metronome } from "./v6";



/**
 * Wrapped Stage encapsulates a single other stage. Useful for 
 * retries, caches, timeouts, etc.
 */
export abstract class WrappedStage extends Stage {
  constructor(protected wrapped: Stage) {
    super();
  }
}



/**
 * A generic unbounded cache.
 */
export class Cache extends WrappedStage {
  protected _cache: any = {}
  async workOn(event: Event): Promise<void> {
    const inCache = !!this.get(event.key);
    if (inCache) {
      return;
    }
    /*
    const result = await this.wrapped.add(event)
    if (result == "success") {
      this._cache[event.key] = result;
      return;
    }
    throw "fail"

    // which is more succinctly written as
    */
    const r = await this.wrapped.accept(event);
    this.set(event.key, "success");
  }

  get(key: string): any {
    return this._cache[key]
  }
  set(key: string, value: any): void {
    this._cache[key] = value;
  }
}

/**
 * A cache that returns the data it has immediately, and has a 
 * background process to refresh the cache
 */
export class AsideCache extends Cache {
  protected _cache: any = {}
  async workOn(event: Event): Promise<void> {
    const self = this;
    this.wrapped.accept(event).then(() => self.set(event.key, "success"));

    const inCache = !!this.get(event.key);
    if (!inCache) {
      throw "fail"
    }
  }
}


/**
 * A fixed capacity cache that evicts the least recently used
 * elements first.
 */
export class LRUCache extends Cache {
  public capacity: number = 1000;
  protected order: string[] = [];

  public set(key: string, value: any): void {
    this.order = this.order.filter(x => x != key)
    this.order.push(key);
    if (this.order.length > this.capacity) {
      const keyToRemove = this.order.shift() as string;
      delete this._cache[keyToRemove];
    }
  }
}




/**
 * Wraps a stage and prevents it from being called if its error rate
 * crosses a threshold. This ensures that time isn't being spent
 * waiting for a response that has a non-zero change of a failure.
 */

export class CircuitBreaker extends WrappedStage {
  public threshold = 0.3;
  public capacity: number = 10;
  public timeInOpenState: number = 3000;

  protected _state: "closed" | "open" | "half-open" = "closed";
  protected _ring: number[] = [];
  protected _openTime = 0;
  async workOn(event: Event): Promise<void> {
    if (this._state == "open")
      throw "fail"
    await this.workOn(event);
  }

  public success(event: Event): Response {
    this.record(0);
    return super.success(event);
  }

  public fail(event: Event): Response {
    this.record(1)
    return super.success(event);
  }

  public record(status: number): void {
    this._ring.push(status);
    if (this._ring.length > this.capacity) {
      this._ring.shift();
    }

    this.decideState();
  }

  // We have 0, 0, 0, 0, 0, 0, 0, 1, 1, 1
  // avg = 0.3. avg > threshold ? 
  public decideState(): void {
    const sum = this._ring.reduce((a, c) => a + c, 0);
    if (this._ring.length >= this.capacity) {
      const sum = this._ring.reduce((a, c) => a + c, 0);
      const avg = sum / this.capacity;

      switch (this._state) {
        case "closed":
          if (avg > this.threshold)
            this.open();
          break;
        case "open":
          const diff: number = metronome.now() - this._openTime;
          if (diff > this.timeInOpenState)
            this.halfOpen();
          break;
        case "half-open":
          if (avg > this.threshold)
            this.open();
          else
            this.close();
      }
    }
  }

  public open(): void {
    this._state = "open";
    this._ring = [];
  }
  protected close(): void {
    this._state = "closed"
  }
  protected halfOpen(): void {
    this._state = "half-open"
  }
}

export class Retry extends WrappedStage {
  public count: number = 2;
  async workOn(event: Event): Promise<void> {
    let attempt: number = 0;
    while (attempt <= this.count) {
      try {
        await this.wrapped.accept(event);
        return;
      } catch {
        attempt++;
      }
    }
  }
}


/**
 * Limit the amount of time to wait for a response from the wrapped stage.
 */
export class Timeout extends WrappedStage {
  public timeout: number = 300;
  async workOn(event: Event): Promise<void> {
    const tookTooLong = metronome.wait(this.timeout).then(() => { throw "fail" });
    await Promise.race([tookTooLong, this.wrapped.accept(event)]);
  }
}




/**
 * A stage with a fixed availability
 */
export class AvailableLive extends Stage {
  public availability: number = 0.7;
  async workOn(event: Event): Promise<void> {
    const available = Math.random() < this.availability;
    if (available)
      return;
    return Promise.reject("fail");
  }
}


/**
 * A stage with a fixed availability and a normally distributed latency.
 * Probably could be refactored to extend AvailableStage
 */
export class TimedLive extends Stage {
  public mean: number = 150;
  public errorMean: number = 150;
  public std: number = 25;
  public errorStd: number = 25;

  public availability = 0.7;

  async workOn(event: Event): Promise<void> {
    const available = Math.random() < this.availability;
    if (available) {
      const latency = normal(this.mean, this.std);
      await metronome.wait(latency)
      return;
    }

    const latency = normal(this.mean, this.std);
    await metronome.wait(latency)
    return Promise.reject("fail");
  }
}























/**
 * Helper functions
 */

/**
 * The normal distribution, using a mean and standard deviation
 * @param mean 
 * @param std 
 */
export function normal(mean: number, std: number): number {
  return Math.floor(std_normal() * std + mean);
}
/**
 * Helper function for the standard normal
 */
function std_normal(): number {
  let u: number = 0;
  let v: number = 0;
  while (u == 0)
    u = Math.random();
  while (v == 0)
    v = Math.random();
  const value = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  if (isNaN(value)) {
    console.error("NAN achieved with values", u, v)
  }
  return value
}

function std_dev(arr: number[], mean?: number): number {
  const avg = mean || arr.reduce((sum, cur) => sum + cur, 0) / arr.length;
  return Math.sqrt(arr.map(x => (x - avg) ** 2).reduce((sum, cur) => sum + cur, 0) / arr.length);
}

















/**
 * Runner functions
 */


/**
 * 
 * @param stage The stage where events will be inserted
 * @param eventsPer1000Ticks The rate of requests (i.e. rps)
 * @param events The number of events
 */
export async function run(stage: Stage, eventsPer1000Ticks: number, numEventsToSend: number): Promise<void> {
  const delta = 1 / eventsPer1000Ticks;
  metronome.start();

  const pendingRequests = await sendEvents(stage, delta, numEventsToSend)
  const requests = await Promise.all(pendingRequests);
  metronome.stop();
  report(requests);
}


async function sendEvents(stage: Stage, tickDelta: number, numEventsToSend: number): Promise<Promise<Request>[]> {
  const requests: Promise<Request>[] = [];
  let eventsSent = 0;

  while (eventsSent < numEventsToSend) {
    eventsSent++;
    requests.push(createRequest(stage));
    await metronome.wait(tickDelta);
  }

  return requests;
}

function createRequest(stage: Stage): Promise<Request> {
  const event = new Event("hi");
  const time = new ResponseStats();
  time.startTime = metronome.now();

  return stage.accept(event).then(response => {
    time.endTime = metronome.now();
    return { event, response, time };
  }).catch(error => {
    time.endTime = metronome.now();
    return { event, response: error as Response, time }
  });
}


/**
 * Show interesting stats from the request data.
 * 
 * Show the following stats:
 * 
 * 1. % QoS? (we don't have access to this data)
 * 2. % success
 * 3. % latencies
 * 4. % slow failures? (interesting?)
 * @param requests The requests that have completed the simulation
 */
function report(requests: Request[]): void {
  const failTimes: number[] = [];
  const successTimes: number[] = [];

  requests.forEach(r => {
    const time = r.time.endTime - r.time.startTime;

    if (r.response == "fail") {
      failTimes.push(time);
    } else {
      successTimes.push(time);
    }
  })

  let success = successTimes.length;
  let fail = failTimes.length;

  const successAvg = successTimes.reduce((sum, cur) => sum + cur, 0) / success;
  const failAvg = failTimes.reduce((sum, cur) => sum + cur, 0) / fail;

  const successStdDevLatency = std_dev(successTimes, successAvg);
  const failStdDevLatency = std_dev(failTimes, failAvg);


  const precision = 3;
  const table = [
    {
      type: "success",
      count: success,
      percent: (success / requests.length).toFixed(precision),
      mean_latency: successAvg.toFixed(precision),
      std_latency: successStdDevLatency.toFixed(precision)
    },
    {
      type: "fail",
      count: fail,
      percent: (fail / requests.length).toFixed(precision),
      mean_latency: failAvg.toFixed(precision),
      std_latency: failStdDevLatency.toFixed(precision)
    },

  ]

  console.log("\nOverview of Requests");
  console.table(table);
}

/**
 * Print a need summary to the console describing requests' behavior within a
 * stage; specifically traffic and timing summaries.
 * 
 * @param stages A stage or an array of stages to report stats about
 */
export function summary(stages: Stage | Stage[]): void {
  const arr = Array.isArray(stages) ? stages : [stages]
  const times = arr.map(s => s.time);
  const traffic = arr.map(s => ({ stage: s.time.stage, ...s.traffic }));
  console.log("\nOverview of request time spent in stage")
  console.table(times)
  console.log("\nOverview of request behavior in stage")
  console.table(traffic);
}


/**
 * Additional prebuilt stats
 */
export class QueueStats {
  //?????
}
export class CacheStats {
  //?????
}

export class ResponseStats {
  public startTime: number = 0;
  public endTime: number = 0;
}
export type Request = {
  event: Event;
  response: Response;
  time: ResponseStats;
}