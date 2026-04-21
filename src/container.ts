// repositories
import { SQLiteTaskRepository } from "@repository/SQLiteTaskRepository.ts";
import { SQLiteProjectRepository } from "@repository/SQLiteProjectRepository.ts";
import { SQLiteProjectMembershipRepository } from "@repository/SQLiteProjectMembershipRepository.ts";
import { SQLiteStoryRepository } from "@repository/SQLiteStoryRepository.ts";
import { InMemorySessionRepository } from "@repository/InMemorySessionRepository.ts";
// application services
import { SessionService } from "@application/service/SessionService.ts";
import { MembershipService } from "@application/service/MembershipService.ts";
import { InstructionService } from "@application/service/InstructionService.ts";

// domain service
import { RoleAssignmentService } from "@domain/service/RoleAssignmentService.ts";

// usecases
// project role assignment
import { AssignProjectRoleUseCase } from "@application/usecase/membership/AssignProjectRoleUseCase.ts";
import { ListProjectAgentsUseCase } from "@application/usecase/membership/ListProjectAgentsUseCase.ts";
// project usecases[]
import { GetProjectUseCase } from "@application/usecase/project/GetProjectUseCase.ts";
import { ListProjectUseCase } from "@application/usecase/project/ListProjectUseCase.ts";
// task usecases
import { ListTaskUseCase } from "@application/usecase/tasks/ListTaskUseCase.ts";
import { IssueTaskUseCase } from "@application/usecase/tasks/IssueTaskUseCase.ts";
import { ClaimTaskUseCase } from "@application/usecase/tasks/ClaimTaskUseCase.ts";
import { CompleteTaskUseCase } from "@application/usecase/tasks/CompleteTaskUseCase.ts";
import { ReviewedTaskUseCase } from "@application/usecase/tasks/ReviewedTaskUseCase.ts";
import { AcceptTaskUseCase } from "@application/usecase/tasks/AcceptTaskUseCase.ts";
import { RejectTaskUseCase } from "@application/usecase/tasks/RejectTaskUseCase.ts";
import { DeleteTaskUseCase } from "@application/usecase/tasks/DeleteTaskUseCase.ts";
import { ListTaskRejectUseCase } from "@application/usecase/tasks/ListTaskRejectUseCase.ts";
import { AddTaskCommentUseCase } from "@application/usecase/tasks/AddTaskCommentUseCase.ts";
import { ListTaskCommentUseCase } from "@application/usecase/tasks/ListTaskCommentUseCase.ts";
// story usecases
import { ListStoryUseCase } from "@application/usecase/stories/ListStoryUseCase.ts";
import { IssueStoryUseCase } from "@application/usecase/stories/IssueStoryUseCase.ts";
import { EditStoryUseCase } from "@application/usecase/stories/EditStoryUseCase.ts";
import { DeleteStoryUseCase } from "@application/usecase/stories/DeleteStoryUseCase.ts";
import { ClaimStoryUseCase } from "@application/usecase/stories/ClaimStoryUseCase.ts";
import { CompleteStoryUseCase } from "@application/usecase/stories/CompleteStoryUseCase.ts";
import { CancelStoryUseCase } from "@application/usecase/stories/CancelStoryUseCase.ts";

// repositoriesのインスタンスを作成
const taskRepository = new SQLiteTaskRepository();
const projectRepository = new SQLiteProjectRepository();
const projectMembershipRepository = new SQLiteProjectMembershipRepository();
const storyRepository = new SQLiteStoryRepository();
const roleAssignmentService = new RoleAssignmentService();
const sessionRepository = new InMemorySessionRepository();

// 依存性を注入してユースケースのインスタンスを作成
export const sessionService = new SessionService(sessionRepository);
export const membershipService = new MembershipService(projectMembershipRepository);
export const instructionService = new InstructionService();
export const listTaskUseCase = new ListTaskUseCase(taskRepository);
export const issueTaskUseCase = new IssueTaskUseCase(taskRepository);
export const claimTaskUseCase = new ClaimTaskUseCase(taskRepository, storyRepository);
export const completeTaskUseCase = new CompleteTaskUseCase(taskRepository);
export const reviewedTaskUseCase = new ReviewedTaskUseCase(taskRepository);
export const acceptTaskUseCase = new AcceptTaskUseCase(taskRepository, storyRepository);
export const rejectTaskUseCase = new RejectTaskUseCase(taskRepository);
export const deleteTaskUseCase = new DeleteTaskUseCase(taskRepository);
export const listTaskRejectUseCase = new ListTaskRejectUseCase(taskRepository);
export const addTaskCommentUseCase = new AddTaskCommentUseCase(taskRepository);
export const listTaskCommentUseCase = new ListTaskCommentUseCase(taskRepository);
export const listStoryUseCase = new ListStoryUseCase(storyRepository);
export const issueStoryUseCase = new IssueStoryUseCase(storyRepository);
export const editStoryUseCase = new EditStoryUseCase(storyRepository);
export const deleteStoryUseCase = new DeleteStoryUseCase(storyRepository, taskRepository);
export const claimStoryUseCase = new ClaimStoryUseCase(storyRepository);
export const completeStoryUseCase = new CompleteStoryUseCase(storyRepository);
export const cancelStoryUseCase = new CancelStoryUseCase(storyRepository);
export const assignProjectRoleUseCase = new AssignProjectRoleUseCase(
  projectRepository,
  projectMembershipRepository,
  roleAssignmentService,
);
export const listProjectUseCase = new ListProjectUseCase(projectRepository);
export const getProjectUseCase = new GetProjectUseCase(projectRepository);
export const listProjectAgentsUseCase = new ListProjectAgentsUseCase(projectMembershipRepository);
