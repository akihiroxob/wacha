import { StoryStatus } from "@constants/StoryStatus.ts";

export class Story {
  constructor(
    public id: string,
    public projectId: string,
    public title: string,
    public description: string | null,
    public status: StoryStatus,
    public createdAt: number,
    public updatedAt: number,
  ) {
    if (projectId.trim() === "") {
      throw new Error("story projectId cannot be empty");
    }
    if (title.trim() === "") {
      throw new Error("story title cannot be empty");
    }
  }

  changeTitle(title: string) {
    if (title.trim() === "") {
      throw new Error("story title cannot be empty");
    }
    this.title = title.trim();
    this.updatedAt = Date.now();
  }

  changeDescription(description: string) {
    this.description = description.trim() === "" ? null : description.trim();
    this.updatedAt = Date.now();
  }

  claim() {
    this.status = StoryStatus.DOING;
    this.updatedAt = Date.now();
  }

  complete() {
    this.status = StoryStatus.DONE;
    this.updatedAt = Date.now();
  }

  cancel() {
    this.status = StoryStatus.CANCELED;
    this.updatedAt = Date.now();
  }
}
