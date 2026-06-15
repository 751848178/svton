/**
 * WebSocket relay server for Chrome CDP extension.
 *
 * Listens on port 9223. When the Chrome extension connects, it relays
 * CDP commands between the Svton agent (TypeScript) and Chrome (via the
 * extension's chrome.debugger API).
 *
 * Protocol (JSON over WebSocket):
 *   Agent → Extension: { type: "list_tabs"|"attach"|"cdp_command"|..., id, ... }
 *   Extension → Agent: { type: "response", id, result|error }
 */

use std::sync::Arc;
use tokio::sync::{Mutex, mpsc};
use futures_util::{StreamExt, SinkExt};

/// Shared state: the current WebSocket sender to the extension (if connected).
pub type ExtSender = Arc<Mutex<Option<mpsc::UnboundedSender<String>>>>;

pub fn create_relay_state() -> ExtSender {
    Arc::new(Mutex::new(None))
}

/// Start the WebSocket relay server on port 9223.
/// Returns immediately — the server runs in a background async task.
pub fn start_ws_relay(state: ExtSender) {
    tauri::async_runtime::spawn(async move {
        let addr = "0.0.0.0:9223";
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => {
                println!("[WS Relay] Listening on {}", addr);
                l
            }
            Err(e) => {
                eprintln!("[WS Relay] Failed to bind {}: {}", addr, e);
                return;
            }
        };

        loop {
            let (stream, addr) = match listener.accept().await {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("[WS Relay] Accept error: {}", e);
                    continue;
                }
            };

            let state = state.clone();

            tauri::async_runtime::spawn(async move {
                println!("[WS Relay] Extension connected from {}", addr);

                let ws_stream = match tokio_tungstenite::accept_async(stream).await {
                    Ok(s) => s,
                    Err(e) => {
                        eprintln!("[WS Relay] WebSocket handshake failed: {}", e);
                        return;
                    }
                };

                let (mut ws_sender, mut ws_receiver) = ws_stream.split();

                // Channel for sending messages to the extension
                let (tx, mut rx) = mpsc::unbounded_channel::<String>();

                // Store the sender in shared state
                {
                    let mut guard = state.lock().await;
                    *guard = Some(tx);
                }

                println!("[WS Relay] Extension ready");

                // Forward: channel → WebSocket
                let send_task = tauri::async_runtime::spawn(async move {
                    while let Some(msg) = rx.recv().await {
                        if ws_sender.send(tokio_tungstenite::tungstenite::Message::Text(msg)).await.is_err() {
                            break;
                        }
                    }
                });

                // Forward: WebSocket → broadcast (just log for now)
                let recv_task = tauri::async_runtime::spawn(async move {
                    while let Some(msg) = ws_receiver.next().await {
                        match msg {
                            Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                                // Store the response for the agent to pick up
                                // For simplicity, we emit a Tauri event with the response
                                // The TypeScript side listens for this event
                                println!("[WS Relay] From extension: {}", text.chars().take(200).collect::<String>());
                                // Forward to Tauri event system
                                // (The actual event emission would need AppHandle)
                            }
                            Ok(tokio_tungstenite::tungstenite::Message::Close(_)) => {
                                println!("[WS Relay] Extension disconnected");
                                break;
                            }
                            Err(e) => {
                                eprintln!("[WS Relay] Receive error: {}", e);
                                break;
                            }
                            _ => {}
                        }
                    }
                });

                // Wait for both tasks to complete
                let _ = send_task.await;
                let _ = recv_task.await;

                // Clear the shared sender
                {
                    let mut guard = state.lock().await;
                    *guard = None;
                }
                println!("[WS Relay] Extension session ended");
            });
        }
    });
}

/// Check if the Chrome extension is currently connected.
pub async fn is_extension_connected(state: &ExtSender) -> bool {
    let guard = state.lock().await;
    guard.is_some()
}

/// Send a message to the Chrome extension (if connected).
pub async fn send_to_extension(state: &ExtSender, msg: &str) -> Result<(), String> {
    let guard = state.lock().await;
    if let Some(tx) = guard.as_ref() {
        tx.send(msg.to_string()).map_err(|e| format!("Send error: {}", e))
    } else {
        Err("Chrome extension not connected".to_string())
    }
}
