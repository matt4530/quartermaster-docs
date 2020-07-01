import { Event } from "../";

/**
 * A worker of the pool, which processes the individual events. A worker
 * can only do one work at a time. It is reserved by setting the `event` 
 * property and unsetting it when the work is done.
 */
export class Worker {
  public event: Event | null = null;
}
