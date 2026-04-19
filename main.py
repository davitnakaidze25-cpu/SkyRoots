import http.server
import socketserver
import webbrowser
import os
import sys
import time

# --- CONFIGURATION ---
PORT = 8000
DIRECTORY = "."

class AeroHandler(http.server.SimpleHTTPRequestHandler):
    """
    Custom Handler to ensure the app loads correctly 
    and prevents caching during development.
    """
    def end_headers(self):
        # Force the browser to not cache files so CSS updates instantly
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        # Clean custom logging (don't clutter terminal)
        sys.stdout.write(f"  [REQ] {self.client_address[0]} accessed {args[0]}\n")

def run_system():
    # 1. Setup the specific folder
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # 2. Define the Server
    handler = AeroHandler
    
    # 3. Safe Port Allocation
    try:
        with socketserver.TCPServer(("", PORT), handler) as httpd:
            print("\n" + "="*50)
            print(f"   🚀 AEROGROW AI SYSTEM ONLINE")
            print("="*50)
            print(f"   • Local Server:   http://localhost:{PORT}")
            print(f"   • Status:         Listening for Connections")
            print(f"   • Backend:        Waiting for BLE (ESP32)")
            print(f"   • Stop System:    Press Ctrl+C")
            print("-" * 50)
            
            # 4. Auto-Launch Browser
            # Adding a small delay ensures server is ready
            time.sleep(1) 
            print("   >> Launching Interface...")
            webbrowser.open(f"http://localhost:{PORT}")
            
            # 5. Serve Forever
            httpd.serve_forever()
            
    except OSError as e:
        print(f"\n[ERROR] Port {PORT} is busy. Is the app already running?")
        print("Try closing other python windows or change the PORT in main.py\n")

if __name__ == "__main__":
    try:
        run_system()
    except KeyboardInterrupt:
        print("\n\n   🛑 System Shutdown. Goodbye!\n")