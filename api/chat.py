from http.server import BaseHTTPRequestHandler
import json
import os
from groq import Groq

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        try:
            api_key = os.environ.get('GROQ_API_KEY')
            if not api_key:
                self.send_response(503)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Server configuration is missing GROQ_API_KEY'}).encode('utf-8'))
                return

            client = Groq(api_key=api_key)
            data = json.loads(body)
            messages = data.get('messages', [])
            stream = data.get('stream', False)
            
            if stream:
                self.send_response(200)
                self.send_header('Content-Type', 'text/event-stream')
                self.send_header('Cache-Control', 'no-cache')
                self.send_header('Connection', 'keep-alive')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
                
                response = client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    stream=True
                )
                for chunk in response:
                    if chunk.choices[0].delta.content:
                        val = chunk.choices[0].delta.content
                        payload = {
                            "choices": [
                                {
                                    "delta": {
                                        "content": val
                                    }
                                }
                            ]
                        }
                        self.wfile.write(f"data: {json.dumps(payload)}\n\n".encode('utf-8'))
                        self.wfile.flush()
                self.wfile.write("data: [DONE]\n\n".encode('utf-8'))
                self.wfile.flush()
            else:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
                
                response = client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    stream=False
                )
                res_body = {
                    'response': response.choices[0].message.content
                }
                self.wfile.write(json.dumps(res_body).encode('utf-8'))
        except Exception as e:
            try:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
            except:
                pass
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


import os
from groq import Groq

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        try:
            api_key = os.environ.get('GROQ_API_KEY')
            if not api_key:
                self.send_response(503)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Server configuration is missing GROQ_API_KEY'}).encode('utf-8'))
                return

            client = Groq(api_key=api_key)
            data = json.loads(body)
            messages = data.get('messages', [])
            stream = data.get('stream', False)
            
            if stream:
                self.send_response(200)
                self.send_header('Content-Type', 'text/event-stream')
                self.send_header('Cache-Control', 'no-cache')
                self.send_header('Connection', 'keep-alive')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
                
                response = client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    stream=True
                )
                for chunk in response:
                    if chunk.choices[0].delta.content:
                        val = chunk.choices[0].delta.content
                        payload = {
                            "choices": [
                                {
                                    "delta": {
                                        "content": val
                                    }
                                }
                            ]
                        }
                        self.wfile.write(f"data: {json.dumps(payload)}\n\n".encode('utf-8'))
                        self.wfile.flush()
                self.wfile.write("data: [DONE]\n\n".encode('utf-8'))
                self.wfile.flush()
            else:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
                
                response = client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    stream=False
                )
                res_body = {
                    'response': response.choices[0].message.content
                }
                self.wfile.write(json.dumps(res_body).encode('utf-8'))
        except Exception as e:
            try:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
            except:
                pass
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
            
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()