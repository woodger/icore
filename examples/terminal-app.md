# Terminal App

Use this shape when your package owns a command-line entrypoint and wants icore
to connect command parsing, presentation rendering, and stdout/stderr writing.

Create the file that becomes your CLI entrypoint, for example `src/cli.ts`, and
put the terminal app composition there:

```ts
import {
  createCommand,
  createOutput,
  createPresentation,
  createTerminalApp,
  presentationFormatOptions
} from 'icore';

type AppContext = {
  currentUser: string;
};

const command = createCommand();
const presentation = createPresentation();

const commands = command.registry([
  command.define({
    path: ['users', 'current'],
    options: presentationFormatOptions,
    handle({ context }: {
      context: AppContext;
    }) {
      return presentation.record({
        user: context.currentUser
      });
    }
  })
] as const);

const app = createTerminalApp({
  commands,
  presentation,
  output: createOutput()
});

async function main(args: readonly string[]): Promise<void> {
  process.exitCode = await app.run(args, {
    currentUser: 'Alice'
  }, {
    strict: true
  });
}

void main(process.argv.slice(2));
```

After compiling the consuming project, run the generated entrypoint:

```bash
node dist/cli.js users current
```

The terminal prints the default table view:

```text
field  value
user   Alice
```

Ask for JSON when the command should be consumed by another process:

```bash
node dist/cli.js users current --format json
```

The terminal prints:

```json
{
  "user": "Alice"
}
```
