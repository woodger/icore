import assert from 'node:assert';
import { describe, test } from 'node:test';
import { renderJson } from '../../index';

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
});
