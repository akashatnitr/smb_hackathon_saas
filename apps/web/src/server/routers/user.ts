import { z } from "zod";
import { hash } from "bcryptjs";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "@/server/trpc";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user as any;
    return ctx.prisma.user.findUnique({
      where: { id: user.id },
      include: { organization: true },
    });
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user as any;
    return ctx.prisma.user.findMany({
      where: { orgId: user.orgId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        image: true,
        createdAt: true,
        _count: { select: { assignedTasks: true, timeEntries: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["ORG_ADMIN", "ORG_EMPLOYEE"]).default("ORG_EMPLOYEE"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      const passwordHash = await hash(input.password, 10);
      return ctx.prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          role: input.role,
          orgId: user.orgId,
        },
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        role: z.enum(["ORG_ADMIN", "ORG_EMPLOYEE"]).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      const { id, ...data } = input;
      return ctx.prisma.user.updateMany({
        where: { id, orgId: user.orgId },
        data,
      });
    }),

  workload: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user as any;
    const users = await ctx.prisma.user.findMany({
      where: { orgId: user.orgId },
      include: {
        assignedTasks: {
          where: { column: { name: { not: "Done" } } },
          select: { id: true, title: true, priority: true, dueDate: true },
        },
        timeEntries: {
          where: {
            startTime: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
      },
    });
    return users.map((u) => ({
      ...u,
      totalHoursThisWeek: u.timeEntries.reduce((sum, te) => sum + (te.durationSeconds || 0), 0) / 3600,
    }));
  }),
});
