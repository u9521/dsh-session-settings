/**
 * Arguments textarea <-> argument list round-trip.
 *
 * The textarea cannot be a direct projection of the parsed array: trimming and
 * blank-line dropping happen on every parse, so re-rendering the parsed result
 * would erase a trailing space or a trailing empty line the instant it was
 * typed, making both impossible to enter. Instead the field keeps a raw draft
 * and only falls back to the parsed view when something other than this field
 * changed the arguments.
 */

/** Parse the textarea: one argument per line, blank lines dropped. */
export function parseArgs(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Compare two argument lists exactly (order included). */
function sameArgs(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

/**
 * The draft the textarea should render.
 *
 * While the draft still parses to `args` it is kept verbatim, so characters the
 * parser normalizes away (a trailing space or blank line mid-edit) stay on
 * screen. Once the two disagree — another server was loaded, or a field was
 * populated externally — `args` wins.
 * @param draft - the text currently shown in the field.
 * @param args - the authoritative parsed arguments.
 * @returns the text to render.
 */
export function reconcileArgsDraft(
  draft: string,
  args: readonly string[],
): string {
  return sameArgs(parseArgs(draft), args) ? draft : args.join('\n')
}
