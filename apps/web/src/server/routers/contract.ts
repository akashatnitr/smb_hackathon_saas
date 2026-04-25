import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "@/server/trpc";

export const contractRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user as any;
    return ctx.prisma.contract.findMany({
      where: { orgId: user.orgId },
      include: { client: true, signatures: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.contract.findFirst({
        where: { id: input.id, orgId: user.orgId },
        include: { client: true, signatures: true },
      });
    }),

  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        clientId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.contract.create({
        data: { ...input, orgId: user.orgId },
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        status: z.enum(["DRAFT", "SENT", "SIGNED", "EXPIRED"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      const { id, ...data } = input;
      return ctx.prisma.contract.updateMany({
        where: { id, orgId: user.orgId },
        data,
      });
    }),

  sign: protectedProcedure
    .input(
      z.object({
        contractId: z.string(),
        signerName: z.string().min(1),
        signerEmail: z.string().email(),
        signatureData: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      const contract = await ctx.prisma.contract.findFirst({
        where: { id: input.contractId, orgId: user.orgId },
      });
      if (!contract) throw new Error("Contract not found");

      await ctx.prisma.contractSignature.create({
        data: {
          contractId: input.contractId,
          signerName: input.signerName,
          signerEmail: input.signerEmail,
          signatureData: input.signatureData,
          signedAt: new Date(),
          userId: user.id,
        },
      });

      return ctx.prisma.contract.update({
        where: { id: input.contractId },
        data: { status: "SIGNED" },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.contract.deleteMany({
        where: { id: input.id, orgId: user.orgId },
      });
    }),
});
