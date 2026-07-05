/**
 * The presentation facade exposes reusable terminal view and rendering
 * mechanics as a small semantic surface.
 *
 * Allowed here:
 * - creating presentation view factories;
 * - wiring generic JSON, CSV, and text table renderers;
 * - exposing a single `render` method for terminal app composition;
 *
 * This file must not contain application report mapping, command execution, or
 * stdout/stderr delivery.
 */

import {
  presentationFormats,
  type PresentationFormat
} from './format-options';
import {
  renderCsv,
  renderCsvRow
} from './renderers/csv';
import { renderJson } from './renderers/json';
import { renderTextTable } from './renderers/table';
import { renderPresentationResult } from './result-renderer';
import {
  createPresentationViewFactory,
  type CsvRow,
  type PresentationResult,
  type PresentationViewFactory,
  type TextTableRow
} from './view';

export type PresentationRenderers = {
  json: {
    render(value: unknown): string;
  };
  table: {
    render(rows: readonly TextTableRow[]): string;
  };
  csv: {
    render(rows: readonly CsvRow[]): string;
    renderRow(row: CsvRow): string;
  };
};

export type Presentation = PresentationViewFactory & {
  formats: typeof presentationFormats;
  render(result: PresentationResult, format?: PresentationFormat): string;
  renderers: PresentationRenderers;
};

export type { PresentationResult } from './view';

export function createPresentation(): Presentation {
  const viewFactory = createPresentationViewFactory();

  return {
    ...viewFactory,
    formats: presentationFormats,
    render: renderPresentationResult,
    renderers: {
      json: {
        render: renderJson
      },
      table: {
        render: renderTextTable
      },
      csv: {
        render: renderCsv,
        renderRow: renderCsvRow
      }
    }
  };
}
