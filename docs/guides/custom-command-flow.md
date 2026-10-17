# Prepare And Run Commands Yourself

Use this guide when the application needs to validate arguments and select a command before it creates the values needed by that command. The application then prepares the command and runs it itself, without `TerminalApp` formatting output or handling errors.

This is useful when argument parsing should happen before the application opens a database connection or creates an API client. The application must then format output and handle errors itself.

When the application needs to create and close resources while still using `TerminalApp` for output and errors, use [Set Up Command Execution And Cleanup](terminal-app.md).

Put the command registry close to the code that owns the command contract:

```ts
// Define the command before the application creates data for it.
import {
  createCommand,
  type PreparedCommand
} from 'icore';

type GreetingContext = {
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
    // Normalize input before creating application services.
    return {
      normalizedName: options.name.trim()
    };
  },
  handle({ payload, context }: {
    payload: { normalizedName: string };
    context: GreetingContext;
  }) {
    return `${context.greeting}, ${payload.normalizedName}!\n`;
  }
});

const commands = command.registry([
  greetCommand
] as const);
```

Keep `prepare` small. It turns command input into prepared data before the application creates values for the command, but it should not perform application work. This makes argument failures inexpensive and predictable.

When application startup needs a separate preparation step, prepare first and run later:

```ts
// Validate and prepare input before creating the greeting data.
async function runTwoPhase(args: readonly string[]): Promise<string> {
  const prepared: PreparedCommand<typeof greetCommand> = await commands.prepare(args, {
    strict: true
  });

  // Run the prepared command with data supplied by the application.
  return commands.run(prepared, {
    greeting: 'Hello'
  });
}
```

This two-step form is useful when values passed to the command are expensive to create or have side effects. If preparation fails, the application never creates them.

When the application does not need that split, run from raw terminal arguments:

```ts
// Combine parsing, preparation, and execution when no setup is needed between them.
async function runFromArgs(args: readonly string[]): Promise<string> {
  return commands.runFromArgs(args, {
    greeting: 'Hello'
  }, {
    strict: true
  });
}
```

`runFromArgs(...)` is useful when the application does not need the gap between parsing and execution. It is less flexible because it combines parsing, preparation, and execution in one call.

Pass the same arguments a user would type in the terminal:

```ts
// Pass the same terminal arguments to both execution forms.
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
