import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

export const boardRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user as any;
    return ctx.prisma.board.findMany({
      where: { orgId: user.orgId },
      include: { project: true, columns: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.board.findFirst({
        where: { id: input.id, orgId: user.orgId },
        include: {
          project: true,
          columns: { orderBy: { order: "asc" } },
          tasks: {
            include: { assignee: { select: { id: true, name: true, image: true } } },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        projectId: z.string().optional(),
        columns: z.array(z.string()).default(["To Do", "In Progress", "Done"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.board.create({
        data: {
          name: input.name,
          orgId: user.orgId,
          projectId: input.projectId,
          columns: {
            create: input.columns.map((name, i) => ({ name, order: i })),
          },
        },
        include: { columns: { orderBy: { order: "asc" } } },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.board.deleteMany({
        where: { id: input.id, orgId: user.orgId },
      });
    }),
});
