import { ProjectRole, type ProjectRole as ProjectRoleValue } from "../src/constants/ProjectRole.ts";
import { DatabaseClient } from "../src/infrastructure/database/SQLiteClient.ts";
import { initializeSchema } from "../src/infrastructure/database/initializeSchema.ts";
import { SQLiteProjectGrantRepository } from "../src/infrastructure/repository/SQLiteProjectGrantRepository.ts";

const [projectId, principalId, roleInput] = process.argv.slice(2);
const allowedRoles = [ProjectRole.WORKER, ProjectRole.REVIEWER, ProjectRole.MANAGER] as const;

if (!projectId || !principalId || !roleInput || !allowedRoles.includes(roleInput as never)) {
  console.error("Usage: npm run grant-role -- <projectId> <AgentName> <worker|reviewer|manager>");
  process.exitCode = 1;
} else {
  await initializeSchema();
  const project = await DatabaseClient.selectFrom("project")
    .select(["id", "name"])
    .where("id", "=", projectId)
    .executeTakeFirst();
  if (!project) {
    console.error(`Project ${projectId} was not found`);
    process.exitCode = 1;
  } else {
    await new SQLiteProjectGrantRepository().grant(
      projectId,
      principalId,
      roleInput as ProjectRoleValue,
    );
    console.log(`Granted ${roleInput} on ${project.name} (${projectId}) to ${principalId}`);
  }
}

await DatabaseClient.destroy();
