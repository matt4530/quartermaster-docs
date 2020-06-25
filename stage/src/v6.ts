import { Metronome } from "./metronome";

/*
  Design to disguise timing events as async functions of the 
  Queue.

  That is, the Queue has blocking methods (like enqueue) that 
  handle blocking until ready, rather than the stage doing this.

  Thus, the stages read more like how you describe a system in
  plain words.

  1. The request is added or rejected.
  2. Request goes into the queue to wait for a worker to free up
  3. The request is worked on.
  4. The work succeeded or failed.



  Within the Queue itself, the same is also true about describing how
  the queue works with words, within the enqueue() method.

  1. Add the request to an array
  2. Wait for it to be the request's turn
  3. Wait for a free worker to serve the request

  Thus, the enqueue() method returns a worker.
*/
export type Response = "success" | "fail"
export class Event {
  public time: TimeStats[] = [];
  constructor(public key: string) { }
}
class Worker {
  public event: Event | null = null;
}
export interface Queue {
  enqueue(event: Event): Promise<Worker>
  dequeue(): Event | undefined;
  isFull(): boolean;
  canWork(): Boolean
  getFree(): Promise<Worker>;
}

class ArrQueue implements Queue {
  private workers: Worker[];
  private arr: Event[] = [];
  constructor(public capacity: number, public numWorkers: number) {
    this.workers = [];
    for (let i = 0; i < numWorkers; i++) {
      this.workers.push(new Worker());
    }
  }
  async enqueue(event: Event): Promise<Worker> {
    this.arr.push(event);
    const self = this;

    return this.myTurn(event).then(() => {
      self.dequeue();
      return self.getFree()
    });
  }
  dequeue(): Event | undefined {
    return this.arr.shift();
  }
  peek(): Event | undefined {
    if (this.arr.length == 0)
      return undefined;
    return this.arr[0];
  }
  isFull(): boolean {
    return this.arr.length == this.capacity
  }

  async myTurn(event: Event): Promise<boolean> {
    if (this.peek() == event)
      return true;

    const self = this;
    return m.wait(1).then(() => self.myTurn(event));
  }

  canWork(): boolean {
    return this.workers.some(w => w.event == null);
  }
  async getFree(): Promise<Worker> {
    const worker = this.workers.find(w => w.event == null) as Worker;
    if (worker)
      return worker;

    // what a hack.   OR   what a hack!
    const self = this;
    return m.wait(1).then(() => self.getFree());
  }
}


/**
 * The primary unit of a fault tolerant technique.
 * 
 * TODO: consider if we can break queue out into a QueuedStage since it 
 * could be superfluous for some techniques.
 * 
 * TODO: Refactor queue so that properties are easier to access, it is 
 * easier to override.
 */
export abstract class Stage {
  protected readonly inQueue: Queue = new ArrQueue(10, 4);
  public time = new TimeStats();
  public traffic = new TrafficStats();
  constructor() {
    this.time.stage = this.constructor.name;
  }

  /**
   * A helper to drive the stage. This function should not be overwritten
   * unless some fixed behavior really needs to be changed.
   * @param event The event that has been allowed into the stage for processing
   */
  public async accept(event: Event): Promise<Response> {
    const time = new TimeStats();
    time.stage = this.constructor.name
    event.time.push(time)

    this.traffic.add++;
    await this.add(event);

    const t = m.now();
    const worker = await this.inQueue.enqueue(event);
    time.queueTime = m.now() - t;
    this.time.queueTime += time.queueTime;


    worker.event = event;
    try {
      this.traffic.workOn++;
      const t = m.now();
      await this.workOn(event);
      time.workTime = m.now() - t;
      this.time.workTime += time.workTime;

      this.traffic.success++;
      return this.success(event);
    } catch (err) {
      this.traffic.fail++;
      return this.fail(event);
    } finally {
      worker.event = null
    }
  }


  /**
   * Admission control before an event reaches the queue.
   * @param event The event that is seeking entry into the stage
   */
  protected async add(event: Event): Promise<void> {
    if (this.inQueue.isFull()) {
      // not this.fail(), since workOn hasn't happened?
      return Promise.reject("fail");
    }
  }

  /**
   * The main method for each stage, which is called when an event is picked up
   * by a worker.
   * @param event The event that is being processed by the stage
   */
  abstract workOn(event: Event): Promise<void>;

  /**
   * A helper function which is called when workOn completes without rejection
   * or a thrown error.
   * @param event The event that successfully passed through the stage
   */
  protected success(event: Event): Response {
    return "success"
  }

  /**
   * A helper function which is called when workOn returns a rejected promise
   * or throws an error
   * @param event The event that was processing when the rejection occured
   */
  protected fail(event: Event): Response {
    throw "fail"
  }

  /**
   * Called every tick of the simulation, for work that needs to be decoupled 
   * from events or is time-based.
   * 
   * TODO: NOT IMPLEMENTED YET. Need some neat way to call ticks on each stage
   * without having to pass all stages in?
   */
  protected tick(): void { };
}



/**
 * The time keeper for the simulation.
 */
const m = new Metronome();
export {
  m as metronome
}






/**
 * Stats used to report time spent by events in the queue and working
 */
export class TimeStats {
  public queueTime: number = 0;
  public workTime: number = 0;
  public stage: string = "";
  constructor() { }
  // public totalTime ? (this also includes add(), success(), fail())
}
/**
 * Stats used to report on behavior of events
 */
export class TrafficStats {
  public add: number = 0;
  public workOn: number = 0;
  public success: number = 0;
  public fail: number = 0;
}

/**
 * An interface which stages can implement to ensure they have a stats summary available.
 *
 * Unused at the moment.
 *
export interface ICustomStats {
  report(): void;
}*/