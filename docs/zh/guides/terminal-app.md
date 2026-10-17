# 配置命令执行和资源清理

[English](../../guides/terminal-app.md) | [Русский](../../ru/guides/terminal-app.md) | 简体中文

> 本文是英文版的简体中文翻译。如有差异，以英文版为准。

[README 快速开始](../readme.md#快速开始)在应用已具备命令所需的一切时使用 `app.run(...)`。

当应用需要完成以下工作时，请使用本指南中的步骤：

- 在验证命令前处理全局 `--help` 或 `--version`；
- 在知道要运行哪条命令后选择数据库连接或 API 客户端；
- 自行创建和关闭资源，并管理进度输出或长期运行的任务；
- 同时仍使用 `TerminalApp` 格式化输出并应用错误处理规则。

执行顺序如下：

```text
parse global shortcuts
→ app.prepare()
→ inspect metadata and payload
→ create selected resources
→ app.commands.run()
→ terminal result: finish interactive output → app.writePreparedOutput()
  or long-running result: transfer handle, scope, and interactive output
→ cleanup
→ app.reportError() when a failure was captured
```

请在报告错误前关闭进度输出和资源，这样诊断信息只会在清理完成后出现。在 `writePreparedOutput(...)` 完成前不要关闭所选资源：终端输出可能仍是会使用这些资源的异步流。

## 创建一个带类型的命令构建器

`createCommand.withTypes<...>()` 为所有命令设置共享类型。只有当命令共享以下内容时，才创建一次：

- `context`：应用传给命令函数的数据；
- `result`：该函数可能返回的值的范围；
- `metadata`：命令的固定信息，例如描述。

每条命令仍会自行声明名称、选项、别名、`prepare` 返回的数据和具体的结果类型：

```ts
// Define the commands, output, and error handling used by the CLI.
import {
  createCommand,
  createOutput,
  createPresentation,
  createTerminalApp,
  isTerminalCommandOutput,
  isUsageError,
  mergeOptionsSchema,
  presentationFormatOptions,
  type TerminalCommandOutput
} from 'icore';

type ResourceName = 'database' | 'remote-api';

type CurrentUserContext = {
  currentUser: string;
};

// A long-running command returns a handle for application code to manage.
type LongRunningCommandHandle = {
  completed: Promise<void>;
  close(): Promise<void>;
};

type LongRunningCommandResult = {
  type: 'long-running';
  handle: LongRunningCommandHandle;
};

type CliCommandResult =
  | TerminalCommandOutput
  | LongRunningCommandResult;

function isLongRunningCommandResult(
  result: CliCommandResult
): result is LongRunningCommandResult {
  return typeof result === 'object'
    && result !== null
    && 'type' in result
    && result.type === 'long-running';
}

type CommandMetadata = {
  description: string;
  resources:
    | readonly ResourceName[]
    | ((payload: unknown) => readonly ResourceName[]);
};

const insecureOptions = {
  insecure: {
    type: 'boolean',
    syntax: 'flag'
  }
} as const;

// Each command receives the current user, returns CLI output, and declares its description and resources.
const command = createCommand.withTypes<{
  context: CurrentUserContext;
  result: CliCommandResult;
  metadata: CommandMetadata;
  metadataRequired: true;
}>();

const presentation = createPresentation();

declare function startUserWatcher(
  context: CurrentUserContext
): LongRunningCommandHandle;

// This command returns a record for terminal output.
const currentUserCommand = command.define({
  path: ['users', 'current'],
  options: mergeOptionsSchema(
    presentationFormatOptions,
    insecureOptions
  ),
  metadata: {
    description: 'Show the current user',
    resources: ['database']
  },
  handle({ context }) {
    return presentation.record({
      user: context.currentUser
    });
  }
});

// This command starts work that continues after the command returns.
const watchUsersCommand = command.define({
  path: ['users', 'watch'],
  options: insecureOptions,
  metadata: {
    description: 'Watch the current user',
    resources: ['remote-api']
  },
  handle({ context }) {
    return {
      type: 'long-running',
      handle: startUserWatcher(context)
    } satisfies LongRunningCommandResult;
  }
});

const commands = command.registry([
  currentUserCommand,
  watchUsersCommand
] as const);

// Let the terminal app format output and report errors consistently.
const app = createTerminalApp({
  commands,
  presentation,
  output: createOutput(),
  errorPolicy: {
    renderError(error) {
      const errors = error instanceof AggregateError
        ? error.errors
        : [error];

      return errors.map((cause: unknown) => {
        const message = cause instanceof Error
          ? cause.message
          : String(cause);

        return `${message}\n`;
      }).join('');
    },
    resolveExitCode(error) {
      const primaryError = error instanceof AggregateError
        ? error.errors[0]
        : error;

      return isUsageError(primaryError) ? 2 : 1;
    }
  }
});
```

CLI 启动时只创建一次 `command`、`commands`、`presentation`、`output` 和 `app`。此时不要创建数据库连接或 API 客户端；等待 `app.prepare(...)` 确定所选命令后再创建。

错误处理规则会输出 `AggregateError` 的每个成员，并用第一个成员选择退出码。当命令和清理都失败时，这个示例把命令错误放在第一位、清理错误放在第二位，因此两个消息都会显示，同时保留命令的退出码。

## 不重写参数地处理全局帮助和版本

在选择命令前处理的选项中描述 `-h` 和 `-v`。`parseArgv(...)` 会把它们映射为 `help` 和 `version`，而 `parseOptionsSubsetDetailed(...)` 只检查这些初始选项：

```ts
// Parse global flags without consuming options for the selected command.
import {
  parseArgv,
  parseOptionsSubsetDetailed
} from 'icore';

const globalOptionsSchema = {
  help: {
    type: 'boolean',
    alias: 'h',
    syntax: 'flag'
  },
  version: {
    type: 'boolean',
    alias: 'v',
    syntax: 'flag'
  },
  ...insecureOptions
} as const;

function parseGlobalInput(args: readonly string[]) {
  const argv = parseArgv(args, globalOptionsSchema);
  const parsed = parseOptionsSubsetDetailed(
    globalOptionsSchema,
    argv.options
  );

  return {
    positionals: argv.positionals,
    options: parsed.options
  };
}
```

把原始 `args` 传给 `app.prepare(...)`；不要根据部分解析结果重建参数。所选命令仍必须收到自己的选项。

包含每个类型能告诉解析器是否会占用下一个参数的初始选项。例如，将 `--insecure` 声明为布尔值可防止解析器把后续命令段当成它的值。

## 创建资源、清理资源，再报告错误

应用提供自己的帮助格式化函数和关闭资源的对象：

```ts
// Keep help formatting and resource cleanup in application code.
type InvocationScope = {
  context: CurrentUserContext;
  /**
   * Idempotently closes progress or another interactive stdout line.
   * `close()` also calls this when execution fails before final output.
   */
  finishInteractiveOutput(): Promise<void>;
  /** Closes interactive output first, then selected resources. */
  close(): Promise<void>;
};

declare function createInvocationScope(
  resources: readonly ResourceName[],
  options: {
    insecure: boolean;
  }
): Promise<InvocationScope>;

declare function transferLongRunningLifecycle(input: {
  handle: LongRunningCommandHandle;
  scope: InvocationScope;
  signals: readonly ['SIGINT', 'SIGTERM'];
}): void;

declare function renderHelp(
  definitions: typeof commands.definitions,
  positionals: readonly string[]
): string;

declare function renderVersion(): string;
```

`createInvocationScope(...)` 应在创建每个资源后立即登记关闭动作。如果初始化失败，它应关闭已经创建的资源。

[构建帮助的示例](practical-cli-patterns.md#根据命令说明构建帮助)展示 `renderHelp(...)` 如何从 `commands.definitions` 读取主命令名列表，而不重复别名。

下面的代码记录第一个错误发生的阶段，将它与清理错误合并，并在清理后报告：

```ts
// Track a failure until all resources are closed.
type Prepared = Awaited<ReturnType<typeof app.prepare>>;
type FailurePhase = 'execute' | 'write' | 'external';

type InvocationFailure = {
  error: unknown;
  phase: FailurePhase;
};

// Use the selected command's list of resources.
function selectResources(prepared: Prepared): readonly ResourceName[] {
  const selection = prepared.command.metadata.resources;

  return typeof selection === 'function'
    ? selection(prepared.payload)
    : selection;
}

// Keep the first failure and add a cleanup failure when both occur.
function mergeCleanupFailure(
  primary: InvocationFailure | undefined,
  cleanupError: unknown
): InvocationFailure {
  if (primary === undefined) {
    return {
      error: cleanupError,
      phase: 'external'
    };
  }

  return {
    error: new AggregateError(
      [primary.error, cleanupError],
      'Command execution and cleanup both failed'
    ),
    phase: primary.phase
  };
}

// Print the error after cleanup and name the step where it happened.
async function reportPreparedFailure(
  failure: InvocationFailure,
  args: readonly string[],
  prepared: Prepared
): Promise<number> {
  if (failure.phase === 'execute') {
    return app.reportError(failure.error, {
      phase: 'execute',
      args,
      prepared
    });
  }

  if (failure.phase === 'write') {
    return app.reportError(failure.error, {
      phase: 'write',
      args,
      prepared
    });
  }

  return app.reportError(failure.error, {
    phase: 'external',
    args,
    prepared
  });
}

// Write global help or version through the same error handling.
async function writeBootstrapOutput(
  render: () => string,
  args: readonly string[]
): Promise<number> {
  try {
    await app.output.write(render());

    return 0;
  }
  catch (error) {
    return app.reportError(error, {
      phase: 'external',
      args
    });
  }
}

// Handle global flags before preparing the selected command.
async function runCli(args: readonly string[]): Promise<number> {
  let globalInput: ReturnType<typeof parseGlobalInput>;

  try {
    globalInput = parseGlobalInput(args);
  }
  catch (error) {
    return app.reportError(error, {
      phase: 'prepare',
      args
    });
  }

  if (globalInput.options.help === true) {
    return writeBootstrapOutput(
      () => renderHelp(commands.definitions, globalInput.positionals),
      args
    );
  }

  if (globalInput.options.version === true) {
    return writeBootstrapOutput(renderVersion, args);
  }

  let prepared: Prepared;

  try {
    prepared = await app.prepare(args, {
      strict: true
    });
  }
  catch (error) {
    return app.reportError(error, {
      phase: 'prepare',
      args
    });
  }

  // Keep selected resources open until output is written or work is transferred.
  let scope: InvocationScope | undefined;
  let failure: InvocationFailure | undefined;
  let phase: FailurePhase = 'external';

  try {
    scope = await createInvocationScope(
      selectResources(prepared),
      {
        insecure: prepared.options.insecure ?? false
      }
    );

    phase = 'execute';
    const result = await app.commands.run(prepared, scope.context);

    // Long-running work takes over its own cleanup before this function returns.
    if (isLongRunningCommandResult(result)) {
      phase = 'external';
      transferLongRunningLifecycle({
        handle: result.handle,
        scope,
        signals: ['SIGINT', 'SIGTERM']
      });
      scope = undefined;

      return 0;
    }

    // Finish the interactive line before writing ordinary command output.
    phase = 'external';
    await scope.finishInteractiveOutput();

    if (!isTerminalCommandOutput(result)) {
      throw new TypeError('Expected terminal command output');
    }

    phase = 'write';
    await app.writePreparedOutput(prepared, result);
  }
  catch (error) {
    failure = {
      error,
      phase
    };
  }
  finally {
    // Close resources even when preparation, execution, or writing fails.
    try {
      await scope?.close();
    }
    catch (cleanupError) {
      failure = mergeCleanupFailure(failure, cleanupError);
    }
  }

  if (failure !== undefined) {
    return reportPreparedFailure(failure, args, prepared);
  }

  return 0;
}

void runCli(process.argv.slice(2))
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
```

`writePreparedOutput(...)` 会格式化输出并写入它。`TerminalApp` 外的代码无法知道哪一步失败，因此本指南将其拒绝报告为 `write`。内置的 `app.run(...)` 和 `app.runPrepared(...)` 会在内部区分 `render` 与 `write`。

`CliCommandResult` 只定义应用允许的最宽结果类型。普通命令仍保留具体的输出结果，而 `watchUsersCommand` 保留具体的 `LongRunningCommandResult`。

`transferLongRunningLifecycle(...)` 属于应用代码。它必须在返回前为任务和 `scope` 注册信号处理和清理。成功时，`runCli(...)` 会清空 `scope`，因此调用的 `finally` 块不会关闭它。若转移抛出异常，该函数必须关闭任务，但不能接管 `scope`；调用的 `finally` 块随后会关闭 `scope`。转移后的工作还必须在写入后续诊断信息前结束交互式输出。

只有被 `isTerminalCommandOutput(...)` 接受的值才会到达 `writePreparedOutput(...)`。应用自己负责特殊任务、进程信号和长期运行工作使用的资源。

## 选择输出格式化方式

请选择两种输出路径之一：

- 当 JSON、表格和 CSV 使用同一组顶层字段时，返回通过 `createPresentation()` 创建的输出值。
- 当 JSON 需要完整的嵌套报告，而表格或 CSV 需要选定列和应用自己的格式化时，直接在应用中调用 `renderJson(...)`、`renderTextTable(...)` 或 `renderCsv(...)`。

格式选择见[格式化并写入输出](../../guides/presentation-output.md)，直接 API 见[准备输出数据](../../guides/presentation-primitives.md)。

## 当命令可以立即运行时使用 `app.run(...)`

当命令所需的一切都已准备好，并且命令返回 `TerminalApp` 可以写入的输出时，使用 `app.run(...)`：

```ts
// Use the one-call API when application data is already available.
process.exitCode = await app.run(args, context, {
  strict: true
});
```

只有在应用自行创建或关闭命令执行期间的资源时，才使用上述步骤。
