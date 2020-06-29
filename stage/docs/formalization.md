# Quartermaster - Formalization

A fault tolerant technique can be generalized as a stage, consisting of a queue for inbound events, a worker pool to process events from the queue, and a set of overloadable event driven methods.

## Table of Contents

**[1. Stage](#Stage)**

**[2. Queue](#Queue)**

**[3. Worker Pool](#Worker-Pool)**

**[4. Methods](#Event-Methods)**

## Stage

The stage design used by the quartermaster was inspired by SEDA<sup id="seda">1</sup>, staged event-driven architecture. In SEDA, events pass through a set of stages conected by queues. Each stage does some work and passes it on to some other stages. Similarly, the Quartermaster's stages contain a queue of events which are processed in the stage, before being handed off to some other stage.

A stage is composed of a queue, a worker pool, and several methods which are triggered on key events.

[1]: While [SEDA](http://www.sosp.org/2001/papers/welsh.pdf) was proposed as a way to architect software systems, not all actual systems are architected in this form. It can be complex to design an equivalent non-staged system in SEDA and verify that its behavior is identical. Thus, we chose not to use the exact SEDA architecture for Quartermaster. Quartermaster is flexible to support non-SEDA and SEDA architectures alike.

## Queue

Similar to

## Worker Pool

## Event Methods
