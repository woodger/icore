# Custom Command Flow

Use this shape when the application wants command mechanics without the terminal
application boundary. The application prepares a command, creates its runtime
context, and then runs the prepared command explicitly.

This is useful when command parsing happens before runtime dependencies are
available. For example, the application can validate arguments, select a
command, and only then open a database connection or create an API client. The
tradeoff is that the application must own output rendering and error handling
itself.

Put the command registry close to the code that owns the command contract:

```ts
import {
  createCommand,
  type PreparedCommand
} from 'icore';

type AppContext = {
  greeting: string;
};

const command = createCommand();

const greetCommand = command.define({
  path: ['greet'],
  options: {
    name: {
      type: 'string',
      required: true
    }
  } as const,
  prepare({ options }) {
    return {
      normalizedName: options.name.trim()
    };
  },
  handle({ payload, context }: {
    payload: { normalizedName: string };
    context: AppContext;
  }) {
    return `${context.greeting}, ${payload.normalizedName}!\n`;
  }
});

const commands = command.registry([
  greetCommand
] as const);
```

The `prepare` hook is intentionally small. It normalizes command input before
runtime context exists, but it should not perform application work. Keeping that
split makes failed argument parsing cheap and deterministic.

When application startup needs a separate preparation step, prepare first and
run later:

```ts
async function runTwoPhase(args: readonly string[]): Promise<string> {
  const prepared: PreparedCommand<typeof greetCommand> = await commands.prepare(args, {
    strict: true
  });

  return commands.run(prepared, {
    greeting: 'Hello'
  });
}
```

The two-phase form is the safest choice when application context is expensive
or has side effects. If preparation fails, the runtime context never needs to be
created.

When the application does not need that split, run from raw terminal arguments:

```ts
async function runFromArgs(args: readonly string[]): Promise<string> {
  return commands.runFromArgs(args, {
    greeting: 'Hello'
  }, {
    strict: true
  });
}
```

`runFromArgs(...)` is more compact and works well for simple applications. It is
less flexible because parsing, preparation, and execution happen as one step.

Pass the same arguments a user would type in the terminal:

```ts
const args = [
  'greet',
  '--name',
  'Alice'
];

process.stdout.write(await runTwoPhase(args));
process.stdout.write(await runFromArgs(args));
```

The terminal prints one line for each call:

```text
Hello, Alice!
Hello, Alice!
```
