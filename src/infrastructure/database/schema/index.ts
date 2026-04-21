import { ProjectMembershipTable } from "@database/schema/projectMembership.ts";
import { ProjectTable } from "@database/schema/project.ts";
import { StoryTable } from "@database/schema/story.ts";
import { TaskCommentTable } from "@database/schema/taskComment.ts";
import { TaskTable } from "@database/schema/task.ts";
import { TaskRejectTable } from "@database/schema/taskReject.ts";

export interface DataBase {
  project_membership: ProjectMembershipTable;
  project: ProjectTable;
  story: StoryTable;
  task: TaskTable;
  task_comment: TaskCommentTable;
  task_reject: TaskRejectTable;
}
