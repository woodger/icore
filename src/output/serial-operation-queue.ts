/**
 * The serial operation queue preserves output ordering across shared writers.
 *
 * Allowed here:
 * - serializing asynchronous output operations;
 * - barrier-style flushing;
 * - retaining the first operation failure;
 *
 * This file must not contain stream selection or terminal rendering rules.
 */

type SerialOperation = () => unknown | Promise<unknown>;

export type SerialOperationQueue = {
  /** Enqueues an operation and reports failures to the caller. */
  run(operation: SerialOperation): Promise<void>;
  /** Enqueues an operation without creating a caller-visible rejection. */
  enqueue(operation: SerialOperation): void;
  /** Waits for operations enqueued before this call. */
  flush(): Promise<void>;
};

type QueueFailure = {
  sequence: number;
  error: unknown;
};

/**
 * Creates a queue whose first operation failure is sticky.
 *
 * The internal tail always resolves. This lets detached line operations retain
 * failures for the next barrier without producing unhandled rejections.
 */
export function createSerialOperationQueue(): SerialOperationQueue {
  let tail = Promise.resolve();
  let lastSequence = 0;
  let failure: QueueFailure | undefined;

  function append(operation: SerialOperation): {
    completion: Promise<void>;
    sequence: number;
  } {
    const sequence = lastSequence + 1;

    lastSequence = sequence;
    tail = tail.then(async () => {
      if (failure !== undefined) {
        return;
      }

      try {
        await operation();
      }
      catch (error) {
        failure = {
          sequence,
          error
        };
      }
    });

    return {
      completion: tail,
      sequence
    };
  }

  async function waitForBoundary(
    completion: Promise<void>,
    sequence: number
  ): Promise<void> {
    await completion;

    if (failure !== undefined && failure.sequence <= sequence) {
      throw failure.error;
    }
  }

  return {
    run(operation) {
      const queued = append(operation);

      return waitForBoundary(queued.completion, queued.sequence);
    },
    enqueue(operation) {
      append(operation);
    },
    flush() {
      return waitForBoundary(tail, lastSequence);
    }
  };
}
