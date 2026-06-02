import { authService } from '@/lib/auth/authService';
import { eventService } from '@/lib/events/eventService';
import { TextMessage } from '@/lib/models';
import { AuthEventType } from '@/lib/auth/authService';

// Define WebSocket events
export enum WebSocketEventType {
  CONNECTED = 'websocket:connected',
  DISCONNECTED = 'websocket:disconnected',
  MESSAGE_RECEIVED = 'websocket:message_received',
  ERROR = 'websocket:error',
}

// WebSocket connection states
export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000; // Start with 2 seconds
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private baseUrl: string = '';
  private authListenersRegistered = false;

  /**
   * Initialize the WebSocket service with the base URL
   * @param baseUrl The base URL of the API (e.g., 'http://localhost:8000')
   */
  initialize(baseUrl: string) {
    // Convert http/https to ws/wss
    this.baseUrl = baseUrl.replace(/^http/, 'ws');

    if (this.authListenersRegistered) {
      return;
    }
    this.authListenersRegistered = true;

    // Listen for auth events to reconnect when token changes
    eventService.subscribe(AuthEventType.AUTH_TOKEN_REFRESHED, () => {
      if (this.connectionState === ConnectionState.CONNECTED) {
        this.reconnect();
      }
    });

    eventService.subscribe(AuthEventType.AUTH_LOGOUT, () => {
      this.disconnect();
    });
  }

  /**
   * Connect to the WebSocket server
   */
  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = authService.getAccessToken();
    if (!token) {
      console.error('Cannot connect to WebSocket: No authentication token available');
      this.setConnectionState(ConnectionState.ERROR);
      return;
    }

    try {
      this.setConnectionState(ConnectionState.CONNECTING);

      // Create WebSocket connection with token for authentication
      const wsUrl = `${this.baseUrl}/ws/messages/?token=${token}`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.setConnectionState(ConnectionState.ERROR);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.setConnectionState(ConnectionState.DISCONNECTED);
  }

  /**
   * Reconnect to the WebSocket server
   */
  reconnect() {
    this.disconnect();
    this.connect();
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen() {
    console.log('WebSocket connection established');
    this.setConnectionState(ConnectionState.CONNECTED);
    this.reconnectAttempts = 0;
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent) {
    try {
      const message = JSON.parse(event.data) as TextMessage;

      // Emit message received event
      eventService.emit(WebSocketEventType.MESSAGE_RECEIVED, message);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent) {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    this.socket = null;
    this.setConnectionState(ConnectionState.DISCONNECTED, { code: event.code, reason: event.reason });

    // Try to reconnect if not closed cleanly
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event) {
    console.error('WebSocket error:', event);
    this.setConnectionState(ConnectionState.ERROR, event);
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Maximum reconnection attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts);
    console.log(`Scheduling reconnect in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Set the connection state and emit events
   * @param state The new connection state
   * @param data Additional data to include in the event
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private setConnectionState(state: ConnectionState, data?: any) {
    const previousState = this.connectionState;
    this.connectionState = state;

    // Emit state change event if the state has changed
    if (previousState !== state) {
      console.log(`WebSocket connection state changed: ${previousState} -> ${state}`);

      // Emit specific events based on the new state
      if (state === ConnectionState.CONNECTED) {
        eventService.emit(WebSocketEventType.CONNECTED, data);
      } else if (state === ConnectionState.DISCONNECTED) {
        eventService.emit(WebSocketEventType.DISCONNECTED, data);
      } else if (state === ConnectionState.ERROR) {
        eventService.emit(WebSocketEventType.ERROR, data);
      }
    }
  }

  /**
   * Get the current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if the WebSocket is connected
   */
  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }
}

// Create singleton instance
export const websocketService = new WebSocketService();
