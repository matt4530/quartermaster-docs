import { Event, Queue, Worker, metronome } from "..";

/**
 * A FIFO queue implementation.
 */
export class FIFOQueue implements Queue {
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
    return metronome.wait(1).then(() => self.myTurn(event));
  }
  private async getFree(): Promise<Worker> {
    const worker = this.workers.find(w => w.event == null) as Worker;
    if (worker)
      return worker;

    // what a hack.   OR   what a hack!
    const self = this;
    return metronome.wait(1).then(() => self.getFree());
  }
}