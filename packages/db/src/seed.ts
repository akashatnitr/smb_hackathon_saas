import { prisma } from "./client";
import { hash } from "bcryptjs";

async function main() {
  const org = await prisma.organization.create({
    data: {
      name: "Acme Demo",
      slug: "acme-demo",
      plan: "free",
    },
  });

  const adminPass = await hash("admin123", 10);
  const empPass = await hash("employee123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@acme.com",
      passwordHash: adminPass,
      name: "Admin User",
      role: "ORG_ADMIN",
      orgId: org.id,
    },
  });

  const employee = await prisma.user.create({
    data: {
      email: "employee@acme.com",
      passwordHash: empPass,
      name: "Employee One",
      role: "ORG_EMPLOYEE",
      orgId: org.id,
    },
  });

  const client = await prisma.client.create({
    data: {
      name: "John Doe",
      email: "john@client.com",
      phone: "+1-555-0100",
      company: "Client Corp",
      orgId: org.id,
    },
  });

  const project = await prisma.project.create({
    data: {
      name: "Website Redesign",
      description: "Redesign the corporate website",
      orgId: org.id,
      clientId: client.id,
    },
  });

  const board = await prisma.board.create({
    data: {
      name: "Website Redesign Board",
      orgId: org.id,
      projectId: project.id,
      columns: {
        create: [
          { name: "To Do", order: 0 },
          { name: "In Progress", order: 1 },
          { name: "Review", order: 2 },
          { name: "Done", order: 3 },
        ],
      },
    },
  });

  const columns = await prisma.boardColumn.findMany({
    where: { boardId: board.id },
    orderBy: { order: "asc" },
  });

  await prisma.task.create({
    data: {
      title: "Design homepage mockups",
      description: "Create Figma mockups for the new homepage",
      priority: "HIGH",
      assigneeId: employee.id,
      creatorId: admin.id,
      columnId: columns[0].id,
      boardId: board.id,
      orgId: org.id,
      projectId: project.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("✅ Seed complete");
  console.log({ orgId: org.id, adminId: admin.id, employeeId: employee.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
