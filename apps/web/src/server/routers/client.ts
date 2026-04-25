import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "@/server/trpc";

export const clientsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user as any;
    return ctx.prisma.client.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "desc" },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.client.findFirst({
        where: { id: input.id, orgId: user.orgId },
        include: { projects: true, contracts: true, invoices: true },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email().optional().nullable(),
        phone: z.string().optional().nullable(),
        company: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.client.create({
        data: { ...input, orgId: user.orgId },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        address: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      const { id, ...data } = input;
      return ctx.prisma.client.updateMany({
        where: { id, orgId: user.orgId },
        data,
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.client.deleteMany({
        where: { id: input.id, orgId: user.orgId },
      });
    }),
});
