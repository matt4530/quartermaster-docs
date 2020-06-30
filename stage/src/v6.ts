import { Metronome } from "./metronome";

/*
  v6 

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



/**
 * A stage responds with a "success", or rejects with a "fail" or throws an 
 * error.
 */
export type Response = "success" | "fail"

/**
 * An event goes through a stage. In web systems, it could be a web request.
 * Two events with the same key are identical, but could have originated from
 * two separate sources.
 * 
 * An event keeps track of time spent in various stages.
 */
export class Event {
  public time: TimeStats[] = [];
  constructor(public key: string) { }
}

/**
 * A worker of the pool, which processes the individual events. A worker
 * can only do one work at a time. It is reserved by setting the `event` 
 * property and unsetting it when the work is done.
 */
export class Worker {
  public event: Event | null = null;
}

/**
 * The basic queue contract utilized by a stage.
 */
export interface Queue {
  /**
   * Adds an event to the queue and promises a worker to fulfill it
   * @param event The event to be added to the queue
   * @returns A Promise for a free worker that will serve the event
   */
  enqueue(event: Event): Promise<Worker>

  /**
   * Is the queue full?
   */
  isFull(): boolean;

  setCapacity(capacity: number): void;
  getCapacity(): number;

  /**
   * Is there a free worker?
   */
  canWork(): Boolean

  setNumWorkers(num: number): void;
  getNumWorkers(): number;


}


/**
 * A FIFO queue implementation.
 */
class FIFOQueue implements Queue {
  private arr: Event[] = [];
  private workers: Worker[] = [];
  private capacity: number = 0;

  constructor(capacity: number, numWorkers: number) {
    this.setCapacity(capacity);
    this.setNumWorkers(numWorkers);
  }

  async enqueue(event: Event): Promise<Worker> {
    this.arr.push(event);
    const self = this;

    return this.myTurn(event).then(() => {
      self.dequeue();
      return self.getFree()
    });
  }
  isFull(): boolean {
    return this.arr.length == this.capacity
  }
  canWork(): boolean {
    return this.workers.some(w => w.event == null);
  }


  setCapacity(capacity: number): void {
    this.capacity = capacity;
  }
  getCapacity(): number {
    return this.capacity;
  }
  setNumWorkers(num: number): void {
    for (let i = 0; i < num; i++) {
      this.workers.push(new Worker());
    }
  }
  getNumWorkers(): number {
    return this.workers.length;
  }


  private dequeue(): Event | undefined {
    return this.arr.shift();
  }
  private peek(): Event | undefined {
    if (this.arr.length == 0)
      return undefined;
    return this.arr[0];
  }
  private async myTurn(event: Event): Promise<boolean> {
    if (this.peek() == event)
      return true;

    const self = this;
    return m.wait(1).then(() => self.myTurn(event));
  }
  private async getFree(): Promise<Worker> {
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
 * By default, it includes a FIFO queue with fixed capacity and worker pool.
 * 
 * 
 * TODO: consider if we can break queue out into a QueuedStage since it 
 * could be superfluous for some techniques.
 * 
 * TODO: Refactor queue so that properties are easier to access, it is 
 * easier to override.
 */
export abstract class Stage {
  protected readonly inQueue: Queue = new FIFOQueue(10, 4);
  public time: TimeStats;
  public traffic: TrafficStats;
  constructor() {
    this.time = TimeStats.fromStage(this);
    this.traffic = new TrafficStats();
  }

  /**
   * A helper to drive the stage. This function should not be overwritten
   * unless some fixed behavior really needs to be changed.
   * @param event The event that has been allowed into the stage for processing
   */
  public async accept(event: Event): Promise<Response> {
    const time = TimeStats.fromStage(this);
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

  static fromStage(stage: Stage): TimeStats {
    const t = new TimeStats();
    t.stage = stage.constructor.name;
    return t;
  }
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