import { ProjectTable } from "@database/schema/project.ts";
import { StoryTable } from "@database/schema/story.ts";
import { TaskTable } from "@database/schema/task.ts";

export interface DataBase {
  project: ProjectTable;
  story: StoryTable;
  task: TaskTable;
}
