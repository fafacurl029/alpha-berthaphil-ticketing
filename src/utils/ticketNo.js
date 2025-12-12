/*
  Collision-safe ticket number generation using TicketSequence in a transaction.

  Format: T-YYYYMMDD-0001
*/
function dateKeyUTC(d = new Date()) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

async function nextTicketNo(prisma) {
  const key = dateKeyUTC(new Date());

  const seq = await prisma.ticketSequence.upsert({
    where: { dateKey: key },
    create: { dateKey: key, nextSeq: 1 },
    update: { nextSeq: { increment: 1 } }
  });

  const n = seq.nextSeq;
  const padded = String(n).padStart(4, "0");
  return `T-${key}-${padded}`;
}

module.exports = { nextTicketNo };
