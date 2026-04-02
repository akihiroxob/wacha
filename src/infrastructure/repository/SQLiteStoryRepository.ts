import { StoryStatus } from "@constants/StoryStatus.ts";
import { Story } from "@domain/model/Story.ts";
import { StoryRepository } from "@domain/repository/StoryRepository.ts";
import { DatabaseClient } from "@database/SQLiteClient.ts";

export class SQLiteStoryRepository implements StoryRepository {
  async findAll(): Promise<Story[]> {
    const rows = await DatabaseClient.selectFrom("story").selectAll().execute();
    return rows.map(
      (row) =>
        new Story(
          row.id,
          row.project_id,
          row.title,
          row.description,
          row.status as StoryStatus,
          row.created_at,
          row.updated_at,
        ),
    );
  }

  async findById(storyId: string): Promise<Story | null> {
    const row = await DatabaseClient.selectFrom("story")
      .selectAll()
      .where("id", "=", storyId)
      .executeTakeFirst();

    if (!row) return null;

    return new Story(
      row.id,
      row.project_id,
      row.title,
      row.description,
      row.status as StoryStatus,
      row.created_at,
      row.updated_at,
    );
  }

  async findByProjectId(projectId: string): Promise<Story[]> {
    const rows = await DatabaseClient.selectFrom("story")
      .selectAll()
      .where("project_id", "=", projectId)
      .execute();

    return rows.map(
      (row) =>
        new Story(
          row.id,
          row.project_id,
          row.title,
          row.description,
          row.status as StoryStatus,
          row.created_at,
          row.updated_at,
        ),
    );
  }

  async create(projectId: string, title: string, description: string | null): Promise<Story> {
    const id = crypto.randomUUID();
    const now = Date.now();

    const story = await DatabaseClient.insertInto("story")
      .values({
        id,
        project_id: projectId,
        title,
        description,
        status: StoryStatus.TODO,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Story(
      story.id,
      story.project_id,
      story.title,
      story.description,
      story.status as StoryStatus,
      story.created_at,
      story.updated_at,
    );
  }

  async save(story: Story): Promise<void> {
    const existingStory = await this.findById(story.id);
    if (!existingStory) throw new Error("Story not found");

    await DatabaseClient.updateTable("story")
      .set({
        title: story.title,
        description: story.description,
        status: story.status,
        updated_at: Date.now(),
      })
      .where("id", "=", story.id)
      .execute();
  }

  async delete(storyId: string): Promise<void> {
    await DatabaseClient.deleteFrom("story").where("id", "=", storyId).execute();
  }
}
