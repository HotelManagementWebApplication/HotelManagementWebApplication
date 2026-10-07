import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { agentApi } from "../../../shared/api/agent";
import { CustomerChatWidget } from "./CustomerChatWidget";


vi.mock("../../../shared/api/agent", () => ({
  agentApi: { streamChat: vi.fn() },
}));


describe("CustomerChatWidget", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(agentApi.streamChat).mockReset();
  });

  it("opens with an accessible welcome message", async () => {
    render(<CustomerChatWidget />);

    fireEvent.click(screen.getByRole("button", { name: "Mở trợ lý MaM Hotel" }));

    expect(screen.getByRole("region", { name: "Trợ lý MaM Hotel" })).toBeTruthy();
    expect(screen.getByText(/giải thích chính sách khách sạn/i)).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Nội dung câu hỏi" })));
  });

  it("streams an answer without exposing internal citations", async () => {
    vi.mocked(agentApi.streamChat).mockImplementation(async (_message, _history, handlers) => {
      handlers.onMetadata({
        mode: "rag",
        citations: [{ source: "customer-policy.md", title: "4. Hủy phòng và không đến nhận phòng", start_line: 60, end_line: 69 }],
      });
      handlers.onToken("Hủy đúng ");
      handlers.onToken("48 giờ sẽ mất tiền cọc.");
    });
    const firstRender = render(<CustomerChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Mở trợ lý MaM Hotel" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nội dung câu hỏi" }), {
      target: { value: "Hủy đúng 48 giờ có mất cọc không?" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));

    expect(await screen.findByText("Hủy đúng 48 giờ sẽ mất tiền cọc.")).toBeTruthy();
    expect(screen.queryByText(/Nguồn tham khảo/)).toBeNull();
    expect(screen.queryByText(/customer-policy\.md/)).toBeNull();
    expect(agentApi.streamChat).toHaveBeenCalledWith(
      "Hủy đúng 48 giờ có mất cọc không?",
      [],
      expect.any(Object),
      expect.any(AbortSignal),
    );
  });

  it("shows a recoverable connection error", async () => {
    vi.mocked(agentApi.streamChat).mockRejectedValue(new Error("Không thể kết nối trợ lý."));
    render(<CustomerChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Mở trợ lý MaM Hotel" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nội dung câu hỏi" }), {
      target: { value: "Xin chào" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Không thể kết nối trợ lý"));
    expect(screen.getByText("Xin chào")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Nội dung câu hỏi" }) as HTMLTextAreaElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Thử lại câu hỏi" })).toBeTruthy();
  });

  it("shows the streaming state, appends tokens progressively, and can stop", async () => {
    let resolveStream: (() => void) | undefined;
    let rejectStream: ((error: unknown) => void) | undefined;
    vi.mocked(agentApi.streamChat).mockImplementation(async (_message, _history, handlers, signal) => {
      handlers.onMetadata({ mode: "rag", citations: [] });
      handlers.onToken("Một phần");
      await new Promise<void>((resolve, reject) => {
        resolveStream = resolve;
        rejectStream = reject;
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    });

    render(<CustomerChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Mở trợ lý MaM Hotel" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nội dung câu hỏi" }), { target: { value: "Hỏi" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Nội dung câu hỏi" }), { key: "Enter" });

    expect((await screen.findByRole("status")).textContent).toMatch(/đang tìm thông tin|đang trả lời/i);
    expect(await screen.findByText("Một phần")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dừng trả lời" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dừng trả lời" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Gửi câu hỏi" })).toBeTruthy());
    expect(screen.getByText("Một phần")).toBeTruthy();
    expect(resolveStream).toBeDefined();
    expect(rejectStream).toBeDefined();
  });

  it("retries the last user turn after an error", async () => {
    vi.mocked(agentApi.streamChat)
      .mockRejectedValueOnce(new Error("Gemini tạm thời không phản hồi."))
      .mockImplementationOnce(async (_message, _history, handlers) => {
        handlers.onMetadata({ mode: "clarification", citations: [] });
        handlers.onToken("Đã thử lại thành công.");
      });

    render(<CustomerChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Mở trợ lý MaM Hotel" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nội dung câu hỏi" }), { target: { value: "Thử lại" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Thử lại câu hỏi" }));
    expect(await screen.findByText("Đã thử lại thành công.")).toBeTruthy();
    expect(agentApi.streamChat).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("Thử lại")).toHaveLength(1);
  });

  it("clears visible and persisted history, including an in-flight request", async () => {
    vi.mocked(agentApi.streamChat).mockImplementation(async (_message, _history, _handlers, signal) => {
      await new Promise<void>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    });

    render(<CustomerChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Mở trợ lý MaM Hotel" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nội dung câu hỏi" }), { target: { value: "Xóa giúp" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));
    expect(await screen.findByText("Xóa giúp")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Xóa lịch sử chat" }));

    expect(screen.getByText(/giải thích chính sách khách sạn/i)).toBeTruthy();
    expect(screen.queryByText("Xóa giúp")).toBeNull();
    expect(sessionStorage.getItem("hotel_mis_customer_chat_history")).toBeNull();
    expect((screen.getByRole("textbox", { name: "Nội dung câu hỏi" }) as HTMLTextAreaElement).disabled).toBe(false);
  });

  it("persists only chat fields and restores them without access tokens", async () => {
    vi.mocked(agentApi.streamChat).mockImplementation(async (_message, _history, handlers) => {
      handlers.onMetadata({ mode: "clarification", citations: [] });
      handlers.onToken("Không chứa token.");
    });

    const firstRender = render(<CustomerChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Mở trợ lý MaM Hotel" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nội dung câu hỏi" }), { target: { value: "Lịch sử" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));
    await screen.findByText("Không chứa token.");

    const stored = sessionStorage.getItem("hotel_mis_customer_chat_history");
    expect(stored).toContain("Lịch sử");
    expect(stored).not.toContain("access_token");
    expect(stored).not.toContain("secret-token");

    // Re-mount the widget to prove the persisted shape is sufficient for restoration.
    firstRender.unmount();
    render(<CustomerChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Mở trợ lý MaM Hotel" }));
    expect(screen.getByText("Không chứa token.")).toBeTruthy();
  });

  it("keeps the composer accessible and send disabled for empty input", () => {
    render(<CustomerChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Mở trợ lý MaM Hotel" }));

    const composer = screen.getByRole("textbox", { name: "Nội dung câu hỏi" });
    expect(composer.getAttribute("placeholder")).toBe("Hỏi về chính sách, phòng hoặc booking…");
    expect((screen.getByRole("button", { name: "Gửi câu hỏi" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(screen.getByRole("region", { name: "Trợ lý MaM Hotel" })).getByRole("button", { name: "Xóa lịch sử chat" })).toBeTruthy();
  });

  it("parses the live SSE contract incrementally and sends the token only as an auth header", async () => {
    const actualAgentApi = await vi.importActual<typeof import("../../../shared/api/agent")>("../../../shared/api/agent");
    sessionStorage.setItem("hotel_mis_access_token", "secret-token");
    sessionStorage.setItem("hotel_mis_refresh_token", "refresh-token");
    const responseText = [
      "event: metadata\ndata: {\"mode\":\"rag\",\"citations\":[{\"source\":\"customer-policy.md\",\"title\":\"Hủy phòng\",\"start_line\":60,\"end_line\":69}]}\n\n",
      "event: token\ndata: {\"text\":\"Một phần \"}\n\n",
      "event: token\ndata: {\"text\":\"câu trả lời\"}\n\n",
      "event: done\ndata: {}\n\n",
    ].join("");
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(responseText.slice(0, 47)));
        controller.enqueue(encoder.encode(responseText.slice(47)));
        controller.close();
      },
    });
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream, { status: 200 }));
    globalThis.fetch = fetchMock;
    const tokens: string[] = [];
    let completed = false;

    try {
      await actualAgentApi.agentApi.streamChat(
        "Hỏi chính sách",
        [{ role: "user", content: "Trước đó", access_token: "secret-token" } as never],
        {
          onMetadata: metadata => expect(metadata.citations[0].start_line).toBe(60),
          onToken: token => tokens.push(token),
          onDone: () => { completed = true; },
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(tokens).toEqual(["Một phần ", "câu trả lời"]);
    expect(completed).toBe(true);
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect((request.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    expect(JSON.parse(String(request.body))).toEqual({ message: "Hỏi chính sách", history: [{ role: "user", content: "Trước đó" }] });
    expect(String(request.body)).not.toContain("secret-token");
  });

  it("rejects malformed and agent error SSE events with recoverable messages", async () => {
    const actualAgentApi = await vi.importActual<typeof import("../../../shared/api/agent")>("../../../shared/api/agent");
    const originalFetch = globalThis.fetch;
    const encoder = new TextEncoder();
    const responseFor = (payload: string) => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(payload));
        controller.close();
      },
    }), { status: 200 });

    try {
      globalThis.fetch = vi.fn().mockResolvedValue(responseFor("event: metadata\ndata: nope\n\n"));
      await expect(actualAgentApi.agentApi.streamChat("Hỏi", [], { onMetadata: () => undefined, onToken: () => undefined })).rejects.toThrow("Phản hồi trợ lý không hợp lệ");

      globalThis.fetch = vi.fn().mockResolvedValue(responseFor("event: error\ndata: {\"message\":\"Gemini đang bận\"}\n\n"));
      await expect(actualAgentApi.agentApi.streamChat("Hỏi", [], { onMetadata: () => undefined, onToken: () => undefined })).rejects.toThrow("Gemini đang bận");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
