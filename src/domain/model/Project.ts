export class Project {
  constructor(
    public id: string,
    public name: string,
    public description: string | null,
    public baseDir: string,
    public createdAt: number,
    public updatedAt: number,
  ) {
    if (name.trim() === "") {
      throw new Error("project name cannot be empty");
    }
    if (baseDir.trim() === "") {
      throw new Error("project baseDir cannot be empty");
    }
  }

  changeName(name: string) {
    if (name.trim() === "") {
      throw new Error("project name cannot be empty");
    }
    this.name = name.trim();
    this.updatedAt = Date.now();
  }

  changeDescription(description: string) {
    this.description = description.trim() === "" ? null : description.trim();
    this.updatedAt = Date.now();
  }

  changeBaseDir(baseDir: string) {
    if (baseDir.trim() === "") {
      throw new Error("project baseDir cannot be empty");
    }
    this.baseDir = baseDir.trim();
    this.updatedAt = Date.now();
  }
}
