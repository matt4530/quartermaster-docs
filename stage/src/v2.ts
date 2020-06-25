export interface Request { }
export interface Queue {
  enqueue(request: Request): void;
  dequeue(): Request | undefined;
  isFull(): boolean;
}
export type Response = "success" | "fail"
export type Dependency = (request: Request) => void;

/**
 * A stage represents a single remote dependency. A stage can be changed to
 * represent a series of remote dependencies, i.e. a distributed cache that
 * sits in front of a live web service. A stage is made up of (1) a queue
 * and (2) the actual dependency.
 * 
 * A stage contains functions that act as event listeners, dispatching with
 * the target of the event, such as the request, as the only argument. These
 * functions can be logically grouped by when they can occur.
 * 
 * 1) `arrive()` `tick()` and `evict()` occur when requests are working with the
 * queue.
 * 
 * 2) `success()`, `failure()`, and `respond()` occur when requests are working
 * with the dependency.
 */
export class Stage {
  constructor(
    public readonly queue: Queue,
    public readonly next?: Stage | Stage[]
  ) { }

  /**
   * A request has arrived at the stage to be inserted in the queue or 
   * rejected.
   * @param request The request that arrived at the stage
   */
  public arrive(request: Request): void {
    if (this.queue.isFull())
      this.evict(request);
    else
      this.queue.enqueue(request);
  }

  /**
   * Called on every tick. 
   * 
   * Behavior that happens at scheduled times, such as maintenance or adaptive
   * calculations, or information that shouldn't be recalculated for every
   * request should goes here.
   * 
   * Additionally, reneging behavior can be done here.
   */
  public tick(): void { }


  /**
   * A request has been evicted from the queue.
   * 
   * This catches both when requests balk or are evicted.
   * 
   * @param request The request that has exited the queue early.
   */
  public evict(request: Request): void {
    this.respond(request, "fail")
  }


  /**
   * A request has reached the dependency.
   * 
   * @param request The request to be fulfilled by the dependency
   */
  public dependency(request: Request): void {
    const t = normal(1000, 50);
    if (t > 300)
      return
  }



  /**
   * A request has recieved a success response from the actual dependency.
   * @param request The request that succeeded
   */
  public success(request: Request): void {
    if (this.next) {
      if (Array.isArray(this.next))
        this.next.forEach(next => next.arrive(request));
      else
        this.next.arrive(request);

    }
    this.respond(request, "success");
  }

  /**
   * A request has recieved a failing response from the actual dependency.
   * 
   * A retry behavior can be done here.
   * 
   * @param request The request that failed.
   */
  public failure(request: Request): void {
    this.respond(request, "fail")
  }


  /**
   * Respond with some data to the requester.
   * 
   * A single final response can be returned on behalf of the request. No 
   * additional responses can be returned, but processing on behalf of a 
   * response, such as waiting longer for a response, can continue in the 
   * service.
   * 
   * @param request The request that being fulfilled by the response.
   * @param response The response to the request, being a success or failure
   */
  public respond(request: Request, response: Response): void { }
}



class ArrQueue implements Queue {
  arr: Request[] = [];
  constructor(public capacity: number, public workers: number) { }
  enqueue(request: Request): void {
    this.arr.push(request);
  }
  dequeue(): Request | undefined {
    return this.arr.shift();
  }
  isFull(): boolean {
    return this.arr.length == this.capacity
  }

}


function normal(mean: number, std: number): number {
  return std_normal() * std + mean;
}
function std_normal(): number {
  let u: number = 0;
  let v: number = 0;
  while (u == 0)
    u = Math.random();
  while (v == 0)
    v = Math.random();
  return Math.sqrt(-2 * Math.log(u) * Math.cos(2 * Math.PI * v));
}











/**
 * An in memory cache will always succeed at serving all requests, with only
 * a small bit of latency.
 */
const inMemoryCache = new Stage(new ArrQueue(10, 10), (request: Request) => { })







/*


const m = new Metronome();

const adaption: AdaptiveFunction = {
  func: () => { },
  toString: () => "none"
}
const a: Approach = new Approach(10000, { discipline: "FIFO", length: 8, servers: 4 }, { count: 1, fallback: 0.1, timeout: 180 }, adaption);
const c: Context = {
  arrivalRate: new PoissonDistribution(30),
  capacity: 30,
  costOfDelay: (aoi: number) => 1,
  dependencyCapacity: 30,
  keyspace: new NormalDistribution(1000, 50),
  numRequests: 10000,
  utility: (latency: number) => 1,
}

let degraded: Condition = {
  availability: new ConstantDistribution(0.995),
  successLatency: new GammaDistribution(6, 15),
  errorLatency: new GammaDistribution(6, 15),
}

let sim = new Simulator(m, a, c, [NormalCondition, degraded]);
run();

async function run() {
  await sim.run();
  const data = sim.getAll();
  console.log(data);
}
*/