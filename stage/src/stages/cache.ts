import { WrappedStage } from "./wrapped-stage";
import { Event, metronome } from "../";

/**
 * A generic unbounded cache.
 * 
 * Stored in the cache is the time key was last updated.
 */

type CacheLine = Record<string, CacheItem>
type CacheItem = { time: number };

export class Cache extends WrappedStage {
  protected _cache: CacheLine = {}
  async workOn(event: Event): Promise<void> {
    const inCache = !!this.get(event.key);
    if (inCache) {
      return;
    }
    const r = await this.wrapped.accept(event);
    this.set(event.key, { time: metronome.now() });
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