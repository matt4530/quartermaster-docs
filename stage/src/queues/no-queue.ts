import { Queue, Worker, Event } from "../";

export class NoQueue implements Queue {
  enqueue(event: Event): Promise<Worker> {
    return Promise.resolve(new Worker());
  }
  isFull(): boolean {
    return false;
  }
  canWork(): Boolean {
    return true;
  }

  setCapacity(capacity: number): void { }
  getCapacity(): number { return Infinity }
  setNumWorkers(num: number): void { }
  getNumWorkers(): number { return Infinity; }
}