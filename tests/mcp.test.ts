import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/mcp/route";

function rpc(body: unknown) {
  return POST(new Request("http://localhost/api/mcp", { method: "POST", body: JSON.stringify(body) }));
}

describe("MCP route", () => {
  it("echoes the JSON-RPC request id and lists only month_grid", async () => {
    const body = await (await rpc({ jsonrpc: "2.0", id: 7, method: "tools/list" })).json();
    expect(body.id).toBe(7);
    expect(body.result.tools.map((t: { name: string }) => t.name)).toEqual(["month_grid"]);
  });

  it("month_grid returns the same 6x7 grid the board shows", async () => {
    const { result } = await (await rpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "month_grid", arguments: { year: 2026, month: 2 } } })).json();
    expect(result.label).toBe("February 2026");
    expect(result.weeks).toHaveLength(6);
    expect(result.weeks[0][0]).toEqual({ date: "2026-02-01", inMonth: true });
    expect(result.weeks[4][6]).toEqual({ date: "2026-03-07", inMonth: false });
  });

  it("rejects out-of-range arguments, unknown tools and methods", async () => {
    const bad = await (await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "month_grid", arguments: { year: 2026, month: 13 } } })).json();
    expect(bad.error.code).toBe(-32602);
    expect(bad.id).toBe(3);
    expect((await (await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "month_grid", arguments: { year: "2026", month: 1 } } })).json()).error.code).toBe(-32602);
    expect((await (await rpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "get_data" } })).json()).error.code).toBe(-32602);
    expect((await (await rpc({ jsonrpc: "2.0", id: 6, method: "events/list" })).json()).error.code).toBe(-32601);
  });

  it("answers initialize and rejects a malformed body", async () => {
    expect((await (await rpc({ jsonrpc: "2.0", id: 8, method: "initialize" })).json()).result.serverInfo.name).toBe("Calendar Board");
    const res = await POST(new Request("http://localhost/api/mcp", { method: "POST", body: "{" }));
    expect((await res.json()).error.code).toBe(-32700);
  });
});
