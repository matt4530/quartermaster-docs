

import { TimedDependency, Cache, Event, metronome, stageSummary } from "../src/";

const live = new TimedDependency();
live.mean = 150;
live.std = 20;

const cache = new Cache(live);


manual();
async function manual() {
  const first = cache.accept(new Event("a"))
  const second = cache.accept(new Event("b"))
  const third = cache.accept(new Event("a"))

  metronome.start();
  const response = await Promise.all([first, second, third])
  metronome.stop(true);

  stageSummary([cache, live])
}

