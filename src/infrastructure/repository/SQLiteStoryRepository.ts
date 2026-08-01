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
          row.sort_order,
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
      row.sort_order,
    );
  }

  async findByProjectId(projectId: string): Promise<Story[]> {
    const rows = await DatabaseClient.selectFrom("story")
      .selectAll()
      .where("project_id", "=", projectId)
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc")
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
          row.sort_order,
        ),
    );
  }

  async create(projectId: string, title: string, description: string | null): Promise<Story> {
    const id = crypto.randomUUID();
    const now = Date.now();

    // 既定は末尾(プロジェクト内の最大 sort_order + 1)
    const maxRow = await DatabaseClient.selectFrom("story")
      .select(({ fn }) => fn.max("sort_order").as("max_sort_order"))
      .where("project_id", "=", projectId)
      .executeTakeFirst();
    const sortOrder = (maxRow?.max_sort_order ?? 0) + 1;

    const story = await DatabaseClient.insertInto("story")
      .values({
        id,
        project_id: projectId,
        title,
        description,
        status: StoryStatus.TODO,
        sort_order: sortOrder,
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
      story.sort_order,
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
        sort_order: story.sortOrder,
        updated_at: Date.now(),
      })
      .where("id", "=", story.id)
      .execute();
  }

  async delete(storyId: string): Promise<void> {
    await DatabaseClient.deleteFrom("story").where("id", "=", storyId).execute();
  }
}
