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



export interface Queue {
  enqueue(event: Event): Promise<Response>;
  dequeue(): Element | undefined;
  isFull(): boolean;
  canWork(): Boolean
  getFree(): Worker;
}
export type Element = {
  event: Event;
  callback: Function;
}


class Worker {
  public element: Element | null = null;
}
class ArrQueue implements Queue {
  private workers: Worker[];
  private arr: Element[] = [];
  constructor(public capacity: number, public numWorkers: number) {
    this.workers = [];
    for (let i = 0; i < numWorkers; i++) {
      this.workers.push(new Worker());
    }
  }
  enqueue(event: Event): Promise<Response> {
    return new Promise((resolve) => {
      this.arr.push({ event, callback: resolve });
    })
  }
  dequeue(): Element | undefined {
    return this.arr.shift();
  }
  isFull(): boolean {
    return this.arr.length == this.capacity
  }

  // Pool
  canWork(): boolean {
    return this.workers.some(w => w.element == null);
  }
  getFree(): Worker {
    return this.workers.find(w => w.element == null) as Worker;
  }
}


export type Response = "success" | "fail"



class Event {
  constructor(public key: string) { }
}






export abstract class Stage {
  private readonly inQueue: ArrQueue = new ArrQueue(10, 4);
  constructor() {
  }

  // final
  public tick(): void {
    let worker: Worker;
    while (worker = this.inQueue.getFree()) {
      const element = this.inQueue.dequeue();
      if (!element)
        return;

      const { event, callback } = element;
      worker.element = element;
      this.workOn(event).then(response => {
        worker.element = null;
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
