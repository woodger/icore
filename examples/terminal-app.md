# Terminal App

Use this shape when your package owns a command-line entrypoint and wants icore
to connect command parsing, presentation rendering, and stdout/stderr writing.

This is the default shape for a regular terminal application because it keeps
the CLI boundary in one place: commands return text or presentation views, while
`createTerminalApp()` owns rendering, stdout/stderr delivery, and exit codes.
The tradeoff is that command handlers must return terminal-supported values,
not arbitrary application objects.

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

Create `command`, `presentation`, and `output` once near the entrypoint. That is
slightly more explicit than hiding them behind defaults, but it keeps stdout,
stderr, and format behavior visible at the terminal boundary. `strict: true`
keeps the public command form predictable by rejecting option placement that the
application does not intentionally support.

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

## Override Format Resolution

By default, `createTerminalApp()` looks for a parsed `format` option and uses it
when it is one of the supported presentation formats. Override `resolveFormat`
when format policy is application-specific.

```ts
const appWithFormatPolicy = createTerminalApp({
  commands,
  presentation,
  output: createOutput(),
  resolveFormat(prepared) {
    if (prepared.name === 'users export') {
      return 'csv';
    }

    return undefined;
  }
});
```

This is useful when one command has a different default output contract. It is
also a point where the application can make a bad abstraction: avoid hiding
format decisions here when a normal `--format` option would be clearer.
