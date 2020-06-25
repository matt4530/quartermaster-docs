

import { TimedLive, Cache, run, summary } from "./prebuilt_v6";

const live = new TimedLive();
live.mean = 150;
live.std = 20;

const cache = new Cache(live);


console.log("Starting")


work();
async function work() {
  await run(cache, 30, 5);
  //summary(live);  or, accepts an array
  summary([cache, live])
}



// Or, manually start events.
/*
async function run2() {
  const finished = cache.add(new Event("somethinggggg"))
  metronome.start();
  const finished2 = cache.add(new Event("something2"))
  const finished3 = cache.add(new Event("something3"))
  const finished4 = cache.add(new Event("something4"))
  const finished5 = cache.add(new Event("something5"))

  const response = await allSettled([finished, finished2, finished3, finished4, finished5]);
  console.log("[v6] Finished", response);
  metronome.stop(true);
}

*/

