from http.server import BaseHTTPRequestHandler
import json
import os

from groq import Groq

MODEL = os.environ.get('GROQ_MODEL', 'llama-3.1-8b-instant')

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        try:
            api_key = os.environ.get('GROQ_API_KEY')
            if not api_key:
                self._send_json(503, {'error': 'Server configuration is missing GROQ_API_KEY'})
                return

            data = json.loads(body)
            response = Groq(api_key=api_key).chat.completions.create(
                model=MODEL,
                messages=data.get('messages', []),
                stream=data.get('stream', False),
            )

            if data.get('stream', False):
                self.send_response(200)
                self.send_header('Content-Type', 'text/event-stream')
                self.send_header('Cache-Control', 'no-cache, no-transform')
                self.send_header('Connection', 'keep-alive')
                self.send_header('X-Accel-Buffering', 'no')
                self._send_cors_headers()
                self.end_headers()

                for chunk in response:
                    if chunk.choices and chunk.choices[0].delta.content:
                        payload = {
                            'choices': [
                                {'delta': {'content': chunk.choices[0].delta.content}}
                            ]
                        }
                        self.wfile.write(f"data: {json.dumps(payload)}\n\n".encode('utf-8'))
                        self.wfile.flush()

                self.wfile.write(b'data: [DONE]\n\n')
                self.wfile.flush()
                return

            self._send_json(200, {'response': response.choices[0].message.content})
        except Exception as error:
            self._send_json(502, {'error': str(error)})

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def _send_json(self, status, payload):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode('utf-8'))

    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

