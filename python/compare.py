import quartermaster as qm
import math

# Techniques that are able to make informed decisions about how to change behavior have the potential to allow for degradation that is controlled. Informed decision making can be done by modelling the state of the dependency and also by estimating how it will be.


def _avg(values):
    if len(values) == 0:
        return 0
    return sum(values)/len(values)


# Thoughts: I'm not sure what this means to me as an SE. How does this differ from rate. I assume rate is the rate of requests coming from the client and q1 is the amount that we are consuming. I still don't know what these values are as an SE
qm.Server.q1_max = 10
qm.Server.p1_max = 10

qm.Server.q2_max = 12
qm.Server.p2_max = 5


# Listen in on the dependency
history_error = []
history_latency = []
avg_latency = 1
old_dependency = qm.dependency
old_abandon = qm.abandon


def history_dependency():
    result = old_dependency()
    history_error.append(0 if result[1] == "success" else 1)
    history_latency.append(result[0])
    return result


def stat_configure():
    #avg_error = _avg(history_error)
    avg_latency = _avg(history_latency)


def advanced_abandon(r):
    expected_max_q1_latency = math.ceil(r.queue_p["q2"] / qm.Server.p2_max)
    used_latency = qm.clock.ts - r.start_ts
    cache_t = qm.cache_hit(r)

    value_live = qm.Client.live
    value_cache = qm.sigmoid(
        cache_t, qm.Client.cache_age_max, qm.Client.cache_age_k)

    delay_live = qm.sigmoid(
        avg_latency + expected_max_q1_latency, qm.Client.decay_max, qm.Client.decay_k)
    delay_cache = qm.sigmoid(
        used_latency, qm.Client.decay_max, qm.Client.decay_k)

    expected_qos_of_live = value_live * delay_live
    expected_qos_of_cache = value_cache * delay_cache

    # TODO: Some behavior here.
    # TODO: account for decreased availability when using expected_qos_of_live


qm.configure = stat_configure
qm.dependency = history_dependency
qm.abandon = advanced_abandon


qm.warmup()
qm.run_experiment(200000)
