# 生产级终端应用

[English](../../guides/terminal-app.md) | [Русский](../../ru/guides/terminal-app.md) | 简体中文

> 本文是英文版的简体中文翻译。如有差异，以英文版为准。

[README 快速开始](../readme.md#快速开始)使用 `app.run(...)`，因为
对已具备 context 的小型 CLI 来说，这是最清晰的入口。

当应用满足以下情况时，请使用本指南中的显式 lifecycle：

- 在 command validation 前处理全局 help 或 version shortcuts；
- 根据 prepared command metadata 或 payload 选择 runtime resources；
- 自行拥有 resource cleanup、progress 或 long-running handles；
- 同时仍希望使用 `TerminalApp` 的 rendering、output 和 error policy。

生产级流程如下：

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

Cleanup 先于 error reporting，以确保 progress 与 resources 已经结束，再向
stderr 写入 diagnostics。Runtime resources 会一直保持打开，直到
`writePreparedOutput(...)` 完成，因为 terminal output 可能是仍依赖这些
资源的异步流。

## 一次性组合命令与终端服务

一次性绑定共享 application contracts，同时保留 command-specific schema、
path、payload、aliases 和 result inference：

```ts
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

type AppContext = {
  currentUser: string;
};

type LongRunningCommandHandle = {
  completed: Promise<void>;
  close(): Promise<void>;
};

type LongRunningCommandResult = {
  kind: 'long-running';
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
    && 'kind' in result
    && result.kind === 'long-running';
}

type CommandMetadata = {
  description: string;
  resources:
    | readonly ResourceName[]
    | ((payload: unknown) => readonly ResourceName[]);
};

const runtimeOptions = {
  insecure: {
    type: 'boolean',
    syntax: 'flag'
  }
} as const;

const command = createCommand.withTypes<{
  context: AppContext;
  result: CliCommandResult;
  metadata: CommandMetadata;
  metadataRequired: true;
}>();

const presentation = createPresentation();

declare function startUserWatcher(
  context: AppContext
): LongRunningCommandHandle;

const currentUserCommand = command.define({
  path: ['users', 'current'],
  options: mergeOptionsSchema(
    presentationFormatOptions,
    runtimeOptions
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

const watchUsersCommand = command.define({
  path: ['users', 'watch'],
  options: runtimeOptions,
  metadata: {
    description: 'Watch the current user',
    resources: ['remote-api']
  },
  handle({ context }) {
    return {
      kind: 'long-running',
      handle: startUserWatcher(context)
    } satisfies LongRunningCommandResult;
  }
});

const commands = command.registry([
  currentUserCommand,
  watchUsersCommand
] as const);

const app = createTerminalApp({
  commands,
  presentation,
  output: createOutput(),
  errorPolicy: {
    renderError(error) {
      const message = error instanceof Error
        ? error.message
        : String(error);

      return `${message}\n`;
    },
    resolveExitCode(error) {
      return isUsageError(error) ? 2 : 1;
    }
  }
});
```

每次 CLI invocation 只创建一次 `command`、`commands`、`presentation`、
`output` 和 `app`。资源实例不属于这次组合；只有在 `app.prepare(...)` 确定
所选命令后才创建它们。

## 在不重写 argv 的情况下解析全局快捷方式

在 bootstrap option schema 中声明短 aliases。`parseArgv(...)` 会将 `-h`
和 `-v` 映射到 canonical names，而 `parseOptionsSubsetDetailed(...)` 只验证
bootstrap 拥有的 options：

```ts
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
  ...runtimeOptions
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

将原始 `args` 传给 `app.prepare(...)`；不要根据 subset result 重建 argv。
这样 command-specific options 才会继续提供给所选命令的 schema。

应包含每个其类型会影响 token ownership 的 bootstrap option。例如，声明
boolean `--insecure` 可以防止 shortcut parsing 把后续 command segment
误认为它的值。

## 资源、清理与错误顺序的所有权

应用提供自己的 help renderer 和 resource scope：

```ts
type InvocationScope = {
  context: AppContext;
  /**
   * Idempotently closes progress or another interactive stdout line.
   * `close()` also calls this when execution fails before final output.
   */
  finishInteractiveOutput(): Promise<void>;
  /** Closes interactive output first, then runtime resources. */
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

`createInvocationScope(...)` 应在每个资源创建后立即注册 cleanup，并在
initialization 失败时回滚已经创建的部分资源。

[由 metadata 驱动的 help 方案](practical-cli-patterns.md#根据命令元数据构建-help)
展示 `renderHelp(...)` 如何从 `commands.definitions` 构建 canonical command
inventory，而不重复 aliases。

Runner 保留主要 failure 的 phase、合并 cleanup failure，并且只在 cleanup
完成后报告：

```ts
type Prepared = Awaited<ReturnType<typeof app.prepare>>;
type FailurePhase = 'execute' | 'write' | 'external';

type InvocationFailure = {
  error: unknown;
  phase: FailurePhase;
};

function selectResources(prepared: Prepared): readonly ResourceName[] {
  const selection = prepared.command.metadata.resources;

  return typeof selection === 'function'
    ? selection(prepared.payload)
    : selection;
}

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

`writePreparedOutput(...)` 同时执行 rendering 和 writing。外部 caller 无法
区分这两种 failure，因此本方案将 rejection 报告为 `write`。内置的
`app.run(...)` 与 `app.runPrepared(...)` 路径可以在内部区分 `render` 和
`write`。

绑定的 `CliCommandResult` 是上界。普通命令仍保留其具体 presentation
result，而 `watchUsersCommand` 保留具体 `LongRunningCommandResult`。

`transferLongRunningLifecycle(...)` 属于应用策略。它必须在注册 handle 与
scope 的 signal handling 和 cleanup 后才返回。成功时 runner 清空 `scope`，
因此 invocation `finally` 不再拥有它。如果 transfer 抛出异常，它必须关闭
handle，但不能取得 scope ownership；随后 invocation `finally` 关闭 scope。
转移后的 lifecycle 也负责在写入后续 diagnostics 前结束 interactive output。

只有被 `isTerminalCommandOutput(...)` 接受的 results 才会到达
`writePreparedOutput(...)`。这样 custom handles、process signals 与
long-running resource ownership 都保持在 terminal app 边界之外。

## 选择表示层所有权

请在两种 presentation 路径中选择一种：

- 当同一个扁平 projection 适用于 JSON、table 和 CSV 时，从
  `createPresentation()` 返回 view。
- 当 JSON 需要完整的嵌套 report，而 table 或 CSV 需要选定 columns 与
  domain formatting 时，由 Consumer 直接选择 `renderJson(...)`、
  `renderTextTable(...)` 或 `renderCsv(...)`。

格式选择见 [Presentation And Output（英文）](../../guides/presentation-output.md)，
底层契约见 [Presentation Primitives（英文）](../../guides/presentation-primitives.md)。

## 为简单应用保留精简路径

当 context 已存在且 handlers 返回终端支持的 output 时，请优先使用精简路径：

```ts
process.exitCode = await app.run(args, context, {
  strict: true
});
```

显式方案用于 application-owned lifecycle 工作，并非每个 CLI 都必须采用的
固定流程。
