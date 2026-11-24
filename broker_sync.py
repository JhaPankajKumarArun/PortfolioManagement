"""Run locally. Credentials are prompted, never written to disk."""
import json
import getpass
import secrets
import webbrowser
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, parse_qs

def token_from_input():
    raw = getpass.getpass("Paste request token or redirect URL: ").strip()
    return parse_qs(urlparse(raw).query).get("request_token", [raw])[0]

def zerodha():
    from kiteconnect import KiteConnect
    kite = KiteConnect(api_key=getpass.getpass("Kite API key: "), timeout=30)
    secret = getpass.getpass("Kite API secret: ")
    webbrowser.open(kite.login_url())
    session = kite.generate_session(token_from_input(), api_secret=secret)
    kite.set_access_token(session["access_token"])
    equity = kite.holdings()
    funds = kite.mf_holdings()
    return {"equity": equity, "mutualFunds": funds}

def paytm():
    from pyPMClient import PMClient
    client = PMClient(api_key=getpass.getpass("Paytm API key: "),
                      api_secret=getpass.getpass("Paytm API secret: "))
    state = secrets.token_urlsafe(24)
    login = client.login(state)
    print("Open the official login URL supplied by the SDK.")
    if isinstance(login, str) and login.startswith("https://"):
        webbrowser.open(login)
    raw = getpass.getpass("Paste complete callback URL: ").strip()
    query = parse_qs(urlparse(raw).query)
    if query.get("state", query.get("state_key", [])) != [state]:
        raise ValueError("Callback state could not be verified")
    tokens = query.get("request_token", query.get("requestToken", []))
    if len(tokens) != 1:
        raise ValueError("Missing request token")
    client.generate_session(request_token=tokens[0])
    return {"equity": client.user_holdings_data()}

def main():
    broker = input("Broker (zerodha/paytm): ").strip().lower()
    if broker not in ("zerodha", "paytm"):
        raise ValueError("Unsupported broker")
    data = {"zerodha": zerodha, "paytm": paytm}[broker]()
    snapshot = {"schema": "broker-snapshot-v1", "broker": broker,
                "fetchedAt": datetime.now(timezone.utc).isoformat(), "data": data}
    # Exclusive creation prevents accidental overwrite. Keep outside the repository.
    directory = Path.home() / "PortfolioBrokerSnapshots"
    directory.mkdir(exist_ok=True)
    path = directory / (broker + "-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S") + ".json")
    with path.open("x", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=2)
    print("Snapshot saved locally:", path)

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Avoid printing provider response bodies or secrets.
        print("Sync failed:", type(exc).__name__, "- check credentials, SDK and session.")
        raise SystemExit(1) from None
