const express = require("express");
const { getPrisma } = require("../db");
const { ok, bad } = require("../utils/http");
const { cleanStr, ALLOWED_STATUS, ALLOWED_PRIORITY } = require("../utils/validation");
const { requireAuth } = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");
const { nextTicketNo } = require("../utils/ticketNo");
const { toCsv } = require("../utils/csv");

const router = express.Router();
router.use(requireAuth());

function pickTicketSelect() {
  return {
    id: true,
    ticketNo: true,
    title: true,
    description: true,
    program: true,
    category: true,
    status: true,
    priority: true,
    source: true,
    dueDate: true,
    createdAt: true,
    updatedAt: true,
    createdBy: { select: { id: true, name: true, email: true } },
    assignedTo: { select: { id: true, name: true, email: true } }
  };
}

router.get("/", async (req, res) => {
  const prisma = getPrisma();

  const q = (req.query.q || "").toString().trim();
  const status = (req.query.status || "").toString().trim().toUpperCase();
  const priority = (req.query.priority || "").toString().trim().toUpperCase();
  const assignedToId = (req.query.assignedToId || "").toString().trim();
  const createdById = (req.query.createdById || "").toString().trim();

  const where = {};
  if (q) {
    where.OR = [
      { ticketNo: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { program: { contains: q, mode: "insensitive" } }
    ];
  }
  if (status && ALLOWED_STATUS.has(status)) where.status = status;
  if (priority && ALLOWED_PRIORITY.has(priority)) where.priority = priority;
  if (assignedToId) where.assignedToId = assignedToId;
  if (createdById) where.createdById = createdById;

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: pickTicketSelect()
  });

  return ok(res, tickets);
});

router.post("/", async (req, res) => {
  try {
    const prisma = getPrisma();

    const title = cleanStr(req.body.title, 140);
    const description = cleanStr(req.body.description, 5000);
    const program = cleanStr(req.body.program, 120);
    const category = cleanStr(req.body.category, 120);
    const source = cleanStr(req.body.source, 40) || "internal";
    const priority = (req.body.priority || "MEDIUM").toString().toUpperCase();
    const assignedToId = req.body.assignedToId ? String(req.body.assignedToId) : null;
    const dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;

    if (!title) return bad(res, 400, "Title is required");
    if (!ALLOWED_PRIORITY.has(priority)) return bad(res, 400, "Invalid priority");

    const ticket = await prisma.$transaction(async (tx) => {
      const ticketNo = await nextTicketNo(tx);

      const created = await tx.ticket.create({
        data: {
          ticketNo,
          title,
          description,
          program,
          category,
          source,
          priority,
          status: "OPEN",
          createdById: req.user.id,
          assignedToId,
          dueDate
        },
        select: pickTicketSelect()
      });

      await tx.ticketActivity.create({
        data: {
          ticketId: created.id,
          userId: req.user.id,
          action: "CREATED",
          meta: { ticketNo }
        }
      });

      return created;
    });

    return ok(res, ticket);
  } catch (e) {
    return bad(res, 500, "Create ticket failed", String(e?.message || e));
  }
});

router.get("/:id", async (req, res) => {
  const prisma = getPrisma();
  const id = String(req.params.id);

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: {
      ...pickTicketSelect(),
      comments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          message: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } }
        }
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          action: true,
          meta: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } }
        }
      }
    }
  });

  if (!ticket) return bad(res, 404, "Ticket not found");
  return ok(res, ticket);
});

router.patch("/:id", async (req, res) => {
  try {
    const prisma = getPrisma();
    const id = String(req.params.id);

    const data = {};
    const meta = {};

    if (req.body.title !== undefined) {
      const title = cleanStr(req.body.title, 140);
      if (!title) return bad(res, 400, "Title cannot be empty");
      data.title = title;
      meta.title = title;
    }
    if (req.body.description !== undefined) {
      const description = cleanStr(req.body.description, 5000);
      data.description = description;
      meta.description = true;
    }
    if (req.body.program !== undefined) {
      const program = cleanStr(req.body.program, 120);
      data.program = program;
      meta.program = program;
    }
    if (req.body.category !== undefined) {
      const category = cleanStr(req.body.category, 120);
      data.category = category;
      meta.category = category;
    }
    if (req.body.status !== undefined) {
      const status = String(req.body.status).toUpperCase();
      if (!ALLOWED_STATUS.has(status)) return bad(res, 400, "Invalid status");
      data.status = status;
      meta.status = status;
    }
    if (req.body.priority !== undefined) {
      const priority = String(req.body.priority).toUpperCase();
      if (!ALLOWED_PRIORITY.has(priority)) return bad(res, 400, "Invalid priority");
      data.priority = priority;
      meta.priority = priority;
    }
    if (req.body.assignedToId !== undefined) {
      const assignedToId = req.body.assignedToId ? String(req.body.assignedToId) : null;
      data.assignedToId = assignedToId;
      meta.assignedToId = assignedToId;
    }
    if (req.body.dueDate !== undefined) {
      const dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
      data.dueDate = dueDate;
      meta.dueDate = dueDate ? dueDate.toISOString() : null;
    }

    if (Object.keys(data).length === 0) return bad(res, 400, "No changes");

    const updated = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id },
        data,
        select: pickTicketSelect()
      });

      await tx.ticketActivity.create({
        data: {
          ticketId: id,
          userId: req.user.id,
          action: "UPDATED",
          meta
        }
      });

      return ticket;
    });

    return ok(res, updated);
  } catch (e) {
    return bad(res, 500, "Update ticket failed", String(e?.message || e));
  }
});

router.post("/:id/comments", async (req, res) => {
  try {
    const prisma = getPrisma();
    const id = String(req.params.id);
    const message = cleanStr(req.body.message, 2000);

    if (!message) return bad(res, 400, "Message is required");

    const result = await prisma.$transaction(async (tx) => {
      const exists = await tx.ticket.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new Error("Ticket not found");

      const comment = await tx.ticketComment.create({
        data: { ticketId: id, userId: req.user.id, message },
        select: {
          id: true, message: true, createdAt: true,
          user: { select: { id: true, name: true, email: true } }
        }
      });

      await tx.ticketActivity.create({
        data: { ticketId: id, userId: req.user.id, action: "COMMENTED", meta: { length: message.length } }
      });

      return comment;
    });

    return ok(res, result);
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes("Ticket not found")) return bad(res, 404, "Ticket not found");
    return bad(res, 500, "Add comment failed", msg);
  }
});

router.get("/export/csv", async (req, res) => {
  const prisma = getPrisma();

  const status = (req.query.status || "").toString().trim().toUpperCase();
  const priority = (req.query.priority || "").toString().trim().toUpperCase();

  const where = {};
  if (status && ALLOWED_STATUS.has(status)) where.status = status;
  if (priority && ALLOWED_PRIORITY.has(priority)) where.priority = priority;

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      ticketNo: true,
      title: true,
      program: true,
      category: true,
      status: true,
      priority: true,
      source: true,
      dueDate: true,
      createdAt: true,
      updatedAt: true
    }
  });

  const csv = toCsv(tickets.map(t => ({
    ...t,
    dueDate: t.dueDate ? t.dueDate.toISOString() : "",
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString()
  })), [
    { key: "ticketNo", label: "Ticket No" },
    { key: "title", label: "Title" },
    { key: "program", label: "Program" },
    { key: "category", label: "Category" },
    { key: "status", label: "Status" },
    { key: "priority", label: "Priority" },
    { key: "source", label: "Source" },
    { key: "dueDate", label: "Due Date" },
    { key: "createdAt", label: "Created At" },
    { key: "updatedAt", label: "Updated At" }
  ]);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="tickets.csv"');
  return res.send(csv);
});

module.exports = router;
