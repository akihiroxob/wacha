import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CommentInput,
  CreateStoryResponse,
  OkResponse,
  ProjectDetailResponse,
  ProjectListResponse,
  ReasonInput,
  StoryInput,
  TaskInput,
} from "@shared/apiTypes";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";

export const useProjects = () =>
  useQuery({
    queryKey: ["projects"],
    queryFn: () => apiGet<ProjectListResponse>("/api/projects"),
  });

export const useProject = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiGet<ProjectDetailResponse>(`/api/projects/${projectId}`),
    refetchInterval: 5000,
  });

const useInvalidateProject = (projectId: string) => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["project", projectId] });
};

export const useCreateStory = (projectId: string) => {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (input: StoryInput) =>
      apiPost<CreateStoryResponse>(`/api/projects/${projectId}/stories`, input),
    onSuccess: invalidate,
  });
};

export const useUpdateStory = (projectId: string) => {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: ({ storyId, ...input }: { storyId: string } & StoryInput) =>
      apiPut<OkResponse>(`/api/projects/${projectId}/stories/${storyId}`, input),
    onSuccess: invalidate,
  });
};

export const useDeleteStory = (projectId: string) => {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (storyId: string) =>
      apiDelete<OkResponse>(`/api/projects/${projectId}/stories/${storyId}`),
    onSuccess: invalidate,
  });
};

export const useUpdateTask = (projectId: string) => {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: ({ taskId, ...input }: { taskId: string } & TaskInput) =>
      apiPut<OkResponse>(`/api/projects/${projectId}/tasks/${taskId}`, input),
    onSuccess: invalidate,
  });
};

export const useDeleteTask = (projectId: string) => {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (taskId: string) =>
      apiDelete<OkResponse>(`/api/projects/${projectId}/tasks/${taskId}`),
    onSuccess: invalidate,
  });
};

export const useAcceptTask = (projectId: string) => {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (taskId: string) =>
      apiPost<OkResponse>(`/api/projects/${projectId}/tasks/${taskId}/accept`, {}),
    onSuccess: invalidate,
  });
};

export const useRejectTask = (projectId: string) => {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: ({ taskId, ...input }: { taskId: string } & ReasonInput) =>
      apiPost<OkResponse>(`/api/projects/${projectId}/tasks/${taskId}/reject`, input),
    onSuccess: invalidate,
  });
};

export const useCancelTask = (projectId: string) => {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: ({ taskId, ...input }: { taskId: string } & ReasonInput) =>
      apiPost<OkResponse>(`/api/projects/${projectId}/tasks/${taskId}/cancel`, input),
    onSuccess: invalidate,
  });
};

export const useAddTaskComment = (projectId: string) => {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: ({ taskId, ...input }: { taskId: string } & CommentInput) =>
      apiPost<OkResponse>(`/api/projects/${projectId}/tasks/${taskId}/comments`, input),
    onSuccess: invalidate,
  });
};
