import { ChangeLogTable } from "@database/schema/changeLog.ts";
import { CommandReceiptTable } from "@database/schema/commandReceipt.ts";
import { ProjectTable } from "@database/schema/project.ts";
import { ProjectGrantTable } from "@database/schema/projectGrant.ts";
import { StoryTable } from "@database/schema/story.ts";
import { TaskClaimTable } from "@database/schema/taskClaim.ts";
import { TaskCommentTable } from "@database/schema/taskComment.ts";
import { TaskTable } from "@database/schema/task.ts";

export interface DataBase {
  change_log: ChangeLogTable;
  command_receipt: CommandReceiptTable;
  project_grant: ProjectGrantTable;
  project: ProjectTable;
  story: StoryTable;
  task: TaskTable;
  task_claim: TaskClaimTable;
  task_comment: TaskCommentTable;
}
