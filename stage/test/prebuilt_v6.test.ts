import { Stage, Event, Cache, AvailableDependency } from "../src/";




function createAvailable(availability: number): AvailableDependency {
  const live = new AvailableDependency();
  live.availability = availability;
  return live;
}

function createEvent(key?: string): Event {
  return new Event(key || "key");
}



describe('AvailableLive', () => {
  test('accepts requests', async () => {
    const stage = createAvailable(1);
    await stage.workOn(createEvent());
  })
  test('rejects requests', () => {
    const stage = createAvailable(0);
    return expect(stage.workOn(createEvent())).rejects.toBe("fail")
  })
})



describe('Cache', () => {
  function createCache(wrapped: Stage, capacity: number): Cache {
    const cache = new Cache(wrapped);
    return cache;
  }

  let cache;
  test('the cache stores the wrapped stage\'s information', async () => {
    cache = createCache(createAvailable(1), 2);
    await cache.workOn(createEvent());
    const store = cache.store;
    expect(Object.keys(store).length).toBe(1);
    expect(store.key).toBe("success")
  });

})

