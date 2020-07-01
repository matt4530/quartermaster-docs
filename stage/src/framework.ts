import { Stage, Event, Response, metronome, standardDeviation } from "."



/**
 * Execute a simulation
 * 
 * TODO: Move to own class, so we can set properties on this later, such as changing rates mid-simulation,
 * setting the keyspace, etc.
 * 
 * @param stage The stage where events will be inserted
 * @param eventsPer1000Ticks The rate of events (i.e. rps)
 * @param events The number of events
 */
export async function run(stage: Stage, eventsPer1000Ticks: number, numEventsToSend: number): Promise<void> {
  const delta = 1 / eventsPer1000Ticks;
  metronome.start();

  const pendingEvents = await sendEvents(stage, delta, numEventsToSend)
  const events = await Promise.all(pendingEvents);
  metronome.stop();
  report(events);
}


async function sendEvents(stage: Stage, tickDelta: number, numEventsToSend: number): Promise<Promise<Event>[]> {
  const events: Promise<Event>[] = [];
  let eventsSent = 0;

  while (eventsSent < numEventsToSend) {
    eventsSent++;
    events.push(createEvent(stage));
    await metronome.wait(tickDelta);
  }

  return events;
}

function createEvent(stage: Stage): Promise<Event> {
  const event = new Event("hi" + Math.floor(Math.random() * 500));
  const time = event.responseTime;
  time.startTime = metronome.now();

  return stage.accept(event).then(response => {
    event.response = response as Response;
    time.endTime = metronome.now();
    return event;
  }).catch(error => {
    event.response = error as Response;
    time.endTime = metronome.now();
    return event
  });
}


/**
 * Show interesting stats from the event data.
 * 
 * Show the following stats:
 * 
 * 1. % QoS? (we don't have access to this data)
 * 2. % success
 * 3. % latencies
 * 4. % slow failures? (interesting?)
 * @param events The events that have completed the simulation
 */
function report(events: Event[]): void {
  const failTimes: number[] = [];
  const successTimes: number[] = [];

  events.forEach(r => {
    const time = r.responseTime.endTime - r.responseTime.startTime;

    if (r.response == "fail") {
      failTimes.push(time);
    } else {
      successTimes.push(time);
    }
  })

  let success = successTimes.length;
  let fail = failTimes.length;

  const successAvg = successTimes.reduce((sum, cur) => sum + cur, 0) / success;
  const failAvg = failTimes.reduce((sum, cur) => sum + cur, 0) / fail;

  const successStdDevLatency = standardDeviation(successTimes, successAvg);
  const failStdDevLatency = standardDeviation(failTimes, failAvg);


  const precision = 3;
  const table = [
    {
      type: "success",
      count: success,
      percent: (success / events.length).toFixed(precision),
      mean_latency: successAvg.toFixed(precision),
      std_latency: successStdDevLatency.toFixed(precision)
    },
    {
      type: "fail",
      count: fail,
      percent: (fail / events.length).toFixed(precision),
      mean_latency: failAvg.toFixed(precision),
      std_latency: failStdDevLatency.toFixed(precision)
    },

  ]

  console.log("\nOverview of Events");
  console.table(table);
}

/**
 * Print a need summary to the console describing events' behavior within a
 * stage; specifically traffic and timing summaries.
 * 
 * @param stages A stage or an array of stages to report stats about
 */
export function summary(stages: Stage | Stage[]): void {
  const arr = Array.isArray(stages) ? stages : [stages]
  const times = arr.map(s => s.time);
  const traffic = arr.map(s => ({ stage: s.time.stage, ...s.traffic }));
  console.log("\nOverview of event time spent in stage")
  console.table(times)
  console.log("\nOverview of event behavior in stage")
  console.table(traffic);
}



