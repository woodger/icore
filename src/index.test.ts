import assert from 'node:assert';
import { describe, test } from 'node:test';
import {
  CliUsageError,
  createCommand,
  createCommands,
  createOutput,
  createStdoutWriter,
  createTerminalApp,
  createTerminalOutput,
  createTerminalProgress,
  createPresentation,
  formatTerminalCount,
  formatTerminalDuration,
  IcoreError,
  isIcoreError,
  isTerminalCommandOutput,
  isUsageError,
  presentationFormatOptions,
  renderCsvRow,
  renderJson,
  renderTerminalProgress,
  renderTextTable,
  type IcoreErrorCategory,
  type IcoreErrorDetailsMap,
  type TerminalProgressRenderer,
  type TerminalErrorPolicy
} from './index';

describe('package entrypoint', () => {
  test('exposes terminal presentation and output contracts', () => {
    assert.equal(typeof renderJson, 'function');
    assert.equal(typeof renderCsvRow, 'function');
    assert.equal(typeof renderTextTable, 'function');
    assert.equal(typeof createStdoutWriter, 'function');
    assert.equal(typeof createOutput, 'function');
    assert.equal(typeof createCommand, 'function');
    assert.equal(typeof createCommands, 'function');
    assert.equal(typeof createPresentation, 'function');
    assert.equal(typeof createTerminalApp, 'function');
    assert.equal(typeof createTerminalOutput, 'function');
    assert.equal(typeof createTerminalProgress, 'function');
    assert.equal(typeof formatTerminalCount, 'function');
    assert.equal(typeof formatTerminalDuration, 'function');
    assert.equal(typeof isTerminalCommandOutput, 'function');
    assert.equal(typeof renderTerminalProgress, 'function');
    assert.deepStrictEqual(createPresentation().text('ok\n'), {
      type: 'text',
      value: 'ok\n'
    });
    assert.deepStrictEqual(presentationFormatOptions.format.choices, [
      'json',
      'table',
      'csv'
    ]);

    const category: IcoreErrorCategory = 'usage';
    const errorPolicy: TerminalErrorPolicy<{ name: string }> = {
      resolveExitCode(error, context) {
        assert.equal(error, 'failed');
        assert.equal(context.phase, 'external');

        return 2;
      }
    };
    const progressRenderer: TerminalProgressRenderer = (progress) => {
      return `${progress.percentage.toFixed(1)}%`;
    };

    assert.equal(category, 'usage');
    assert.equal(progressRenderer({
      label: 'Syncing',
      current: 1,
      total: 2,
      details: [],
      percentage: 50
    }), '50.0%');
    assert.equal(errorPolicy.resolveExitCode?.('failed', {
      phase: 'external'
    }), 2);
  });

  test('exposes typed error contracts', () => {
    const details: IcoreErrorDetailsMap['UNKNOWN_COMMAND'] = {
      reason: 'unresolved',
      command: 'unknown',
      positionals: ['unknown']
    };
    const error: unknown = new IcoreError(
      'UNKNOWN_COMMAND',
      'Unknown command: unknown',
      details
    );

    assert.ok(isIcoreError(error, 'UNKNOWN_COMMAND'));
    assert.equal(error.details.command, 'unknown');
  });

  test('exposes application usage error contracts', () => {
    const error: unknown = new CliUsageError('Invalid date range');

    assert.ok(isUsageError(error));
    assert.equal(error.message, 'Invalid date range');
  });
});
