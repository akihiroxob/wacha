import { ProjectMembershipTable } from "@database/schema/projectMembership.ts";
import { ProjectTable } from "@database/schema/project.ts";
import { StoryTable } from "@database/schema/story.ts";
import { TaskTable } from "@database/schema/task.ts";

export interface DataBase {
  project_membership: ProjectMembershipTable;
  project: ProjectTable;
  story: StoryTable;
  task: TaskTable;
}
