export interface WsMessage {
  type: 'message' | 'typing' | 'read' | 'error' | 'chat_message';
  [key: string]: unknown;
}

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private roomId: string;
  private token: string;
  private onMessage: (msg: WsMessage) => void;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  constructor(
    roomId: string,
    token: string,
    onMessage: (msg: WsMessage) => void,
  ) {
    this.roomId = roomId;
    this.token = token;
    this.onMessage = onMessage;
  }

  connect(): void {
    this.intentionalClose = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.ws = new WebSocket(
      `${protocol}//${host}/ws/chat?room_id=${this.roomId}`,
    );

    this.ws.onopen = () => {
      // Connected to chat room
      // Send auth token as the first message instead of in the URL query string
      this.ws?.send(JSON.stringify({ type: 'auth', token: this.token }));
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsMessage;
        this.onMessage(msg);
      } catch {
        console.error('[WS] Failed to parse message', e.data);
      }
    };

    this.ws.onclose = () => {
      if (!this.intentionalClose) {
        // Disconnected, reconnecting in 3s;
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = (e) => {
      console.error('[WS] Error', e);
    };
  }

  send(content: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'message', content }));
    }
  }

  sendTyping(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'typing' }));
    }
  }

  sendRead(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'read' }));
    }
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
