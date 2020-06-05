import quartermaster as qm

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


# Math here to model dependency
qm.configure

# Listen in on the dependency
history_error = []
history_latency = []
old_dependency = qm.dependency


def history_dependency():
    result = old_dependency()
    history_error.append(0 if result[1] == "success" else 1)
    history_latency.append(result[0])
    return result


qm.dependency = history_dependency


expected_qos_of_live = 1


def configure():
    #avg_error = _avg(history_error)
    avg_latency = _avg(history_latency)

    expected_qos_of_live = qm.sigmoid(
        avg_latency, qm.Client.decay_max, qm.Client.decay_k)


qm.configure = configure

qm.warmup()
qm.run_experiment(200000)
