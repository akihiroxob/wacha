import { FC } from "hono/jsx";
import { TaskStatus } from "@constants/TaskStatus.ts";
import { TodoBadge, DoingBadge, InReviewBadge, AcceptedBadge, RejectedBadge } from "./badge.tsx";

type TaskRowProps = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  updatedAt: number;
};

export const TaskRow: FC<TaskRowProps> = ({ id, title, description, status, updatedAt }) => {
  return (
    <div class="flex bg-gray-50 rounded-md p-4 align-center gap-4 hover:bg-gray-100 transition-colors cursor-pointer justify-between">
      <div class="flex gap-4">
        {status === TaskStatus.TODO && <TodoBadge />}
        {status === TaskStatus.DOING && <DoingBadge />}
        {status === TaskStatus.IN_REVIEW && <InReviewBadge />}
        {status === TaskStatus.ACCEPTED && <AcceptedBadge />}
        {status === TaskStatus.REJECTED && <RejectedBadge />}
        <h3 class="text-lg font-semibold">{title}</h3>
      </div>
      <span class="text-gray-600 text-sm">
        {updatedAt ? new Date(updatedAt).toLocaleString() : ""}
      </span>
    </div>
  );
};
