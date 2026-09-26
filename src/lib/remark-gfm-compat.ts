import { gfmTableFromMarkdown, gfmTableToMarkdown } from 'mdast-util-gfm-table';
import { gfmTable } from 'micromark-extension-gfm-table';
import { gfmStrikethroughFromMarkdown, gfmStrikethroughToMarkdown } from 'mdast-util-gfm-strikethrough';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import { gfmTaskListItemFromMarkdown, gfmTaskListItemToMarkdown } from 'mdast-util-gfm-task-list-item';
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item';
import { gfmFootnoteFromMarkdown, gfmFootnoteToMarkdown } from 'mdast-util-gfm-footnote';
import { gfmFootnote } from 'micromark-extension-gfm-footnote';

/**
 * Check if the runtime JS engine supports RegExp lookbehind assertions.
 * Older WebKit versions (Safari < 16.4 / macOS Monterey 12.x) throw
 * SyntaxError: Invalid regular expression: invalid group specifier name
 * when evaluating mdast-util-gfm-autolink-literal regexes.
 */
function checkLookbehindSupport(): boolean {
  try {
    new RegExp('(?<=^|\\s)(a)');
    return true;
  } catch {
    return false;
  }
}

export const supportsLookbehind = checkLookbehindSupport();

/**
 * WebKit/Safari-safe remark-gfm replacement plugin.
 * Enables tables, strikethrough, task lists, footnotes, and conditionally
 * enables autolink literals only if RegExp lookbehind is supported by the engine.
 */
export function remarkGfmCompat(this: any, options?: any) {
  const data = this.data();

  const micromarkExtensions =
    data.micromarkExtensions || (data.micromarkExtensions = []);
  const fromMarkdownExtensions =
    data.fromMarkdownExtensions || (data.fromMarkdownExtensions = []);
  const toMarkdownExtensions =
    data.toMarkdownExtensions || (data.toMarkdownExtensions = []);

  micromarkExtensions.push(
    gfmTable(),
    gfmStrikethrough(options),
    gfmTaskListItem(),
    gfmFootnote()
  );

  fromMarkdownExtensions.push(
    gfmTableFromMarkdown(),
    gfmStrikethroughFromMarkdown(),
    gfmTaskListItemFromMarkdown(),
    gfmFootnoteFromMarkdown()
  );

  toMarkdownExtensions.push({
    extensions: [
      gfmTableToMarkdown(options),
      gfmStrikethroughToMarkdown(),
      gfmTaskListItemToMarkdown(),
      gfmFootnoteToMarkdown(options),
    ],
  });
}
