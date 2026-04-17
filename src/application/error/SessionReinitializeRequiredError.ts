import { ValidationError } from "@application/error/ValidationError.ts";

export class SessionReinitializeRequiredError extends ValidationError {
  readonly rpcCode = -32001;
  readonly rpcData = {
    reason: "session_not_found",
    retry: "initialize",
  };

  constructor() {
    super("Session expired or server restarted; initialize again");
  }
}
