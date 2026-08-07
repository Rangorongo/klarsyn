// Thrown when Claude's response doesn't match what a bounded AI task
// requires (e.g. no tool_use block despite a forced tool_choice). Never a
// raw stacktrace to the user — same convention as SkatteverketParseError.
export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiOutputError";
  }
}
