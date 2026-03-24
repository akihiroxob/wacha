import { AssignProjectRoleUseCase } from "@application/usecase/AssignProjectRoleUseCase.ts";
import { SQLiteTaskRepository } from "@repository/SQLiteTaskRepository.ts";
import { SQLiteProjectRepository } from "@repository/SQLiteProjectRepository.ts";
import { SQLiteProjectMembershipRepository } from "@repository/SQLiteProjectMembershipRepository.ts";
import { ListTaskUseCase } from "@application/usecase/ListTaskUseCase.ts";
import { IssueTaskUseCase } from "@application/usecase/IssueTaskUseCase.ts";
import { ClaimTaskUseCase } from "@application/usecase/ClaimTaskUseCase.ts";
import { CompleteTaskUseCase } from "@application/usecase/CompleteTaskUseCase.ts";
import { AcceptTaskUseCase } from "@application/usecase/AcceptTaskUseCase.ts";
import { RejectTaskUseCase } from "@application/usecase/RejectTaskUseCase.ts";
import { RoleAssignmentService } from "@domain/service/RoleAssignmentService.ts";

const taskRepository = new SQLiteTaskRepository();
const projectRepository = new SQLiteProjectRepository();
const projectMembershipRepository = new SQLiteProjectMembershipRepository();
const roleAssignmentService = new RoleAssignmentService();

export const listTaskUseCase = new ListTaskUseCase(taskRepository);
export const issueTaskUseCase = new IssueTaskUseCase(taskRepository);
export const claimTaskUseCase = new ClaimTaskUseCase(taskRepository);
export const completeTaskUseCase = new CompleteTaskUseCase(taskRepository);
export const acceptTaskUseCase = new AcceptTaskUseCase(taskRepository);
export const rejectTaskUseCase = new RejectTaskUseCase(taskRepository);
export const assignProjectRoleUseCase = new AssignProjectRoleUseCase(
  projectRepository,
  projectMembershipRepository,
  roleAssignmentService,
);
