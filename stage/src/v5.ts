/*
   Cool, SEDA-ish design

   Allows multiple queues.
   It is too hard to replicate existing framework in this without 
   recoding their entire backend. Solve this by making reusable
   stages that are simply configurable, instead of having to 
   program it all out from scratch each time.

   Problems: 
   
   1) We don't build all apps like this. SEDA is an architectual
      guideline, but not all apps are built like this.

   2) No easy way to do multiple output queues like this, since the
      single queue is tied to the handler.



*/


export interface Queue<T> {
  enqueue(request: T): void;
  dequeue(): T | undefined;
  isFull(): boolean;
}

class ArrQueue<T> implements Queue<T> {
  arr: T[] = [];
  constructor(public capacity: number) { }
  enqueue(data: T): void {
    this.arr.push(data);
  }
  dequeue(): T | undefined {
    return this.arr.shift();
  }
  isFull(): boolean {
    return this.arr.length == this.capacity
  }
}


export type Response = "success" | "fail"



class Event {
  constructor(public key: string) { }
}



class Worker {
  public event: Event | null = null;
}
class Pool {
  private workers: Worker[];
  constructor(public numWorkers: number) {
    this.workers = [];
    for (let i = 0; i < numWorkers; i++) {
      this.workers.push(new Worker());
    }
  }
  canWork(): boolean {
    return this.workers.some(w => w.event == null);
  }
  workOn(event: Event): void {
    const first = this.workers.find(w => w.event == null) as Worker;
    first.event = event;
  }
}


export abstract class Stage {
  private threadPool: Pool;
  constructor(
    public readonly inQueue: Queue<Event>,
  ) {
    this.threadPool = new Pool(4);
  }

  public tick(): void {
    while (this.threadPool.canWork()) {
      const event = this.inQueue.dequeue();
      if (!event)
        return;

      this.threadPool.workOn(event);
      this.arrive(event).then(response => this.respond(event, response));
    }
  }

  abstract arrive(event: Event): Promise<void>;
  abstract respond(event: Event, response: Response): void;
  abstract async next(event: Event): Promise<Response>;
}





class Cache extends Stage {
  public _cache: any = {}
  constructor(public readonly inQueue: Queue<Event>, private wrapped: Stage) {
    super(inQueue);
  }
  async arrive(event: Event): Promise<Response> {
    const inCache = !!this._cache[event.key];
    if (inCache) {
      return "success";
    }
    const result = await this.next(event);
    if (result == "success") {
      this._cache[event.key] = result;
    }
    return result;
  }

  async next(event: Event): Promise<Response> {
    return this.wrapped.arrive(event);
  }
}
class Live extends Stage {
  async arrive(event: Event): Promise<Response> {
    const available = Math.random() < 0.995;
    if (available)
      return "success";
    return "fail";
  }
  async next(event: Event): Promise<Response> {
    throw new Error("No Next");
  }

}

const inQueue = new ArrQueue<Event>(10);
const liveQueue = new ArrQueue<Event>(10);
const outQueue = new ArrQueue<Event>(10);

const live = new Live(liveQueue);
const cache = new Cache(inQueue, live);




console.log("Starting")
inQueue.enqueue(new Event("something"));
run();


async function run() {
  for (let i = 0; i < 10; i++) {
    cache.tick();
    live.tick();
    await sleep(1);
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
