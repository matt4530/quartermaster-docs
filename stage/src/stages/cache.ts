import { WrappedStage } from "./wrapped-stage";
import { Event } from "../";

/**
 * A generic unbounded cache.
 */
export class Cache extends WrappedStage {
  protected _cache: any = {}
  async workOn(event: Event): Promise<void> {
    const inCache = !!this.get(event.key);
    if (inCache) {
      return;
    }
    const r = await this.wrapped.accept(event);
    this.set(event.key, "success");
  }

  get(key: string): any {
    return this._cache[key]
  }
  set(key: string, value: any): void {
    this._cache[key] = value;
  }
  get store(): any {
    return this._cache;
  }
}