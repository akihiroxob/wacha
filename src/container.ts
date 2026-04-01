// repositories
import { SQLiteTaskRepository } from "@repository/SQLiteTaskRepository.ts";
import { SQLiteProjectRepository } from "@repository/SQLiteProjectRepository.ts";
import { SQLiteProjectMembershipRepository } from "@repository/SQLiteProjectMembershipRepository.ts";
import { SQLiteStoryRepository } from "@repository/SQLiteStoryRepository.ts";
// domain service
import { RoleAssignmentService } from "@domain/service/RoleAssignmentService.ts";

// usecases
// project role assignment
import { AssignProjectRoleUseCase } from "@application/usecase/AssignProjectRoleUseCase.ts";
// project usecases[]
import { GetProjectUseCase } from "@application/usecase/project/GetProjectUseCase.ts";
import { ListProjectUseCase } from "@application/usecase/project/ListProjectUseCase.ts";
// task usecases
import { ListTaskUseCase } from "@application/usecase/tasks/ListTaskUseCase.ts";
import { IssueTaskUseCase } from "@application/usecase/tasks/IssueTaskUseCase.ts";
import { ClaimTaskUseCase } from "@application/usecase/tasks/ClaimTaskUseCase.ts";
import { CompleteTaskUseCase } from "@application/usecase/tasks/CompleteTaskUseCase.ts";
import { AcceptTaskUseCase } from "@application/usecase/tasks/AcceptTaskUseCase.ts";
import { RejectTaskUseCase } from "@application/usecase/tasks/RejectTaskUseCase.ts";
import { ListStoryUseCase } from "@application/usecase/stories/ListStoryUseCase.ts";
import { IssueStoryUseCase } from "@application/usecase/stories/IssueStoryUseCase.ts";

// repositoriesのインスタンスを作成
const taskRepository = new SQLiteTaskRepository();
const projectRepository = new SQLiteProjectRepository();
const projectMembershipRepository = new SQLiteProjectMembershipRepository();
const storyRepository = new SQLiteStoryRepository();
const roleAssignmentService = new RoleAssignmentService();

// 依存性を注入してユースケースのインスタンスを作成
export const listTaskUseCase = new ListTaskUseCase(taskRepository);
export const issueTaskUseCase = new IssueTaskUseCase(taskRepository);
export const claimTaskUseCase = new ClaimTaskUseCase(taskRepository);
export const completeTaskUseCase = new CompleteTaskUseCase(taskRepository);
export const acceptTaskUseCase = new AcceptTaskUseCase(taskRepository);
export const rejectTaskUseCase = new RejectTaskUseCase(taskRepository);
export const listStoryUseCase = new ListStoryUseCase(storyRepository);
export const issueStoryUseCase = new IssueStoryUseCase(storyRepository);
export const assignProjectRoleUseCase = new AssignProjectRoleUseCase(
  projectRepository,
  projectMembershipRepository,
  roleAssignmentService,
);
export const listProjectUseCase = new ListProjectUseCase(projectRepository);
export const getProjectUseCase = new GetProjectUseCase(projectRepository);
