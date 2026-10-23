import { NextResponse } from "next/server";
import { monthLabel, monthMatrix, ymd } from "@/lib/calendar";

// Stateless JSON-RPC MCP endpoint over the calendar's month logic. Events live only in each visitor's
// localStorage, so the server has none to list and does not pretend to.

type RpcRequest = { id?: number | string | null; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };

const TOOLS = [
  {
    name: "month_grid",
    description: "The 6x7 grid of dates (Sunday first) the board shows for a month, with its label",
    inputSchema: {
      type: "object",
      properties: { year: { type: "integer", minimum: 1970, maximum: 9999 }, month: { type: "integer", minimum: 1, maximum: 12 } },
      required: ["year", "month"],
    },
  },
];

class RpcError extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

function readInt(value: unknown, name: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new RpcError(-32602, `Argument ${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function callTool(name: string | undefined, args: Record<string, unknown> = {}) {
  switch (name) {
    case "month_grid": {
      const month = { year: readInt(args.year, "year", 1970, 9999), month: readInt(args.month, "month", 1, 12) - 1 };
      const days = monthMatrix(month).map((day) => ({ date: ymd(day), inMonth: day.getMonth() === month.month }));
      return { label: monthLabel(month), weeks: Array.from({ length: 6 }, (_, week) => days.slice(week * 7, week * 7 + 7)) };
    }
    default:
      throw new RpcError(-32602, `Unknown tool: ${String(name)}`);
  }
}

export async function POST(request: Request) {
  let id: RpcRequest["id"] = null;
  try {
    const body = (await request.json()) as RpcRequest;
    id = body.id ?? null;
    let result: unknown;
    switch (body.method) {
      case "initialize":
        result = { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "Calendar Board", version: "1.0.0" } };
        break;
      case "tools/list":
        result = { tools: TOOLS };
        break;
      case "tools/call":
        result = callTool(body.params?.name, body.params?.arguments);
        break;
      default:
        throw new RpcError(-32601, `Unknown method: ${String(body.method)}`);
    }
    return NextResponse.json({ jsonrpc: "2.0", id, result });
  } catch (error) {
    const code = error instanceof RpcError ? error.code : -32700;
    const message = error instanceof RpcError ? error.message : "Parse error";
    return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: 400 });
  }
}
