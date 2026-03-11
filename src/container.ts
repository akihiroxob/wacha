import { SQLiteTaskRepository } from "@repository/SQLiteTaskRepository.ts";
import { ListTaskUseCase } from "@application/usecase/ListTaskUseCase.ts";
import { IssueTaskUseCase } from "@application/usecase/IssueTaskUseCase.ts";
import { ClaimTaskUseCase } from "@application/usecase/ClaimTaskUseCase.ts";
import { CompleteTaskUseCase } from "@application/usecase/CompleteTaskUseCase.ts";
import { AcceptTaskUseCase } from "@application/usecase/AcceptTaskUseCase.ts";
import { RejectTaskUseCase } from "@application/usecase/RejectTaskUseCase.ts";

const repo = new SQLiteTaskRepository();
export const listTaskUseCase = new ListTaskUseCase(repo);
export const issueTaskUseCase = new IssueTaskUseCase(repo);
export const claimTaskUseCase = new ClaimTaskUseCase(repo);
export const completeTaskUseCase = new CompleteTaskUseCase(repo);
export const acceptTaskUseCase = new AcceptTaskUseCase(repo);
export const rejectTaskUseCase = new RejectTaskUseCase(repo);
