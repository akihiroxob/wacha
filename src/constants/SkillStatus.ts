export const SkillStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  DEPRECATED: "deprecated",
} as const;

export type SkillStatus = (typeof SkillStatus)[keyof typeof SkillStatus];
