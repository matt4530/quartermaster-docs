/*
   Cool, SEDA design.

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
  protected handler?: Handler;
  getHandler(): Handler {
    return this.handler as Handler;
  }
}
abstract class Handler {
  protected outQueue: Queue<Event> | null = null;
  constructor(protected event: Event) { }
  public setOutQueue(outQueue: Queue<Event>) {
    this.outQueue = outQueue;
  }
  public arrive(): void {
    // this.event
  }
}



class Worker {
  public busy: boolean = false;
  public handler: Handler | null = null;
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
    return this.workers.some(w => !w.busy);
  }
  workOn(handler: Handler): void {
    const first = this.workers.find(w => !w.busy) as Worker;
    first.busy = true;
    first.handler = handler;
    handler.arrive();
  }
}


export class Stage {
  private threadPool: Pool;
  constructor(
    public readonly inQueue: Queue<Event>,
    public readonly outQueue: Queue<Event>
  ) {
    this.threadPool = new Pool(4);
  }

  public tick(): void {
    if (!this.threadPool.canWork())
      return;

    const event = this.inQueue.dequeue();
    if (!event)
      return;

    const handler = event.getHandler();
    handler.setOutQueue(this.outQueue);
    this.threadPool.workOn(handler);
  }
}


export class Monitor {
  constructor(public readonly inQueue: Queue<Event>) { }
  public tick(): void {
    const event = this.inQueue.dequeue() as ResponseEvent;
    if (!event)
      return;

    console.log("[Event] Finished: ", event.response);
  }
}


class GetCacheEvent extends Event {
  constructor() {
    super();
    this.handler = new CacheHandler(this);
  }
}
class CacheHandler extends Handler {
  public arrive(): void {
    const inCache = Math.random() < 0.3;
    //if (!inCache) {
    this.outQueue?.enqueue(new GetLiveEvent())
    /*} else {
      // TODO: How to access another queue?
    }*/
  }
}

class GetLiveEvent extends Event {
  constructor() {
    super();
    this.handler = new LiveHandler(this);
  }
}
class LiveHandler extends Handler {
  public arrive(): void {
    const available = Math.random() < 0.995;
    if (available) {
      this.outQueue?.enqueue(new ResponseEvent("success"))
    } else {
      this.outQueue?.enqueue(new ResponseEvent("fail"))
    }
  }
}
class ResponseEvent extends Event {
  constructor(public response: Response) {
    super();
  }
}

const inQueue = new ArrQueue<Event>(10);
const liveQueue = new ArrQueue<Event>(10);
const outQueue = new ArrQueue<Event>(10);


const cache = new Stage(inQueue, liveQueue);
const live = new Stage(liveQueue, outQueue);
const reporter = new Monitor(outQueue);




console.log("Starting")
inQueue.enqueue(new GetCacheEvent());
run();


async function run() {
  for (let i = 0; i < 10; i++) {
    cache.tick();
    live.tick();
    reporter.tick();
    await sleep(1);
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
