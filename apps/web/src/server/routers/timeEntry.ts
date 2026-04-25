import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

export const timeEntryRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          userId: z.string().optional(),
          taskId: z.string().optional(),
          projectId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.timeEntry.findMany({
        where: {
          orgId: user.orgId,
          ...(input?.userId ? { userId: input.userId } : {}),
          ...(input?.taskId ? { taskId: input.taskId } : {}),
          ...(input?.projectId ? { projectId: input.projectId } : {}),
        },
        include: {
          user: { select: { id: true, name: true } },
          task: { select: { id: true, title: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { startTime: "desc" },
      });
    }),

  start: protectedProcedure
    .input(
      z.object({
        taskId: z.string().optional(),
        projectId: z.string().optional(),
        description: z.string().optional(),
        isBillable: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.timeEntry.create({
        data: {
          ...input,
          userId: user.id,
          orgId: user.orgId,
          startTime: new Date(),
        },
      });
    }),

  stop: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      const entry = await ctx.prisma.timeEntry.findFirst({
        where: { id: input.id, userId: user.id },
      });
      if (!entry) throw new Error("Not found");
      const endTime = new Date();
      const durationSeconds = Math.floor(
        (endTime.getTime() - entry.startTime.getTime()) / 1000
      );
      return ctx.prisma.timeEntry.update({
        where: { id: input.id },
        data: { endTime, durationSeconds },
      });
    }),

  createManual: protectedProcedure
    .input(
      z.object({
        taskId: z.string().optional(),
        projectId: z.string().optional(),
        startTime: z.string().datetime(),
        endTime: z.string().datetime(),
        description: z.string().optional(),
        isBillable: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      const start = new Date(input.startTime);
      const end = new Date(input.endTime);
      const durationSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
      return ctx.prisma.timeEntry.create({
        data: {
          ...input,
          userId: user.id,
          orgId: user.orgId,
          startTime: start,
          endTime: end,
          durationSeconds,
        },
      });
    }),
});
