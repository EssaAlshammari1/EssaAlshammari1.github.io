import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from rag import answer_question, create_rag_components


HOST = "127.0.0.1"
PORT = 8000
COMPONENTS = None
COMPONENTS_LOCK = threading.Lock()


def get_components():
    global COMPONENTS
    if COMPONENTS is None:
        with COMPONENTS_LOCK:
            if COMPONENTS is None:
                COMPONENTS = create_rag_components()
    return COMPONENTS


def make_sources(sources):
    return [{"text": document, "score": score} for document, score in sources]


class RAGRequestHandler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_json(204, {})

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {"status": "ok", "model_loaded": COMPONENTS is not None})
            return
        self.send_json(404, {"error": "Route not found"})

    def do_POST(self):
        if self.path != "/ask":
            self.send_json(404, {"error": "Route not found"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length))
            question = payload.get("question", "")
            if not isinstance(question, str) or not question.strip():
                self.send_json(400, {"error": "question must be a non-empty string"})
                return

            answer, sources = answer_question(question.strip(), get_components())
            self.send_json(200, {"answer": answer, "sources": make_sources(sources)})
        except json.JSONDecodeError:
            self.send_json(400, {"error": "Request body must be valid JSON"})
        except Exception as error:
            self.send_json(500, {"error": str(error)})

    def log_message(self, format_string, *args):
        print(f"{self.address_string()} - {format_string % args}")


def main():
    server = ThreadingHTTPServer((HOST, PORT), RAGRequestHandler)
    print(f"RAG API running at http://{HOST}:{PORT}")
    print("GET  /health")
    print("POST /ask  {\"question\": \"...\"}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping RAG API...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
