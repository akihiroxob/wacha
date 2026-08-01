// repositories
import { SQLiteTaskRepository } from "@repository/SQLiteTaskRepository.ts";
import { SQLiteProjectRepository } from "@repository/SQLiteProjectRepository.ts";
import { SQLiteProjectGrantRepository } from "@repository/SQLiteProjectGrantRepository.ts";
import { SQLiteStoryRepository } from "@repository/SQLiteStoryRepository.ts";
import { FileSkillRepository } from "@repository/FileSkillRepository.ts";
import { FileKnowledgeRepository } from "@repository/FileKnowledgeRepository.ts";
// application services
import { InstructionService } from "@application/service/InstructionService.ts";
import { TaskCoordinationService } from "@application/service/TaskCoordinationService.ts";

// usecases
import { ListProjectGrantsUseCase } from "@application/usecase/grants/ListProjectGrantsUseCase.ts";
// project usecases[]
import { GetProjectUseCase } from "@application/usecase/project/GetProjectUseCase.ts";
import { ListProjectUseCase } from "@application/usecase/project/ListProjectUseCase.ts";
import { GetSkillContextUseCase } from "@application/usecase/skills/GetSkillContextUseCase.ts";
import { ListSkillUseCase } from "@application/usecase/skills/ListSkillUseCase.ts";
// task usecases
import { ListTaskUseCase } from "@application/usecase/tasks/ListTaskUseCase.ts";
import { EditTaskUseCase } from "@application/usecase/tasks/EditTaskUseCase.ts";
import { CancelTaskUseCase } from "@application/usecase/tasks/CancelTaskUseCase.ts";
import { AcceptTaskUseCase } from "@application/usecase/tasks/AcceptTaskUseCase.ts";
import { RejectTaskUseCase } from "@application/usecase/tasks/RejectTaskUseCase.ts";
import { DeleteTaskUseCase } from "@application/usecase/tasks/DeleteTaskUseCase.ts";
import { AddTaskCommentUseCase } from "@application/usecase/tasks/AddTaskCommentUseCase.ts";
import { ListTaskCommentUseCase } from "@application/usecase/tasks/ListTaskCommentUseCase.ts";
// story usecases
import { ListStoryUseCase } from "@application/usecase/stories/ListStoryUseCase.ts";
import { IssueStoryUseCase } from "@application/usecase/stories/IssueStoryUseCase.ts";
import { EditStoryUseCase } from "@application/usecase/stories/EditStoryUseCase.ts";
import { DeleteStoryUseCase } from "@application/usecase/stories/DeleteStoryUseCase.ts";

// repositoriesのインスタンスを作成
const taskRepository = new SQLiteTaskRepository();
const projectRepository = new SQLiteProjectRepository();
const projectGrantRepository = new SQLiteProjectGrantRepository();
const storyRepository = new SQLiteStoryRepository();
const skillRepository = new FileSkillRepository();
const knowledgeRepository = new FileKnowledgeRepository();

// 依存性を注入してユースケースのインスタンスを作成
export const instructionService = new InstructionService();
export const taskCoordinationService = new TaskCoordinationService();
export const listTaskUseCase = new ListTaskUseCase(taskRepository, storyRepository);
export const editTaskUseCase = new EditTaskUseCase(taskRepository);
export const cancelTaskUseCase = new CancelTaskUseCase(taskRepository);
export const acceptTaskUseCase = new AcceptTaskUseCase(taskRepository, storyRepository);
export const rejectTaskUseCase = new RejectTaskUseCase(taskRepository);
export const deleteTaskUseCase = new DeleteTaskUseCase(taskRepository);
export const addTaskCommentUseCase = new AddTaskCommentUseCase(taskRepository);
export const listTaskCommentUseCase = new ListTaskCommentUseCase(taskRepository);
export const listStoryUseCase = new ListStoryUseCase(storyRepository);
export const issueStoryUseCase = new IssueStoryUseCase(storyRepository);
export const editStoryUseCase = new EditStoryUseCase(storyRepository);
export const deleteStoryUseCase = new DeleteStoryUseCase(storyRepository, taskRepository);
export const listProjectUseCase = new ListProjectUseCase(projectRepository);
export const getProjectUseCase = new GetProjectUseCase(projectRepository);
export const listProjectGrantsUseCase = new ListProjectGrantsUseCase(projectGrantRepository);
export const listSkillUseCase = new ListSkillUseCase(skillRepository);
export const getSkillContextUseCase = new GetSkillContextUseCase(
  skillRepository,
  knowledgeRepository,
);
