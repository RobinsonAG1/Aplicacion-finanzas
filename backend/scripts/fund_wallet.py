import argparse
import sys

from eth_account import Account
from web3 import Web3

# Cuenta prefundificada #0 de Anvil: la fuente de los fondos en desarrollo.
ANVIL_FUNDING_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"


def main() -> None:
    parser = argparse.ArgumentParser(description="Fondea una direccion con ETH desde Anvil")
    parser.add_argument("--rpc", default="http://127.0.0.1:8545")
    parser.add_argument("--to", required=True, help="direccion del wallet a fondear")
    parser.add_argument("--amount", type=float, default=1.0, help="monto en ETH (def. 1)")
    args = parser.parse_args()

    w3 = Web3(Web3.HTTPProvider(args.rpc))
    if not w3.is_connected():
        sys.exit(f"no se pudo conectar a {args.rpc}")

    account = Account.from_key(ANVIL_FUNDING_KEY)
    tx = {
        "to": Web3.to_checksum_address(args.to),
        "value": Web3.to_wei(args.amount, "ether"),
        "nonce": w3.eth.get_transaction_count(account.address),
        "gas": 21_000,
        "gasPrice": w3.eth.gas_price,
        "chainId": w3.eth.chain_id,
    }
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
    if receipt["status"] != 1:
        sys.exit("la transferencia fue revertida")
    balance = w3.from_wei(w3.eth.get_balance(Web3.to_checksum_address(args.to)), "ether")
    print(
        f"fondeado {args.to} con {args.amount} ETH "
        f"(bloque {receipt['blockNumber']}, saldo {balance} ETH)"
    )


if __name__ == "__main__":
    main()
