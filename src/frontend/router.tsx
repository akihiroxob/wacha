import { createBrowserRouter } from "react-router-dom";
import { ProjectListPage } from "@/pages/ProjectListPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { AddStoryPage } from "@/pages/AddStoryPage";
import { EditStoryPage } from "@/pages/EditStoryPage";
import { EditTaskPage } from "@/pages/EditTaskPage";

export const router = createBrowserRouter([
  { path: "/", element: <ProjectListPage /> },
  { path: "/project/:projectId", element: <ProjectDetailPage /> },
  { path: "/project/:projectId/story/add", element: <AddStoryPage /> },
  { path: "/project/:projectId/story/:storyId/edit", element: <EditStoryPage /> },
  { path: "/project/:projectId/task/:taskId/edit", element: <EditTaskPage /> },
]);
