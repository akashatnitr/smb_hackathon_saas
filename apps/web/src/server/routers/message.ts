import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";

export const messageRouter = createTRPCRouter({
  conversations: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user as any;
    return ctx.prisma.conversation.findMany({
      where: {
        orgId: user.orgId,
        participants: { some: { userId: user.id } },
      },
      include: {
        participants: { include: { user: { select: { id: true, name: true, image: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  getConversation: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      return ctx.prisma.conversation.findFirst({
        where: {
          id: input.id,
          orgId: user.orgId,
          participants: { some: { userId: user.id } },
        },
        include: {
          participants: { include: { user: { select: { id: true, name: true, image: true } } } },
          messages: {
            include: { sender: { select: { id: true, name: true, image: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    }),

  createConversation: protectedProcedure
    .input(
      z.object({
        title: z.string().optional(),
        participantIds: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      const allParticipants = Array.from(new Set([user.id, ...input.participantIds]));
      return ctx.prisma.conversation.create({
        data: {
          title: input.title,
          orgId: user.orgId,
          participants: {
            create: allParticipants.map((id) => ({ userId: id })),
          },
        },
        include: { participants: { include: { user: { select: { id: true, name: true } } } } },
      });
    }),

  sendMessage: protectedProcedure
    .input(z.object({ conversationId: z.string(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user as any;
      const conv = await ctx.prisma.conversation.findFirst({
        where: {
          id: input.conversationId,
          orgId: user.orgId,
          participants: { some: { userId: user.id } },
        },
      });
      if (!conv) throw new Error("Conversation not found");
      return ctx.prisma.message.create({
        data: {
          conversationId: input.conversationId,
          senderId: user.id,
          content: input.content,
        },
        include: { sender: { select: { id: true, name: true, image: true } } },
      });
    }),
});
