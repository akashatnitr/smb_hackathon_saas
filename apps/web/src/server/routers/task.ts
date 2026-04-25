import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

export const taskRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ boardId: z.string() }).optional())
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.task.findMany({
        where: {
          orgId: user.orgId,
          ...(input?.boardId ? { boardId: input.boardId } : {}),
        },
        include: {
          assignee: { select: { id: true, name: true, image: true } },
          column: { select: { id: true, name: true } },
          board: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
        dueDate: z.string().datetime().optional(),
        assigneeId: z.string().optional().nullable(),
        columnId: z.string(),
        boardId: z.string(),
        projectId: z.string().optional(),
        labels: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.task.create({
        data: {
          ...input,
          creatorId: user.id,
          orgId: user.orgId,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        },
        include: {
          assignee: { select: { id: true, name: true, image: true } },
          column: { select: { id: true, name: true } },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
        dueDate: z.string().datetime().optional(),
        assigneeId: z.string().optional().nullable(),
        columnId: z.string().optional(),
        labels: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      const { id, ...data } = input;
      return ctx.prisma.task.updateMany({
        where: { id, orgId: user.orgId },
        data: {
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        },
      });
    }),

  move: protectedProcedure
    .input(z.object({ id: z.string(), columnId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.task.updateMany({
        where: { id: input.id, orgId: user.orgId },
        data: { columnId: input.columnId },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.task.deleteMany({
        where: { id: input.id, orgId: user.orgId },
      });
    }),

  comments: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.taskComment.findMany({
        where: { taskId: input.taskId, task: { orgId: user.orgId } },
        orderBy: { createdAt: "asc" },
      });
    }),

  addComment: protectedProcedure
    .input(z.object({ taskId: z.string(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.taskComment.create({
        data: {
          taskId: input.taskId,
          content: input.content,
          authorId: user.id,
        },
      });
    }),
});
