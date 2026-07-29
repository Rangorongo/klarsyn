// Thrown on broken/unexpected XML or PDF structure. Message is always
// user-facing Swedish text suggesting the other parser as a fallback — never
// a raw stacktrace. See "Felhantering" in the design spec.
export class SkatteverketParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkatteverketParseError";
  }
}
