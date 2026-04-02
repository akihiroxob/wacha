import { Story } from "@domain/model/Story.ts";

export interface StoryRepository {
  findAll(): Promise<Story[]>;
  findById(storyId: string): Promise<Story | null>;
  findByProjectId(projectId: string): Promise<Story[]>;
  create(projectId: string, title: string, description: string | null): Promise<Story>;
  save(story: Story): Promise<void>;
  delete(storyId: string): Promise<void>;
}
