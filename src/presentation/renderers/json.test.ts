import assert from 'node:assert';
import { describe, test } from 'node:test';
import { renderJson } from './json';

describe('renderJson', () => {
  test('renders pretty JSON with a trailing newline', () => {
    const output = renderJson([
      {
        id: 'account-1',
        name: 'Brokerage account'
      }
    ]);

    assert.equal(output, [
      '[',
      '  {',
      '    "id": "account-1",',
      '    "name": "Brokerage account"',
      '  }',
      ']',
      ''
    ].join('\n'));
  });

  test('renders null as JSON', () => {
    assert.equal(renderJson(null), 'null\n');
  });

  test('rejects top-level undefined values', () => {
    assert.throws(
      () => renderJson(undefined),
      {
        name: 'TypeError',
        message: 'Expected a JSON-serializable value'
      }
    );
  });
});
