import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

export const dashboardRouter = createTRPCRouter({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user as any;
    const orgId = user.orgId;

    const [
      totalClients,
      totalEmployees,
      totalTasks,
      pendingTasks,
      totalTimeThisWeek,
      totalInvoices,
      pendingInvoices,
    ] = await Promise.all([
      ctx.prisma.client.count({ where: { orgId } }),
      ctx.prisma.user.count({ where: { orgId } }),
      ctx.prisma.task.count({ where: { orgId } }),
      ctx.prisma.task.count({
        where: {
          orgId,
          column: { name: { not: "Done" } },
        },
      }),
      ctx.prisma.timeEntry.aggregate({
        where: {
          orgId,
          startTime: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        _sum: { durationSeconds: true },
      }),
      ctx.prisma.invoice.count({ where: { orgId } }),
      ctx.prisma.invoice.count({
        where: { orgId, status: { in: ["SENT", "OVERDUE"] } },
      }),
    ]);

    return {
      totalClients,
      totalEmployees,
      totalTasks,
      pendingTasks,
      totalTimeThisWeek: (totalTimeThisWeek._sum.durationSeconds || 0) / 3600,
      totalInvoices,
      pendingInvoices,
    };
  }),

  recentActivity: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user as any;
    return ctx.prisma.activityLog.findMany({
      where: { orgId: user.orgId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }),
});
