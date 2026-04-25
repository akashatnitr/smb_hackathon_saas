import { createTRPCRouter } from "@/server/trpc";
import { clientsRouter } from "./client";
import { userRouter } from "./user";
import { boardRouter } from "./board";
import { taskRouter } from "./task";
import { timeEntryRouter } from "./timeEntry";
import { contractRouter } from "./contract";
import { invoiceRouter } from "./invoice";
import { messageRouter } from "./message";
import { dashboardRouter } from "./dashboard";

export const appRouter = createTRPCRouter({
  clients: clientsRouter,
  user: userRouter,
  board: boardRouter,
  task: taskRouter,
  timeEntry: timeEntryRouter,
  contract: contractRouter,
  invoice: invoiceRouter,
  message: messageRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
