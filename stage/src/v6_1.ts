/*
  Also allows batching, which is something the python implementation of quartermaster
  can't do, since it doesn't keep a context of which requests are currently
  in processing and allow other requests to change their behavior. 

  Problems: 
   
  If we use SEDA: 
   1) We don't build all apps like this. SEDA is an architectual
      guideline, but not all apps are built like this.

  If we use Events:
   2) We don't build all apps like this. Why are my functions listening
      to events?



*/



export interface Queue<T> {
  enqueue(request: T): Promise<Response>;
  dequeue(): Element<T> | undefined;
  isFull(): boolean;
}
export type Element<T> = {
  data: T;
  callback: Function;
}

class ArrQueue<T> implements Queue<T> {
  arr: Element<T>[] = [];
  constructor(public capacity: number) { }
  enqueue(data: T): Promise<Response> {
    return new Promise((resolve) => {
      this.arr.push({ data, callback: resolve });
    })
  }
  dequeue(): Element<T> | undefined {
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
  workOn(event: Event): Worker {
    const first = this.workers.find(w => w.event == null) as Worker;
    first.event = event;
    return first;
  }
  free(worker: Worker): void {
    worker.event = null;
  }
}


export abstract class Stage {
  private readonly inQueue: Queue<Event> = new ArrQueue<Event>(10);
  private readonly threadPool: Pool = new Pool(4);
  constructor() { }

  // final
  public tick(): void {
    while (this.threadPool.canWork()) {
      const element = this.inQueue.dequeue();
      if (!element)
        return;

      const { data: event, callback } = element;
      const worker = this.threadPool.workOn(event);
      this.workOn(event).then(response => {
        this.threadPool.free(worker)
        callback(response);
      });
    }
  }

  // Admission control
  public add(event: Event): Promise<Response> {
    if (this.inQueue.isFull())
      return this.respond(event, "fail");
    else
      return this.inQueue.enqueue(event);
  }

  // Actual work done by a request
  abstract workOn(event: Event): Promise<Response>;

  // exit control
  abstract respond(event: Event, response: Response): Promise<Response>;

  // wrapped work
  abstract async next(event: Event): Promise<Response>;
}





class Cache extends Stage {
  public _cache: any = {}
  constructor(private wrapped: Stage) {
    super();
  }
  async workOn(event: Event): Promise<void> {
    const inCache = !!this._cache[event.key];
    if (inCache) {
      this.respond(event, "success");
    }
    const result = await this.next(event);
    if (result == "success") {
      this._cache[event.key] = result;
    }
    this.respond(event, result);
  }

  async next(event: Event): Promise<Response> {
    return this.wrapped.add(event);
  }
}
class Live extends Stage {
  async workOn(event: Event): Promise<Response> {
    const available = Math.random() < 0.995;
    if (available)
      return "success";
    return "fail";
  }
  async next(event: Event): Promise<Response> {
    throw new Error("No Next");
  }

}


const live = new Live();
const cache = new Cache(live);




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
