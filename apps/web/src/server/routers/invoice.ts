import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "@/server/trpc";

export const invoiceRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user as any;
    return ctx.prisma.invoice.findMany({
      where: { orgId: user.orgId },
      include: { client: true, lineItems: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.invoice.findFirst({
        where: { id: input.id, orgId: user.orgId },
        include: { client: true, lineItems: true },
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        number: z.string().min(1),
        clientId: z.string().optional(),
        issueDate: z.string().datetime(),
        dueDate: z.string().datetime(),
        lineItems: z.array(
          z.object({
            description: z.string().min(1),
            quantity: z.number().min(0),
            rate: z.number().min(0),
            amount: z.number().min(0),
          })
        ),
        total: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      const { lineItems, ...invoiceData } = input;
      return ctx.prisma.invoice.create({
        data: {
          ...invoiceData,
          orgId: user.orgId,
          issueDate: new Date(invoiceData.issueDate),
          dueDate: new Date(invoiceData.dueDate),
          lineItems: { create: lineItems },
        },
        include: { lineItems: true, client: true },
      });
    }),

  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.invoice.updateMany({
        where: { id: input.id, orgId: user.orgId },
        data: { status: input.status },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.invoice.deleteMany({
        where: { id: input.id, orgId: user.orgId },
      });
    }),
});
