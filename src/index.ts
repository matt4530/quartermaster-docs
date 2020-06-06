import {
  Simulator,
  Metronome,
  Approach,
  CacheDiscipline,
  AdaptiveFunction,
  Context
} from "queue-cache-distribution"



const m = new Metronome();

const adaption: AdaptiveFunction = {
  func: () => { },
  toString: () => "none"
}
const a: Approach = new Approach(CacheDiscipline.TTL, { discipline: "FIFO", length: 8, servers: 4 }, { 1, fallback: 0.1, timeout: 180 }, adaption);
const c: Context = {
  
}

let sim = new Simulator(m);