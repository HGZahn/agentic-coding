#!/usr/bin/env python3
"""TLS-terminating MITM for proving/denying curl --pinnedpubkey AND capturing
the real opencode CLI handshake (HTTPS_PROXY=... style).

Supports three client behaviours:
  1. CONNECT host:443  -> we answer 200, then wrap our leaf (client trusts our
     CA via NODE_EXTRA_CA_CERTS / SSL_CERT_FILE) -> full plaintext visibility.
  2. absolute-form plain HTTP proxy request (GET http://... HTTP/1.1) -> forwarded.
  3. direct TLS to our listener (curl --resolve ... --cacert ca.crt).

Everything is logged plaintext to workdir/mitm.log; bodies are saved as
workdir/req-NNN.body / resp-NNN.body so a captured request can be replayed
verbatim with:  curl --data @req-NNN.body ...

FAST-FIND HINTS (see README.md next to this file):
  - Live free model pool : GET https://opencode.ai/zen/v1/models      (Bearer public)
                           GET https://opencode.ai/inference/v1/models (no auth)
  - Per-model limits/API : https://models.opencode.ai/api.json and https://models.dev/api.json
      reasoning_options -> thinking efforts (toggle | effort values | budget_tokens)
      modalities.input  -> text/image/video/audio/pdf
      provider.api      -> endpoint family (openai vs anthropic lanes)
  - Old captured client handshake in git history:
        git show ac7731a:home/.pi/agent/extensions/dreamloop-zen.ts   (deleted by 3efbda4)
  - Re-capture the real CLI:
        HTTPS_PROXY=http://127.0.0.1:8443 NODE_EXTRA_CA_CERTS=<workdir>/ca.crt \
        SSL_CERT_FILE=<workdir>/ca.crt opencode run --standalone -m opencode/<model> "..."
  - Free-tier gate verdicts: 200 ok / 403 FreeTierError ("only from within
    OpenCode") / 401 AuthError (paid model) / 400 wrong protocol family /
    500 = lane or request-shape problem (observed 2026-10-18 for anonymous
    chat/completions on BOTH /inference and /zen lanes - debug from there).
"""
import argparse
import datetime
import http.client
import socket
import ssl
import urllib.parse


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--workdir", required=True, help="dir holding site.pem and mitm.log")
    ap.add_argument("--listen", default="127.0.0.1:8443")
    ap.add_argument("--upstream", default="opencode.ai:443")
    args = ap.parse_args()

    host, port = args.listen.rsplit(":", 1)
    up_host, up_port = args.upstream.rsplit(":", 1)

    log = open(f"{args.workdir}/mitm.log", "a", buffering=1)
    counter = {"n": 0}

    def say(msg: str) -> None:
        log.write(f"{datetime.datetime.now().isoformat(timespec='seconds')} {msg}\n")

    tls_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    tls_ctx.load_cert_chain(f"{args.workdir}/site.pem")

    def read_head(sock) -> bytes:
        data = b""
        while b"\r\n\r\n" not in data:
            chunk = sock.recv(65536)
            if not chunk:
                break
            data += chunk
        return data

    def forward(method: str, target: str, raw_head: bytes, rest: bytes, conn) -> None:
        head, pre = (raw_head.split(b"\r\n\r\n", 1) + [b""])[:2] if b"\r\n\r\n" in raw_head else (raw_head, b"")
        lines = head.decode("latin1").split("\r\n")
        headers = {}
        for line in lines[1:]:
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()
        clen = int(headers.get("content-length", "0") or 0)
        body = pre + rest
        while len(body) < clen:
            body += conn.recv(65536)
        body = body[:clen]

        counter["n"] += 1
        n = counter["n"]
        say(f"PLAINTEXT REQUEST >>> {lines[0]}")
        for line in lines[1:]:
            if line.lower().startswith(("authorization", "x-opencode", "user-agent", "host",
                                        "content-type", "cookie", "accept")):
                say(f"  hdr {line}")
        req_file = f"{args.workdir}/req-{n:03d}.body"
        with open(req_file, "wb") as fh:
            fh.write(body)
        say(f"  body saved -> {req_file} ({len(body)} bytes)")

        # absolute-form proxy target wins (e.g. localhost service calls must
        # NOT be forwarded to upstream opencode.ai), otherwise use orig path
        netloc = scheme = None
        if target.startswith("https://") or target.startswith("http://"):
            parts_ = urllib.parse.urlsplit(target)
            netloc, scheme = parts_.netloc, parts_.scheme
            path = parts_.path + (f"?{parts_.query}" if parts_.query else "")
        else:
            path = target

        if netloc:
            h, _, p = netloc.partition(":")
            port_ = int(p) if p else (443 if scheme == "https" else 80)
        else:
            h, port_, scheme = up_host, int(up_port), "https"

        fwd_headers = {k: v for k, v in headers.items()
                       if k not in ("host", "content-length", "connection", "accept-encoding")}
        if scheme == "https":
            upstream = http.client.HTTPSConnection(h, port_, timeout=45,
                                                   context=ssl.create_default_context())
        else:
            upstream = http.client.HTTPConnection(h, port_, timeout=45)
        upstream.request(method, path, body=body if clen else None, headers=fwd_headers)
        resp = upstream.getresponse()
        payload = resp.read()
        ctype = resp.getheader("content-type", "application/json")
        say(f"UPSTREAM RESPONSE <<< {resp.status} len={len(payload)} ct={ctype}")
        say(f"  body {payload[:300].decode('utf-8', 'replace')}")
        with open(f"{args.workdir}/resp-{n:03d}.body", "wb") as fh:
            fh.write(payload)
        conn.sendall((f"HTTP/1.1 {resp.status} {resp.reason}\r\n"
                      f"Content-Type: {ctype}\r\nContent-Length: {len(payload)}\r\n"
                      f"Connection: close\r\n\r\n").encode() + payload)
        say("PASSTHROUGH DONE - proxy saw full plaintext")

    def serve_plain(conn) -> None:
        conn.settimeout(45)
        head = read_head(conn)
        if not head:
            conn.close()
            return
        first = head.split(b"\r\n", 1)[0].decode("latin1")
        parts = first.split(" ")
        if parts[0] == "CONNECT":
            # tunnel negotiation: after 200 we MITM the TLS inside the tunnel,
            # trusting only our local CA (client passes NODE_EXTRA_CA_CERTS).
            target = parts[1]
            conn.sendall(b"HTTP/1.1 200 Connection established\r\n\r\n")
            say(f"CONNECT {target} -> MITM inside tunnel")
            try:
                tls = tls_ctx.wrap_socket(conn, server_side=True)
            except Exception as exc:  # noqa: BLE001
                say(f"TUNNEL TLS FAILED {type(exc).__name__}: {exc} "
                    f"(client did not trust local CA -> falls back to opaque tunnel)")
                return
            inner = read_head(tls)
            if not inner:
                tls.close()
                return
            inner_first = inner.split(b"\r\n", 1)[0].decode("latin1").split(" ")
            forward(inner_first[0], inner_first[1] if len(inner_first) > 1 else "/", inner, b"", tls)
            tls.close()
            return
        method, target = parts[0], (parts[1] if len(parts) > 1 else "/")
        say(f"ABSOLUTE-FORM {first}")
        forward(method, target, head, b"", conn)
        conn.close()

    def serve_direct_tls(conn) -> None:
        inner = read_head(conn)
        if not inner:
            conn.close()
            return
        first = inner.split(b"\r\n", 1)[0].decode("latin1").split(" ")
        forward(first[0], first[1] if len(first) > 1 else "/", inner, b"", conn)
        conn.close()

    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((host, int(port)))
    srv.listen(16)
    say(f"MITM listening on {host}:{port} -> {up_host}:{up_port}")
    while True:
        client, _addr = srv.accept()
        client.settimeout(50)
        # peek: TLS clients speak 0x16, proxy clients speak ASCII "CONNECT ..."/"GET ..."
        try:
            first_byte = client.recv(1, socket.MSG_PEEK)
        except Exception:  # noqa: BLE001
            first_byte = b""
        try:
            if first_byte == b"\x16":
                tls = tls_ctx.wrap_socket(client, server_side=True)
                serve_direct_tls(tls)
            else:
                serve_plain(client)
        except Exception as exc:  # noqa: BLE001
            say(f"SESSION ERROR {type(exc).__name__}: {exc}")
            try:
                client.close()
            except Exception:  # noqa: BLE001
                pass


if __name__ == "__main__":
    main()